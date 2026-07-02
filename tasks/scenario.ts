import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ContractTransactionResponse } from "ethers";
import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

import type { CharterResolutions, CharterShares, DividendDistributor, MockConfidentialUSD } from "../types";

type HexHandle = `0x${string}`;

type ScenarioContracts = {
  signer: HardhatEthersSigner;
  shares: CharterShares;
  sharesAddress: string;
  mcUSD: MockConfidentialUSD;
  mcUSDAddress: string;
  distributor: DividendDistributor;
  distributorAddress: string;
  resolutions: CharterResolutions;
  resolutionsAddress: string;
};

async function contracts(hre: HardhatRuntimeEnvironment, signerIndex = 0): Promise<ScenarioContracts> {
  if (hre.network.name !== "hardhat") {
    await hre.fhevm.initializeCLIApi();
  } else {
    await hre.deployments.fixture(["Charter"]);
  }
  const signers = await hre.ethers.getSigners();
  const signer = signers[signerIndex];
  if (!signer) throw new Error(`no signer at index ${signerIndex}`);

  const [sharesDeployment, mcUSDDeployment, distributorDeployment, resolutionsDeployment] = await Promise.all([
    hre.deployments.get("CharterShares"),
    hre.deployments.get("MockConfidentialUSD"),
    hre.deployments.get("DividendDistributor"),
    hre.deployments.get("CharterResolutions"),
  ]);

  return {
    signer,
    shares: await hre.ethers.getContractAt("CharterShares", sharesDeployment.address, signer),
    sharesAddress: sharesDeployment.address,
    mcUSD: await hre.ethers.getContractAt("MockConfidentialUSD", mcUSDDeployment.address, signer),
    mcUSDAddress: mcUSDDeployment.address,
    distributor: await hre.ethers.getContractAt("DividendDistributor", distributorDeployment.address, signer),
    distributorAddress: distributorDeployment.address,
    resolutions: await hre.ethers.getContractAt("CharterResolutions", resolutionsDeployment.address, signer),
    resolutionsAddress: resolutionsDeployment.address,
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
      const c = await contracts(hre);
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
    const c = await contracts(hre);
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
      const c = await contracts(hre, Number(args.signer));
      const support = parseBool(args.support);
      const input = await hre.fhevm
        .createEncryptedInput(c.resolutionsAddress, c.signer.address)
        .addBool(support)
        .encrypt();
      await send("resolutions.castVote", c.resolutions.castVote(BigInt(args.id), input.handles[0], input.inputProof));
      console.log(`voted ${support ? "FOR" : "AGAINST"} on resolution ${args.id} from signer ${args.signer}`);
    }),
  );

task<{ id: string }>("scenario:settle", "Settle a resolution with public tally proof")
  .addParam("id", "Resolution id")
  .setAction((args, hre) =>
    run("scenario:settle", async () => {
      const c = await contracts(hre);
      const id = BigInt(args.id);
      let resolution = await c.resolutions.getResolution(id);
      if (!resolution.tallyRequested) {
        await send("resolutions.requestTally", c.resolutions.requestTally(id));
        resolution = await c.resolutions.getResolution(id);
      }
      const forHandle = resolution.forVotes as HexHandle;
      const againstHandle = resolution.againstVotes as HexHandle;
      const result = await hre.fhevm.publicDecrypt([forHandle, againstHandle]);
      const forClear = result.clearValues[forHandle];
      const againstClear = result.clearValues[againstHandle];
      if (typeof forClear !== "bigint" || typeof againstClear !== "bigint")
        throw new Error("oracle returned no tallies");
      await send("resolutions.settle", c.resolutions.settle(id, forClear, againstClear, result.decryptionProof));
      console.log(`settled resolution ${id}: ${forClear} FOR / ${againstClear} AGAINST`);
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
        `resolution #${i}: resolved=${r.resolved} passed=${r.passed} tallyRequested=${r.tallyRequested} deadline=${r.deadline} text="${r.description}"`,
      );
    }
  }),
);
