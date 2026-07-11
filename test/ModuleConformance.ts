import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ContractTransactionResponse, TransactionReceipt } from "ethers";
import { ethers, fhevm, network } from "hardhat";

import {
  CharterResolutionsV3,
  CharterShares,
  CharterShares__factory,
  ConfidentialTenderOffer,
  DividendDistributor,
  MockConfidentialUSD,
} from "../types";
import { CharterModuleConformanceFixture, describeCharterModuleConformance } from "../packages/conformance/src";

type BaseFixture = {
  admin: HardhatEthersSigner;
  holder: HardhatEthersSigner;
  otherHolder: HardhatEthersSigner;
  shares: CharterShares;
  sharesAddress: string;
};

async function waitForReceipt(tx: ContractTransactionResponse): Promise<TransactionReceipt> {
  const receipt = await tx.wait();
  if (receipt === null) {
    throw new Error("Conformance exercise transaction was not mined");
  }
  return receipt;
}

async function mintShares(
  shares: CharterShares,
  sharesAddress: string,
  admin: HardhatEthersSigner,
  recipient: string,
  amount: number,
): Promise<void> {
  const input = await fhevm.createEncryptedInput(sharesAddress, admin.address).add64(amount).encrypt();
  await (await shares["confidentialMint(address,bytes32,bytes)"](recipient, input.handles[0], input.inputProof)).wait();
}

async function deployBaseFixture(): Promise<BaseFixture> {
  if (!fhevm.isMock) {
    throw new Error("Charter module conformance runs on the Hardhat FHEVM mock only");
  }

  const [admin, holder, otherHolder] = await ethers.getSigners();
  const shares = await ((await ethers.getContractFactory("CharterShares")) as CharterShares__factory).deploy(
    "Conformance Registry",
    "CONF",
    "",
    admin.address,
  );
  await shares.waitForDeployment();
  const sharesAddress = await shares.getAddress();
  await (await shares.addAgent(admin.address)).wait();
  await mintShares(shares, sharesAddress, admin, holder.address, 100);
  await mintShares(shares, sharesAddress, admin, otherHolder.address, 50);

  return { admin, holder, otherHolder, shares, sharesAddress };
}

async function deployDividendFixture(): Promise<CharterModuleConformanceFixture> {
  const base = await deployBaseFixture();
  const paymentToken = (await (await ethers.getContractFactory("MockConfidentialUSD")).deploy()) as MockConfidentialUSD;
  await paymentToken.waitForDeployment();
  const paymentTokenAddress = await paymentToken.getAddress();
  const distributor = (await (
    await ethers.getContractFactory("DividendDistributor")
  ).deploy(base.sharesAddress)) as DividendDistributor;
  await distributor.waitForDeployment();
  const moduleAddress = await distributor.getAddress();
  await (await base.shares.setModule(moduleAddress, true)).wait();

  await (await base.shares.requestSupplyDisclosure()).wait();
  const supplyHandle = await base.shares.confidentialTotalSupply();
  const disclosure = await fhevm.publicDecrypt([supplyHandle]);
  await (
    await base.shares.finalizeSupplyDisclosure(
      disclosure.clearValues[supplyHandle as `0x${string}`] as bigint,
      disclosure.decryptionProof,
    )
  ).wait();

  await (await paymentToken.mint(base.admin.address, 1_000)).wait();
  const block = await ethers.provider.getBlock("latest");
  if (block === null) {
    throw new Error("Latest block was unavailable");
  }
  await (await paymentToken.setOperator(moduleAddress, block.timestamp + 1_000)).wait();
  await (await base.shares.pause()).wait();
  await (await distributor.declare(paymentTokenAddress, 150)).wait();

  return {
    registry: base.shares,
    admin: base.admin,
    moduleAddress,
    holderAddress: base.holder.address,
    accessHandle: await base.shares.confidentialBalanceOf(base.holder.address),
    otherHolderHandle: await base.shares.confidentialBalanceOf(base.otherHolder.address),
    accessPath: "balance",
    exercise: async () => waitForReceipt(await distributor.connect(base.holder).claim(0)),
  };
}

async function deployTenderFixture(): Promise<CharterModuleConformanceFixture> {
  const base = await deployBaseFixture();
  const paymentToken = (await (await ethers.getContractFactory("MockConfidentialUSD")).deploy()) as MockConfidentialUSD;
  await paymentToken.waitForDeployment();
  const paymentTokenAddress = await paymentToken.getAddress();
  const tender = (await (
    await ethers.getContractFactory("ConfidentialTenderOffer")
  ).deploy(base.sharesAddress)) as ConfidentialTenderOffer;
  await tender.waitForDeployment();
  const moduleAddress = await tender.getAddress();
  await (await base.shares.setModule(moduleAddress, true)).wait();

  await (await paymentToken.mint(base.admin.address, 1_000)).wait();
  const block = await ethers.provider.getBlock("latest");
  if (block === null) {
    throw new Error("Latest block was unavailable");
  }
  await (await paymentToken.setOperator(moduleAddress, block.timestamp + 1_000)).wait();
  await (await tender.openOffer(paymentTokenAddress, 1, 150, 100)).wait();

  return {
    registry: base.shares,
    admin: base.admin,
    moduleAddress,
    holderAddress: base.holder.address,
    accessHandle: await base.shares.confidentialBalanceOf(base.holder.address),
    otherHolderHandle: await base.shares.confidentialBalanceOf(base.otherHolder.address),
    accessPath: "balance",
    exercise: async () => {
      const input = await fhevm.createEncryptedInput(moduleAddress, base.holder.address).add64(25).encrypt();
      return waitForReceipt(await tender.connect(base.holder).tender(0, input.handles[0], input.inputProof));
    },
  };
}

async function deployResolutionsFixture(): Promise<CharterModuleConformanceFixture> {
  const base = await deployBaseFixture();
  await (await base.shares.connect(base.holder).delegate(base.holder.address)).wait();
  const resolutions = (await (
    await ethers.getContractFactory("CharterResolutionsV3")
  ).deploy(base.sharesAddress, 1)) as CharterResolutionsV3;
  await resolutions.waitForDeployment();
  const moduleAddress = await resolutions.getAddress();
  await (await base.shares.setModule(moduleAddress, true)).wait();
  await (await resolutions.propose("Conformance proposal", 100)).wait();
  const proposal = await resolutions.getResolution(0);
  await network.provider.send("hardhat_mine", ["0x1"]);

  return {
    registry: base.shares,
    admin: base.admin,
    moduleAddress,
    holderAddress: base.holder.address,
    accessHandle: await base.shares.getPastVotes(base.holder.address, proposal.snapshot),
    otherHolderHandle: await base.shares.confidentialBalanceOf(base.otherHolder.address),
    accessPath: "handle",
    exercise: async () => {
      const input = await fhevm.createEncryptedInput(moduleAddress, base.holder.address).addBool(true).encrypt();
      return waitForReceipt(await resolutions.connect(base.holder).castVote(0, input.handles[0], input.inputProof));
    },
  };
}

describeCharterModuleConformance("DividendDistributor", deployDividendFixture);
describeCharterModuleConformance("CharterResolutionsV3", deployResolutionsFixture);
describeCharterModuleConformance("ConfidentialTenderOffer", deployTenderFixture);
