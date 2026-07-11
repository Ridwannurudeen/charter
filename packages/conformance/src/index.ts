import { FhevmType } from "@fhevm/hardhat-plugin";
import { impersonateAccount, setBalance, stopImpersonatingAccount } from "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers/types";
import type { CharterShares } from "@charter/core";
import { expect } from "chai";
import type { Log, Signer, TransactionReceipt } from "ethers";
import { Contract } from "ethers";
import { ethers, fhevm } from "hardhat";

const ACL_ABI = [
  "function isAllowed(bytes32 handle, address account) view returns (bool)",
  "function persistAllowed(bytes32 handle, address account) view returns (bool)",
  "function isAllowedForDecryption(bytes32 handle) view returns (bool)",
  "event Allowed(address indexed caller, address indexed account, bytes32 handle)",
  "event AllowedForDecryption(address indexed caller, bytes32[] handlesList)",
] as const;

const EXECUTOR_ABI = [
  "error ACLNotAllowed(bytes32 handle, address account)",
  "function cast(bytes32 ciphertext, uint8 toType) returns (bytes32)",
] as const;

export type CharterModuleAccessPath = "balance" | "handle";

export type CharterModuleConformanceFixture = {
  registry: CharterShares;
  admin: Signer;
  moduleAddress: string;
  holderAddress: string;
  accessHandle: string;
  otherHolderHandle: string;
  accessPath: CharterModuleAccessPath;
  exercise: () => Promise<TransactionReceipt>;
};

export type CharterModuleConformanceFactory = () => Promise<CharterModuleConformanceFixture>;

type RuntimeContracts = {
  acl: Contract;
  executorAddress: string;
};

function normalizeAddress(address: string): string {
  return ethers.getAddress(address).toLowerCase();
}

function normalizeHandle(handle: string, field: string): string {
  if (!ethers.isHexString(handle, 32)) {
    throw new Error(`${field} must be a 32-byte hexadecimal FHE handle`);
  }
  return handle.toLowerCase();
}

async function validateFixture(fixture: CharterModuleConformanceFixture): Promise<void> {
  const registryAddress = await fixture.registry.getAddress();
  const moduleAddress = normalizeAddress(fixture.moduleAddress);
  const accessHandle = normalizeHandle(fixture.accessHandle, "accessHandle");
  const otherHolderHandle = normalizeHandle(fixture.otherHolderHandle, "otherHolderHandle");

  if (moduleAddress === normalizeAddress(registryAddress)) {
    throw new Error("moduleAddress must not be the registry address");
  }
  if (accessHandle === otherHolderHandle) {
    throw new Error("otherHolderHandle must identify a different holder's balance");
  }
  if (!(await fixture.registry.isModule(fixture.moduleAddress))) {
    throw new Error("factoryFn must return a registered module");
  }
}

async function getRuntimeContracts(fixture: CharterModuleConformanceFixture): Promise<RuntimeContracts> {
  const registryAddress = await fixture.registry.getAddress();
  const config = await fhevm.getCoprocessorConfig(registryAddress);
  return {
    acl: new Contract(config.ACLAddress, ACL_ABI, ethers.provider),
    executorAddress: config.CoprocessorAddress,
  };
}

async function startModuleImpersonation(moduleAddress: string): Promise<Signer> {
  await impersonateAccount(moduleAddress);
  await setBalance(moduleAddress, ethers.parseEther("1"));
  return ethers.getSigner(moduleAddress);
}

async function expectHandleUseRejected(
  executorAddress: string,
  moduleSigner: Signer,
  moduleAddress: string,
  handle: string,
): Promise<void> {
  const executor = new Contract(executorAddress, EXECUTOR_ABI, moduleSigner);
  await expect(executor.cast(handle, FhevmType.euint64))
    .to.be.revertedWithCustomError(executor, "ACLNotAllowed")
    .withArgs(handle, moduleAddress);
}

function coprocessorEventUsesHandle(receipt: TransactionReceipt, moduleAddress: string, handle: string): boolean {
  const normalizedModule = normalizeAddress(moduleAddress);
  const normalizedHandle = normalizeHandle(handle, "accessHandle");

  return fhevm.parseCoprocessorEvents([...receipt.logs]).some((event) => {
    const args = Array.from(event.args as unknown as readonly unknown[]);
    const caller = args[0];
    return (
      typeof caller === "string" &&
      normalizeAddress(caller) === normalizedModule &&
      args.some((value) => typeof value === "string" && value.toLowerCase() === normalizedHandle)
    );
  });
}

function findProtectedAclLeaks(acl: Contract, logs: readonly Log[], protectedHandles: ReadonlySet<string>): string[] {
  const aclAddress = normalizeAddress(String(acl.target));
  const leaks: string[] = [];

  for (const log of logs) {
    if (normalizeAddress(log.address) !== aclAddress) {
      continue;
    }
    const parsed = acl.interface.parseLog(log);
    if (parsed?.name === "Allowed") {
      const handle = String(parsed.args.handle).toLowerCase();
      if (protectedHandles.has(handle)) {
        leaks.push(`persistent allowance for ${handle}`);
      }
    }
    if (parsed?.name === "AllowedForDecryption") {
      for (const value of parsed.args.handlesList as readonly string[]) {
        const handle = value.toLowerCase();
        if (protectedHandles.has(handle)) {
          leaks.push(`public decryption allowance for ${handle}`);
        }
      }
    }
  }

  return leaks;
}

