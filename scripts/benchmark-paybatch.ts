import hre, { deployments, ethers, fhevm } from "hardhat";

/**
 * Legacy `payBatch` operator path benchmark only.
 *
 * Measures the historical admin-push payout flow (not the current user-facing flow). Probes
 * batches of 5 and 12 investors (12 is the confirmed real per-transaction ceiling,
 * 13+ revert) as documented in docs/E2E-RUN.md, and reports actual gas + implied
 * marginal cost for this push path.
 *   npx hardhat run scripts/benchmark-paybatch.ts --network sepolia
 */
const SEPOLIA_FHEVM_ENV = {
  FHEVM_HARDHAT_NETWORK: "sepolia",
  ACL_CONTRACT_ADDRESS: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
  FHEVM_EXECUTOR_CONTRACT_ADDRESS: "0x92C920834Ec8941d2C77D188936E1f7A6f49c127",
  KMS_VERIFIER_CONTRACT_ADDRESS: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
  INPUT_VERIFIER_CONTRACT_ADDRESS: "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0",
  HCU_LIMIT_CONTRACT_ADDRESS: "0x594BB474275918AF9609814E68C61B1587c5F838",
  RELAYER_URL: "https://relayer.testnet.zama.org/v2",
} as const;

async function getStartNonce(signer: { getNonce: (blockTag?: string) => Promise<number> }) {
  try {
    return await signer.getNonce("pending");
  } catch {
    return signer.getNonce();
  }
}

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
  const deployer = signers[0];
  const holders = signers.slice(9, 29); // 20 fresh wallets, indices 9-28
  if (holders.length < 20)
    throw new Error(`need 20 fresh signers, got ${holders.length} - bump hardhat.config.ts count`);

  const sharesDep = await deployments.get("CharterShares");
  const mcUSDDep = await deployments.get("MockConfidentialUSD");
  const distributorDep = await deployments.get("DividendDistributor");
  const shares = await ethers.getContractAt("CharterShares", sharesDep.address, deployer);
  const mcUSD = await ethers.getContractAt("MockConfidentialUSD", mcUSDDep.address, deployer);
  const distributor = await ethers.getContractAt("DividendDistributor", distributorDep.address, deployer);

  if (await shares.paused()) {
    console.log("unpausing CharterShares before benchmark minting");
    await (await shares.unpause()).wait();
  }

  let nextNonce = await getStartNonce(deployer);

  console.log(`preparing benchmark encrypted amount`);
  const amountInput = await fhevm.createEncryptedInput(sharesDep.address, deployer.address).add64(100).encrypt();

  console.log(`minting 100 shares to each of ${holders.length} fresh wallets...`);
  for (const holder of holders) {
    const tx = await shares["confidentialMint(address,bytes32,bytes)"](
      holder.address,
      amountInput.handles[0],
      amountInput.inputProof,
      { nonce: nextNonce++ },
    );
    await tx.wait();
  }

  console.log("re-disclosing supply (stale after the mints above)...");
  await (await shares.requestSupplyDisclosure()).wait();
  const supplyHandle = (await shares.confidentialTotalSupply()) as `0x${string}`;
  const disclosed = await fhevm.publicDecrypt([supplyHandle]);
  const clearSupply = disclosed.clearValues[supplyHandle];
  if (typeof clearSupply !== "bigint") throw new Error("oracle returned no supply");
  await (await shares.finalizeSupplyDisclosure(clearSupply, disclosed.decryptionProof)).wait();
  console.log(`disclosed total shares: ${clearSupply}`);

  await (await mcUSD.mint(deployer.address, 2_000_000n)).wait();
  await (await mcUSD.setOperator(distributorDep.address, 4_000_000_000)).wait();
  if (!(await shares.paused())) await (await shares.pause()).wait();

  await (await distributor.declare(mcUSDDep.address, 1_000_000n)).wait();
  const distId = (await distributor.distributionCount()) - 1n;
  console.log(`distribution ${distId} declared`);

  const tx5 = await distributor.payBatch(
    distId,
    holders.slice(0, 5).map((h) => h.address),
  );
  const receipt5 = await tx5.wait();
  console.log(`payBatch(5 investors): gas used = ${receipt5!.gasUsed} | tx ${tx5.hash}`);

  // Legacy push path: the next 12 holders, paid in one call, measure the confirmed
  // per-transaction ceiling.
  const tx12 = await distributor.payBatch(
    distId,
    holders.slice(5, 17).map((h) => h.address),
  );
  const receipt12 = await tx12.wait();
  console.log(`payBatch(12 investors): gas used = ${receipt12!.gasUsed} | tx ${tx12.hash}`);

  // Legacy push path: pay the remaining 3 holders to leave every wallet paid.
  const tx3 = await distributor.payBatch(
    distId,
    holders.slice(17, 20).map((h) => h.address),
  );
  await tx3.wait();

  await (await shares.unpause()).wait();

  const marginalPerInvestor = (receipt12!.gasUsed - receipt5!.gasUsed) / BigInt(12 - 5);
  console.log(`implied marginal gas per additional investor: ~${marginalPerInvestor}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
