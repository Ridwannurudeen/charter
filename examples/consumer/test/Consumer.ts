import { deployCharterRegistry } from "@charter/core";
import type { CharterShares } from "@charter/core";
import { describeCharterModuleConformance, type CharterModuleConformanceFixture } from "@charter/conformance";
import { expect } from "chai";
import type { ContractTransactionResponse } from "ethers";
import { Contract } from "ethers";
import { ethers, fhevm } from "hardhat";

const MODULE_ABI = ["function attest(address holder)", "function myAttestation() view returns (bytes32)"] as const;

async function mintShares(
  registry: CharterShares,
  issuerAddress: string,
  recipientAddress: string,
  amount: number,
): Promise<void> {
  const registryAddress = await registry.getAddress();
  const input = await fhevm.createEncryptedInput(registryAddress, issuerAddress).add64(amount).encrypt();
  await (
    await registry["confidentialMint(address,bytes32,bytes)"](recipientAddress, input.handles[0], input.inputProof)
  ).wait();
}

async function deployConsumerFixture(): Promise<CharterModuleConformanceFixture> {
  if (!fhevm.isMock) {
    throw new Error("The standalone consumer test requires the Hardhat FHEVM mock network");
  }

  const [admin, holder, otherHolder] = await ethers.getSigners();
  const registry = await deployCharterRegistry(admin, {
    name: "Independent Consumer Registry",
    symbol: "ICR",
  });
  const registryAddress = await registry.getAddress();

  await mintShares(registry, admin.address, holder.address, 100);
  await mintShares(registry, admin.address, otherHolder.address, 50);

  const factory = await ethers.getContractFactory("BalanceAttestationModule", admin);
  const deployedModule = await factory.deploy(registryAddress);
  await deployedModule.waitForDeployment();
  const moduleAddress = await deployedModule.getAddress();
  const module = new Contract(moduleAddress, MODULE_ABI, admin);
  await (await registry.setModule(moduleAddress, true)).wait();

  return {
    registry,
    admin,
    moduleAddress,
    holderAddress: holder.address,
    accessHandle: await registry.confidentialBalanceOf(holder.address),
    otherHolderHandle: await registry.confidentialBalanceOf(otherHolder.address),
    accessPath: "balance",
    exercise: async () => {
      const tx = (await module.attest(holder.address)) as ContractTransactionResponse;
      const receipt = await tx.wait();
      if (receipt === null) {
        throw new Error("Attestation transaction was not mined");
      }
      return receipt;
    },
  };
}

describe("standalone Charter consumer", function () {
  it("persists a holder-decryptable attestation without making it public", async function () {
    const fixture = await deployConsumerFixture();
    await fixture.exercise();

    const holder = await ethers.getSigner(fixture.holderAddress);
    const module = new Contract(fixture.moduleAddress, MODULE_ABI, holder);
    const attestationHandle = (await module.myAttestation()) as string;

    expect(await fhevm.userDecryptEbool(attestationHandle, fixture.moduleAddress, holder)).to.equal(true);
    await expect(fhevm.publicDecrypt([attestationHandle])).to.be.rejected;
  });
});

describeCharterModuleConformance("BalanceAttestationModule", deployConsumerFixture);
