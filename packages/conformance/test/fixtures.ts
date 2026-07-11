import { deployCharterRegistry } from "@gudman/charter-core";
import type { ContractTransactionResponse } from "ethers";
import { ethers, fhevm } from "hardhat";

import type { CharterModuleConformanceFixture } from "../src";

type ProbeKind = "honest" | "leaky";

async function mintShares(
  registryAddress: string,
  recipient: string,
  amount: number,
  issuerAddress: string,
): Promise<void> {
  const registry = await ethers.getContractAt("CharterShares", registryAddress);
  const input = await fhevm.createEncryptedInput(registryAddress, issuerAddress).add64(amount).encrypt();
  await (
    await registry["confidentialMint(address,bytes32,bytes)"](recipient, input.handles[0], input.inputProof)
  ).wait();
}

async function deployProbeFixture(kind: ProbeKind): Promise<CharterModuleConformanceFixture> {
  if (!fhevm.isMock) {
    throw new Error("The conformance fixtures require the Hardhat FHEVM mock network");
  }

  const [admin, holder, otherHolder] = await ethers.getSigners();
  const registry = await deployCharterRegistry(admin, {
    name: "Conformance Registry",
    symbol: "CONF",
  });
  const registryAddress = await registry.getAddress();

  await mintShares(registryAddress, holder.address, 100, admin.address);
  await mintShares(registryAddress, otherHolder.address, 50, admin.address);

  const contractName = kind === "honest" ? "HonestBalanceAccessProbe" : "PublicDecryptLeakingProbe";
  const probe = await (await ethers.getContractFactory(contractName, admin)).deploy(registryAddress);
  await probe.waitForDeployment();
  const moduleAddress = await probe.getAddress();
  await (await registry.setModule(moduleAddress, true)).wait();

  const accessHandle = await registry.confidentialBalanceOf(holder.address);
  const otherHolderHandle = await registry.confidentialBalanceOf(otherHolder.address);

  return {
    registry,
    admin,
    moduleAddress,
    holderAddress: holder.address,
    accessHandle,
    otherHolderHandle,
    accessPath: "balance",
    exercise: async () => {
      const tx = (
        kind === "honest"
          ? await probe.inspect(holder.address)
          : await probe.inspect(holder.address, otherHolder.address)
      ) as ContractTransactionResponse;
      const receipt = await tx.wait();
      if (receipt === null) {
        throw new Error("Probe transaction was not mined");
      }
      return receipt;
    },
  };
}

export function deployHonestFixture(): Promise<CharterModuleConformanceFixture> {
  return deployProbeFixture("honest");
}

export function deployLeakyFixture(): Promise<CharterModuleConformanceFixture> {
  return deployProbeFixture("leaky");
}
