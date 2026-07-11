import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { computeAddress, dataLength, dataSlice, keccak256, SigningKey, toBeHex, Wallet } from "ethers";
import { ethers, fhevm } from "hardhat";

import { CharterShares, MockERC5564Announcer, StealthIssuance } from "../types";

const SECP256K1_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

type StealthIdentity = {
  ephemeralPublicKey: string;
  ephemeralPublicKeyUncompressed: string;
  recipientResolvedAddress: string;
  recipientSigner: Wallet;
  spendingKeySigner: Wallet;
  stealthAddress: string;
  viewTag: string;
};

function deriveStealthIdentity(): StealthIdentity {
  const spendingKey = new SigningKey(Wallet.createRandom().privateKey);
  const viewingKey = new SigningKey(Wallet.createRandom().privateKey);

  while (true) {
    const ephemeralKey = new SigningKey(Wallet.createRandom().privateKey);
    const senderSharedSecret = SigningKey.computePublicKey(
      ephemeralKey.computeSharedSecret(viewingKey.compressedPublicKey),
      true,
    );
    const senderHash = keccak256(senderSharedSecret);
    const senderHashScalar = BigInt(senderHash);
    const stealthPrivateScalar = (BigInt(spendingKey.privateKey) + senderHashScalar) % SECP256K1_ORDER;

    if (senderHashScalar === 0n || senderHashScalar >= SECP256K1_ORDER || stealthPrivateScalar === 0n) {
      continue;
    }

    const senderStealthPublicKey = SigningKey.addPoints(
      spendingKey.compressedPublicKey,
      SigningKey.computePublicKey(senderHash, true),
      false,
    );
    const stealthAddress = computeAddress(senderStealthPublicKey);

    const recipientSharedSecret = SigningKey.computePublicKey(
      viewingKey.computeSharedSecret(ephemeralKey.compressedPublicKey),
      true,
    );
    const recipientHash = keccak256(recipientSharedSecret);
    const recipientHashScalar = BigInt(recipientHash);
    const recipientStealthPublicKey = SigningKey.addPoints(
      spendingKey.compressedPublicKey,
      SigningKey.computePublicKey(recipientHash, true),
      false,
    );
    const recipientPrivateScalar = (BigInt(spendingKey.privateKey) + recipientHashScalar) % SECP256K1_ORDER;

    return {
      ephemeralPublicKey: ephemeralKey.compressedPublicKey,
      ephemeralPublicKeyUncompressed: ephemeralKey.publicKey,
      recipientResolvedAddress: computeAddress(recipientStealthPublicKey),
      recipientSigner: new Wallet(toBeHex(recipientPrivateScalar, 32), ethers.provider),
      spendingKeySigner: new Wallet(spendingKey.privateKey, ethers.provider),
      stealthAddress,
      viewTag: dataSlice(senderHash, 0, 1),
    };
  }
}

