import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ContractTransactionResponse } from "ethers";
import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

import type {
  CharterResolutionsV3,
  CharterShares,
  DemoShareFaucet,
  DividendDistributor,
  MockConfidentialUSD,
} from "../types";

type HexHandle = `0x${string}`;

type ScenarioContracts = {
  signer: HardhatEthersSigner;
  shares: CharterShares;
  sharesAddress: string;
  mcUSD: MockConfidentialUSD;
  mcUSDAddress: string;
  distributor: DividendDistributor;
  distributorAddress: string;
  resolutions: CharterResolutionsV3;
  resolutionsAddress: string;
  demoFaucet: DemoShareFaucet;
  demoFaucetAddress: string;
};

const SEPOLIA_FHEVM_ENV = {
  FHEVM_HARDHAT_NETWORK: "sepolia",
  ACL_CONTRACT_ADDRESS: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
  FHEVM_EXECUTOR_CONTRACT_ADDRESS: "0x92C920834Ec8941d2C77D188936E1f7A6f49c127",
  KMS_VERIFIER_CONTRACT_ADDRESS: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
  INPUT_VERIFIER_CONTRACT_ADDRESS: "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0",
  HCU_LIMIT_CONTRACT_ADDRESS: "0x594BB474275918AF9609814E68C61B1587c5F838",
  RELAYER_URL: "https://relayer.testnet.zama.org/v2",
} as const;

async function initializeFhevmCli(hre: HardhatRuntimeEnvironment) {
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
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
  }
  throw lastError;
}

async function contracts(
  hre: HardhatRuntimeEnvironment,
  signerIndex = 0,
  initializeFhevm = false,
): Promise<ScenarioContracts> {
  if (hre.network.name !== "hardhat") {
    if (initializeFhevm) {
      await initializeFhevmCli(hre);
    }
  } else {
    await hre.deployments.fixture(["Charter"]);
  }
  const signers = await hre.ethers.getSigners();
  const signer = signers[signerIndex];
  if (!signer) throw new Error(`no signer at index ${signerIndex}`);

  const [sharesDeployment, mcUSDDeployment, distributorDeployment, resolutionsDeployment, demoFaucetDeployment] =
    await Promise.all([
      hre.deployments.get("CharterShares"),
      hre.deployments.get("MockConfidentialUSD"),
      hre.deployments.get("DividendDistributor"),
      hre.deployments.get("CharterResolutionsV3"),
      hre.deployments.get("DemoShareFaucet"),
    ]);

  return {
    signer,
    shares: await hre.ethers.getContractAt("CharterShares", sharesDeployment.address, signer),
    sharesAddress: sharesDeployment.address,
    mcUSD: await hre.ethers.getContractAt("MockConfidentialUSD", mcUSDDeployment.address, signer),
    mcUSDAddress: mcUSDDeployment.address,
    distributor: await hre.ethers.getContractAt("DividendDistributor", distributorDeployment.address, signer),
    distributorAddress: distributorDeployment.address,
    resolutions: await hre.ethers.getContractAt("CharterResolutionsV3", resolutionsDeployment.address, signer),
    resolutionsAddress: resolutionsDeployment.address,
    demoFaucet: await hre.ethers.getContractAt("DemoShareFaucet", demoFaucetDeployment.address, signer),
    demoFaucetAddress: demoFaucetDeployment.address,
  };
}

async function send(label: string, txPromise: Promise<ContractTransactionResponse>) {
  const tx = await txPromise;
  console.log(`${label}: ${tx.hash}`);
  await tx.wait();
}

async function run(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    console.error(`${label} failed: ${message}`);
    process.exitCode = 1;
  }
}

function parseBool(value: string): boolean {
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  throw new Error("--support must be true or false");
}