export function describeCharterModuleConformance(name: string, factoryFn: CharterModuleConformanceFactory): void {
  describe(`${name} Charter module conformance`, function () {
    it("(a) rejects FHE use of a protected holder handle without an explicit grant", async function () {
      const fixture = await factoryFn();
      await validateFixture(fixture);
      const { acl, executorAddress } = await getRuntimeContracts(fixture);

      expect(await acl.isAllowed(fixture.accessHandle, fixture.moduleAddress)).to.equal(false);

      const moduleSigner = await startModuleImpersonation(fixture.moduleAddress);
      try {
        await expectHandleUseRejected(executorAddress, moduleSigner, fixture.moduleAddress, fixture.accessHandle);
      } finally {
        await stopImpersonatingAccount(fixture.moduleAddress);
      }
    });

    it("(b) limits the grant to the requested handle and the granting transaction", async function () {
      const fixture = await factoryFn();
      await validateFixture(fixture);
      const { acl, executorAddress } = await getRuntimeContracts(fixture);

      const receipt = await fixture.exercise();
      expect(
        coprocessorEventUsesHandle(receipt, fixture.moduleAddress, fixture.accessHandle),
        "exercise() did not perform an FHE operation on accessHandle",
      ).to.equal(true);
      expect(await acl.persistAllowed(fixture.accessHandle, fixture.moduleAddress)).to.equal(false);
      expect(await acl.isAllowed(fixture.accessHandle, fixture.moduleAddress)).to.equal(false);
      expect(await acl.isAllowed(fixture.otherHolderHandle, fixture.moduleAddress)).to.equal(false);

      const moduleSigner = await startModuleImpersonation(fixture.moduleAddress);
      try {
        await expectHandleUseRejected(executorAddress, moduleSigner, fixture.moduleAddress, fixture.accessHandle);
        await expectHandleUseRejected(executorAddress, moduleSigner, fixture.moduleAddress, fixture.otherHolderHandle);
      } finally {
        await stopImpersonatingAccount(fixture.moduleAddress);
      }
    });

    it("(c) does not gain agent or administrator rights through registration", async function () {
      const fixture = await factoryFn();
      await validateFixture(fixture);

      expect(await fixture.registry.isAgent(fixture.moduleAddress)).to.equal(false);
      expect(await fixture.registry.isAdmin(fixture.moduleAddress)).to.equal(false);

      const moduleSigner = await startModuleImpersonation(fixture.moduleAddress);
      try {
        const registryAsModule = fixture.registry.connect(moduleSigner);
        await expect(registryAsModule.addAgent(fixture.moduleAddress)).to.be.reverted;
        await expect(registryAsModule.grantRole(await fixture.registry.DEFAULT_ADMIN_ROLE(), fixture.moduleAddress)).to
          .be.reverted;
      } finally {
        await stopImpersonatingAccount(fixture.moduleAddress);
      }

      expect(await fixture.registry.isAgent(fixture.moduleAddress)).to.equal(false);
      expect(await fixture.registry.isAdmin(fixture.moduleAddress)).to.equal(false);
    });

    it("(d) rejects new grants through the module's access path after it is unregistered", async function () {
      const fixture = await factoryFn();
      await validateFixture(fixture);
      const { acl } = await getRuntimeContracts(fixture);

      await (await fixture.registry.connect(fixture.admin).setModule(fixture.moduleAddress, false)).wait();
      expect(await fixture.registry.isModule(fixture.moduleAddress)).to.equal(false);

      const moduleSigner = await startModuleImpersonation(fixture.moduleAddress);
      try {
        const registryAsModule = fixture.registry.connect(moduleSigner);
        if (fixture.accessPath === "balance") {
          await expect(registryAsModule.allowBalanceAccess(fixture.holderAddress)).to.be.revertedWithCustomError(
            fixture.registry,
            "CharterNotModule",
          );
        } else {
          await expect(
            registryAsModule.getHandleAllowance(fixture.accessHandle, fixture.moduleAddress, false),
          ).to.be.revertedWithCustomError(fixture.registry, "HandleAccessManagerNotAllowed");
        }
      } finally {
        await stopImpersonatingAccount(fixture.moduleAddress);
      }

      await expect(fixture.exercise()).to.be.rejected;
      expect(await acl.persistAllowed(fixture.accessHandle, fixture.moduleAddress)).to.equal(false);
      expect(await acl.isAllowed(fixture.accessHandle, fixture.moduleAddress)).to.equal(false);
    });

    it("(e) does not make another holder's handle publicly decryptable", async function () {
      const fixture = await factoryFn();
      await validateFixture(fixture);
      const { acl } = await getRuntimeContracts(fixture);
      const protectedHandles = new Set([
        normalizeHandle(fixture.accessHandle, "accessHandle"),
        normalizeHandle(fixture.otherHolderHandle, "otherHolderHandle"),
      ]);

      for (const handle of protectedHandles) {
        expect(await acl.isAllowedForDecryption(handle)).to.equal(false);
        await expect(fhevm.publicDecrypt([handle])).to.be.rejected;
      }

      const receipt = await fixture.exercise();
      expect(
        findProtectedAclLeaks(acl, receipt.logs, protectedHandles),
        "protected handle ACL leak detected",
      ).to.deep.equal([]);

      for (const handle of protectedHandles) {
        expect(await acl.isAllowedForDecryption(handle)).to.equal(false);
        await expect(fhevm.publicDecrypt([handle])).to.be.rejected;
      }
    });
  });
}
