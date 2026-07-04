import hre, { deployments, ethers, fhevm } from "hardhat";

/**
 * Stages real, on-chain activity for the three new modules (vesting, gated issuance, force-transfer
 * guardian) so their addresses in the README are backed by live transactions, not just deployment.
 *   npx hardhat run scripts/stage-new-modules.ts --network sepolia
 */

const FAR_FUTURE = 4_000_000_000;

const SEPOLIA_FHEVM_ENV = {
  FHEVM_HARDHAT_NETWORK: "sepolia",
  ACL_CONTRACT_ADDRESS: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
  FHEVM_EXECUTOR_CONTRACT_ADDRESS: "0x92C920834Ec8941d2C77D188936E1f7A6f49c127",
  KMS_VERIFIER_CONTRACT_ADDRESS: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
  INPUT_VERIFIER_CONTRACT_ADDRESS: "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0",
  HCU_LIMIT_CONTRACT_ADDRESS: "0x594BB474275918AF9609814E68C61B1587c5F838",
  RELAYER_URL: "https://relayer.testnet.zama.org/v2",
} as const;

async function initializeFhevmCli() {
  if (hre.network.name === "sepolia") {
    for (const [key, value] of Object.entries(SEPOLIA_FHEVM_ENV)) {
      process.env[key] ??= value;
    }
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await hre.fhevm.initializeCLIApi();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw lastError;
}

async function main() {
  await initializeFhevmCli();
  const signers = await ethers.getSigners();
  const [deployer, , , guardian1, guardian2] = signers;
  const beneficiary = signers[6];
  const applicant = signers[7];
  const recoveryWallet = signers[8];

  const sharesDep = await deployments.get("CharterShares");
  const vestingDep = await deployments.get("VestingSchedule");
  const registryDep = await deployments.get("AccreditationRegistry");
  const gatedDep = await deployments.get("GatedIssuance");
  const guardianDep = await deployments.get("ForceTransferGuardian");

  const shares = await ethers.getContractAt("CharterShares", sharesDep.address, deployer);
  const vesting = await ethers.getContractAt("VestingSchedule", vestingDep.address, deployer);
  const registry = await ethers.getContractAt("AccreditationRegistry", registryDep.address, deployer);
  const gated = await ethers.getContractAt("GatedIssuance", gatedDep.address, deployer);
  const guardianContract = await ethers.getContractAt("ForceTransferGuardian", guardianDep.address);

  // 1. Vesting: fund a real grant from the deployer's own balance.
  await (await shares.setOperator(vestingDep.address, FAR_FUTURE)).wait();
  const grantInput = await fhevm.createEncryptedInput(vestingDep.address, deployer.address).add64(50_000).encrypt();
  const grantTx = await vesting.createGrant(beneficiary.address, grantInput.handles[0], grantInput.inputProof, 30, 120);
  await grantTx.wait();
  console.log(`vesting grant created: tx ${grantTx.hash}`);

  // 2. Gated issuance: accredit a wallet, then mint through the gate.
  const accreditTx = await registry.setAccredited(applicant.address, true);
  await accreditTx.wait();
  console.log(`accredited ${applicant.address}: tx ${accreditTx.hash}`);
  const issueInput = await fhevm.createEncryptedInput(gatedDep.address, deployer.address).add64(25_000).encrypt();
  const issueTx = await gated.issue(applicant.address, issueInput.handles[0], issueInput.inputProof);
  await issueTx.wait();
  console.log(`gated issuance minted to accredited wallet: tx ${issueTx.hash}`);

  // 3. Force-transfer guardian: full propose -> confirm -> timelock -> execute loop.
  const amountInput = await fhevm.createEncryptedInput(guardianDep.address, guardian1.address).add64(5_000).encrypt();
  const proposeTx = await guardianContract
    .connect(guardian1)
    .propose(
      deployer.address,
      recoveryWallet.address,
      amountInput.handles[0],
      amountInput.inputProof,
      "Demo enforcement action: recover shares from a compromised wallet",
    );
  await proposeTx.wait();
  const proposalId = (await guardianContract.proposalCount()) - 1n;
  console.log(`guardian proposal ${proposalId} created: tx ${proposeTx.hash}`);

  const confirmTx = await guardianContract.connect(guardian2).confirm(proposalId);
  await confirmTx.wait();
  console.log(`guardian proposal ${proposalId} reached quorum (2-of-3): tx ${confirmTx.hash}`);

  const proposal = await guardianContract.getProposal(proposalId);
  console.log(`timelock ready at block ${proposal.readyAt}; waiting...`);
  for (;;) {
    const current = await ethers.provider.getBlockNumber();
    if (current >= Number(proposal.readyAt)) break;
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }

  const executeTx = await guardianContract.execute(proposalId);
  await executeTx.wait();
  console.log(`guardian proposal ${proposalId} executed after timelock: tx ${executeTx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