function parseAddresses(value: string): string[] {
  return value
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

function mcUSDUnits(value: string): bigint {
  return BigInt(value) * 1_000_000n;
}

task<{ to: string; amount: string }>("scenario:issue", "Issue encrypted shares to an investor")
  .addParam("to", "Investor address")
  .addParam("amount", "Whole-share amount")
  .setAction((args, hre) =>
    run("scenario:issue", async () => {
      const c = await contracts(hre, 0, true);
      const input = await hre.fhevm
        .createEncryptedInput(c.sharesAddress, c.signer.address)
        .add64(BigInt(args.amount))
        .encrypt();
      await send(
        "confidentialMint",
        c.shares["confidentialMint(address,bytes32,bytes)"](args.to, input.handles[0], input.inputProof),
      );
      console.log(`issued ${args.amount} encrypted shares to ${args.to}`);
    }),
  );

task("scenario:disclose", "Disclose total issued shares with a KMS proof").setAction((_args, hre) =>
  run("scenario:disclose", async () => {
    const c = await contracts(hre, 0, true);
    await send("requestSupplyDisclosure", c.shares.requestSupplyDisclosure());
    const handle = (await c.shares.confidentialTotalSupply()) as HexHandle;
    const result = await hre.fhevm.publicDecrypt([handle]);
    const clear = result.clearValues[handle];
    if (typeof clear !== "bigint") throw new Error("oracle returned no total-supply value");
    await send("finalizeSupplyDisclosure", c.shares.finalizeSupplyDisclosure(clear, result.decryptionProof));
    console.log(`disclosed total shares: ${clear.toLocaleString("en-US")}`);
  }),
);

task<{ amount: string }>("scenario:fund", "Mint mcUSD to the deployer and approve the distributor")
  .addParam("amount", "Whole mcUSD amount")
  .setAction((args, hre) =>
    run("scenario:fund", async () => {
      const c = await contracts(hre);
      const amount = mcUSDUnits(args.amount);
      const until = Math.floor(Date.now() / 1000) + 86_400;
      await send("mcUSD.mint", c.mcUSD.mint(c.signer.address, amount));
      await send("mcUSD.setOperator", c.mcUSD.setOperator(c.distributorAddress, until));
      console.log(`funded ${args.amount} mcUSD and approved distributor until ${until}`);
    }),
  );

task<{ pool: string }>("scenario:declare", "Declare a funded distribution")
  .addParam("pool", "Whole mcUSD pool amount")
  .setAction((args, hre) =>
    run("scenario:declare", async () => {
      const c = await contracts(hre);
      const before = await c.distributor.distributionCount();
      if (!(await c.shares.paused())) {
        await send("shares.pause", c.shares.pause());
      }
      await send("distributor.declare", c.distributor.declare(c.mcUSDAddress, mcUSDUnits(args.pool)));
      const after = await c.distributor.distributionCount();
      console.log(`distribution id: ${after > before ? after - 1n : before}`);
    }),
  );

task<{ id: string; investors: string }>("scenario:pay", "Pay a distribution batch")
  .addParam("id", "Distribution id")
  .addParam("investors", "Comma-separated investor addresses")
  .setAction((args, hre) =>
    run("scenario:pay", async () => {
      const c = await contracts(hre);
      if (!(await c.shares.paused())) {
        await send("shares.pause", c.shares.pause());
      }
      await send("distributor.payBatch", c.distributor.payBatch(BigInt(args.id), parseAddresses(args.investors)));
      await send("shares.unpause", c.shares.unpause());
    }),
  );

task<{ text: string; blocks: string }>("scenario:propose", "Create a shareholder resolution")
  .addParam("text", "Resolution text")
  .addParam("blocks", "Voting period in blocks")
  .setAction((args, hre) =>
    run("scenario:propose", async () => {
      const c = await contracts(hre);
      const before = await c.resolutions.resolutionCount();
      await send("resolutions.propose", c.resolutions.propose(args.text, BigInt(args.blocks)));
      const after = await c.resolutions.resolutionCount();
      console.log(`resolution id: ${after > before ? after - 1n : before}`);
    }),
  );

task<{ signer: string }>("scenario:delegate", "Self-delegate share voting power")
  .addOptionalParam("signer", "Signer index", "0")
  .setAction((args, hre) =>
    run("scenario:delegate", async () => {
      const c = await contracts(hre, Number(args.signer));
      await send("shares.delegate", c.shares.delegate(c.signer.address));
      console.log(`delegated ${c.signer.address} to self`);
    }),
  );

task<{ id: string; support: string; signer: string }>("scenario:vote", "Cast an encrypted resolution vote")
  .addParam("id", "Resolution id")
  .addParam("support", "true or false")
  .addOptionalParam("signer", "Signer index", "0")
  .setAction((args, hre) =>
    run("scenario:vote", async () => {
      const c = await contracts(hre, Number(args.signer), true);
      const support = parseBool(args.support);
      const input = await hre.fhevm
        .createEncryptedInput(c.resolutionsAddress, c.signer.address)
        .addBool(support)
        .encrypt();
      await send("resolutions.castVote", c.resolutions.castVote(BigInt(args.id), input.handles[0], input.inputProof));
      console.log(`voted ${support ? "FOR" : "AGAINST"} on resolution ${args.id} from signer ${args.signer}`);
    }),
  );

task<{ id: string }>("scenario:settle", "Settle a resolution with public outcome proof")
  .addParam("id", "Resolution id")
  .setAction((args, hre) =>
    run("scenario:settle", async () => {
      const c = await contracts(hre, 0, true);
      const id = BigInt(args.id);
      let resolution = await c.resolutions.getResolution(id);
      if (!resolution.tallyRequested) {
        await send("resolutions.requestTally", c.resolutions.requestTally(id));
        resolution = await c.resolutions.getResolution(id);
      }
      if (!resolution.quorumReached) {
        console.log(`resolution ${id} did not reach quorum; rejected without disclosing a tally`);
        return;
      }
      const passedHandle = resolution.passedHandle as HexHandle;
      const result = await hre.fhevm.publicDecrypt([passedHandle]);
      const passed = result.clearValues[passedHandle];
      if (typeof passed !== "boolean") throw new Error("oracle returned no outcome");
      await send("resolutions.settle", c.resolutions.settle(id, passed, result.decryptionProof));
      console.log(`settled resolution ${id}: ${passed ? "passed" : "rejected"}`);
    }),
  );

task<{ id: string }>("scenario:request-tally", "Request a resolution outcome without settling")
  .addParam("id", "Resolution id")
  .setAction((args, hre) =>
    run("scenario:request-tally", async () => {
      const c = await contracts(hre);
      await send("resolutions.requestTally", c.resolutions.requestTally(BigInt(args.id)));
      console.log(`requested tally for resolution ${args.id}`);
    }),
  );

task<{ signer: string }>("scenario:claim-shares", "Claim demo shares from the one-time faucet")
  .addOptionalParam("signer", "Signer index", "0")
  .setAction((args, hre) =>
    run("scenario:claim-shares", async () => {
      const c = await contracts(hre, Number(args.signer));
      await send("demoFaucet.claim", c.demoFaucet.claim());
      console.log(`claimed demo shares for ${c.signer.address}`);
    }),
  );

task("scenario:status", "Print Charter scenario state").setAction((_args, hre) =>
  run("scenario:status", async () => {
    const c = await contracts(hre);
    const [totalShares, paused, distributionCount, resolutionCount] = await Promise.all([
      c.shares.totalSharesOnRecord(),
      c.shares.paused(),
      c.distributor.distributionCount(),
      c.resolutions.resolutionCount(),
    ]);
    console.log(`totalSharesOnRecord: ${totalShares}`);
    console.log(`paused: ${paused}`);
    console.log(`distributionCount: ${distributionCount}`);
    console.log(`resolutionCount: ${resolutionCount}`);
    for (let i = 0n; i < resolutionCount; i++) {
      const r = await c.resolutions.getResolution(i);
      console.log(
        `resolution #${i}: voters=${r.voterCount} quorum=${r.quorumReached} resolved=${r.resolved} passed=${r.passed} tallyRequested=${r.tallyRequested} deadline=${r.deadline} text="${r.description}"`,
      );
    }
  }),
);