describe("StealthIssuance identity privacy prototype", function () {
  let issuer: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;
  let shares: CharterShares;
  let sharesAddress: string;
  let announcer: MockERC5564Announcer;
  let issuance: StealthIssuance;
  let issuanceAddress: string;

  before(function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs on the FHEVM mock only");
      this.skip();
    }
  });

  beforeEach(async function () {
    [issuer, outsider] = await ethers.getSigners();

    const sharesFactory = await ethers.getContractFactory("CharterShares");
    shares = (await sharesFactory.deploy(
      "Charter Privacy Prototype",
      "CPP",
      "",
      issuer.address,
    )) as unknown as CharterShares;
    sharesAddress = await shares.getAddress();

    const announcerFactory = await ethers.getContractFactory("MockERC5564Announcer");
    announcer = (await announcerFactory.deploy()) as unknown as MockERC5564Announcer;

    const issuanceFactory = await ethers.getContractFactory("StealthIssuance");
    issuance = (await issuanceFactory.deploy(
      sharesAddress,
      await announcer.getAddress(),
    )) as unknown as StealthIssuance;
    issuanceAddress = await issuance.getAddress();

    await (await shares.setModule(issuanceAddress, true)).wait();
    await (await shares.addAgent(issuanceAddress)).wait();
  });

  async function encryptAmount(amount: bigint, signer: HardhatEthersSigner = issuer) {
    return fhevm.createEncryptedInput(issuanceAddress, signer.address).add64(amount).encrypt();
  }

  it("lets the recipient independently resolve and decrypt a scheme 1 stealth issuance", async function () {
    const identity = deriveStealthIdentity();
    expect(identity.recipientResolvedAddress).to.equal(identity.stealthAddress);
    expect(identity.recipientSigner.address).to.equal(identity.stealthAddress);

    const amount = 1_234n;
    const input = await encryptAmount(amount);
    const metadata = ethers.solidityPacked(
      ["bytes1", "bytes4", "address"],
      [identity.viewTag, issuance.interface.getFunction("issue").selector, sharesAddress],
    );
    expect(dataLength(metadata)).to.equal(25);

    await expect(
      issuance
        .connect(issuer)
        .issue(
          identity.stealthAddress,
          input.handles[0],
          input.inputProof,
          identity.ephemeralPublicKey,
          identity.viewTag,
        ),
    )
      .to.emit(announcer, "Announcement")
      .withArgs(1n, identity.stealthAddress, issuanceAddress, identity.ephemeralPublicKey, metadata);

    const balance = await shares.confidentialBalanceOf(identity.stealthAddress);
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, balance, sharesAddress, identity.recipientSigner)).to.equal(
      amount,
    );
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, balance, sharesAddress, identity.spendingKeySigner)).to.be
      .rejected;
  });

  it("validates the announcer, target, and ephemeral public-key encoding", async function () {
    const issuanceFactory = await ethers.getContractFactory("StealthIssuance");
    await expect(issuanceFactory.deploy(sharesAddress, ethers.ZeroAddress)).to.be.revertedWithCustomError(
      issuance,
      "StealthInvalidAnnouncer",
    );

    const identity = deriveStealthIdentity();
    const zeroTargetInput = await encryptAmount(1n);
    await expect(
      issuance
        .connect(issuer)
        .issue(
          ethers.ZeroAddress,
          zeroTargetInput.handles[0],
          zeroTargetInput.inputProof,
          identity.ephemeralPublicKey,
          identity.viewTag,
        ),
    ).to.be.revertedWithCustomError(issuance, "StealthInvalidTarget");

    const malformedKeyInput = await encryptAmount(1n);
    await expect(
      issuance
        .connect(issuer)
        .issue(
          identity.stealthAddress,
          malformedKeyInput.handles[0],
          malformedKeyInput.inputProof,
          "0x04",
          identity.viewTag,
        ),
    ).to.be.revertedWithCustomError(issuance, "StealthInvalidEphemeralPublicKey");

    const uncompressedKeyInput = await encryptAmount(1n);
    await expect(
      issuance
        .connect(issuer)
        .issue(
          identity.stealthAddress,
          uncompressedKeyInput.handles[0],
          uncompressedKeyInput.inputProof,
          identity.ephemeralPublicKeyUncompressed,
          identity.viewTag,
        ),
    ).to.emit(announcer, "Announcement");
  });

  it("rejects non-issuers, inactive modules, and a module without the agent role", async function () {
    const identity = deriveStealthIdentity();
    const outsiderInput = await encryptAmount(1n, outsider);
    await expect(
      issuance
        .connect(outsider)
        .issue(
          identity.stealthAddress,
          outsiderInput.handles[0],
          outsiderInput.inputProof,
          identity.ephemeralPublicKey,
          identity.viewTag,
        ),
    ).to.be.revertedWithCustomError(issuance, "StealthNotIssuer");

    await (await shares.setModule(issuanceAddress, false)).wait();
    const inactiveInput = await encryptAmount(1n);
    await expect(
      issuance
        .connect(issuer)
        .issue(
          identity.stealthAddress,
          inactiveInput.handles[0],
          inactiveInput.inputProof,
          identity.ephemeralPublicKey,
          identity.viewTag,
        ),
    ).to.be.revertedWithCustomError(issuance, "StealthModuleNotActive");

    await (await shares.setModule(issuanceAddress, true)).wait();
    await (await shares.removeAgent(issuanceAddress)).wait();
    const unprivilegedInput = await encryptAmount(1n);
    await expect(
      issuance
        .connect(issuer)
        .issue(
          identity.stealthAddress,
          unprivilegedInput.handles[0],
          unprivilegedInput.inputProof,
          identity.ephemeralPublicKey,
          identity.viewTag,
        ),
    ).to.be.reverted;
  });

  it("rolls the mint back when the announcer reverts", async function () {
    const identity = deriveStealthIdentity();
    await (await announcer.setShouldRevert(true)).wait();

    const input = await encryptAmount(1_234n);
    await expect(
      issuance
        .connect(issuer)
        .issue(
          identity.stealthAddress,
          input.handles[0],
          input.inputProof,
          identity.ephemeralPublicKey,
          identity.viewTag,
        ),
    ).to.be.revertedWithCustomError(announcer, "MockAnnouncerForcedFailure");

    expect(await shares.confidentialBalanceOf(identity.stealthAddress)).to.equal(ethers.ZeroHash);
    expect(await shares.confidentialTotalSupply()).to.equal(ethers.ZeroHash);
    expect(await shares.supplyVersion()).to.equal(0n);
    expect(await shares.ledgerVersion()).to.equal(0n);
  });
});
