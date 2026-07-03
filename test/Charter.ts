import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm, network } from "hardhat";

import {
  CharterResolutions,
  CharterResolutions__factory,
  CharterResolutionsV2,
  CharterShares,
  CharterShares__factory,
  DemoShareFaucet,
  DemoShareFaucet__factory,
  DividendDistributor,
  DividendDistributor__factory,
  MockConfidentialUSD,
  MockConfidentialUSD__factory,
} from "../types";

type Signers = {
  issuer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
  dave: HardhatEthersSigner;
  auditor: HardhatEthersSigner;
  erin: HardhatEthersSigner;
};

const ALICE_SHARES = 500_000;
const BOB_SHARES = 300_000;
const CAROL_SHARES = 200_000;
const AUDITOR_EXTRA_SHARES = 1_000;
const TOTAL_SHARES = ALICE_SHARES + BOB_SHARES + CAROL_SHARES;
const POOL = 10_000_000_000n; // 10,000 mcUSD (6 decimals)

describe("Charter", function () {
  let signers: Signers;
  let shares: CharterShares;
  let sharesAddress: string;
  let mcUSD: MockConfidentialUSD;
  let mcUSDAddress: string;
  let distributor: DividendDistributor;
  let distributorAddress: string;
  let resolutions: CharterResolutions;
  let resolutionsAddress: string;
  let demoFaucet: DemoShareFaucet;
  let demoFaucetAddress: string;

  before(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs on the FHEVM mock only");
      this.skip();
    }
    const ethSigners = await ethers.getSigners();
    signers = {
      issuer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      carol: ethSigners[3],
      dave: ethSigners[4],
      auditor: ethSigners[5],
      erin: ethSigners[6],
    };

    shares = await ((await ethers.getContractFactory("CharterShares")) as CharterShares__factory).deploy(
      "Charter Demo Corp",
      "CDC-S",
      "",
      signers.issuer.address,
    );
    sharesAddress = await shares.getAddress();

    mcUSD = await ((await ethers.getContractFactory("MockConfidentialUSD")) as MockConfidentialUSD__factory).deploy();
    mcUSDAddress = await mcUSD.getAddress();

    distributor = await (
      (await ethers.getContractFactory("DividendDistributor")) as DividendDistributor__factory
    ).deploy(sharesAddress);
    distributorAddress = await distributor.getAddress();

    resolutions = await ((await ethers.getContractFactory("CharterResolutions")) as CharterResolutions__factory).deploy(
      sharesAddress,
    );
    resolutionsAddress = await resolutions.getAddress();

    demoFaucet = await ((await ethers.getContractFactory("DemoShareFaucet")) as DemoShareFaucet__factory).deploy(
      sharesAddress,
    );
    demoFaucetAddress = await demoFaucet.getAddress();

    await (await shares.setModule(distributorAddress, true)).wait();
    await (await shares.setModule(resolutionsAddress, true)).wait();
    await (await shares.addAgent(signers.issuer.address)).wait();
    await (await shares.addAgent(demoFaucetAddress)).wait();
  });

  async function mintShares(to: HardhatEthersSigner, amount: number) {
    const input = await fhevm.createEncryptedInput(sharesAddress, signers.issuer.address).add64(amount).encrypt();
    const tx = await shares
      .connect(signers.issuer)
      ["confidentialMint(address,bytes32,bytes)"](to.address, input.handles[0], input.inputProof);
    await tx.wait();
  }

  async function decryptSharesOf(holder: HardhatEthersSigner, as?: HardhatEthersSigner) {
    const handle = await shares.confidentialBalanceOf(holder.address);
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, sharesAddress, as ?? holder);
  }

  async function decryptUSDOf(holder: HardhatEthersSigner) {
    const handle = await mcUSD.confidentialBalanceOf(holder.address);
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, mcUSDAddress, holder);
  }

  describe("issuance", function () {
    it("agent mints encrypted share allocations to investors", async function () {
      await mintShares(signers.alice, ALICE_SHARES);
      await mintShares(signers.bob, BOB_SHARES);
      await mintShares(signers.carol, CAROL_SHARES);

      expect(await decryptSharesOf(signers.alice)).to.eq(ALICE_SHARES);
      expect(await decryptSharesOf(signers.bob)).to.eq(BOB_SHARES);
      expect(await decryptSharesOf(signers.carol)).to.eq(CAROL_SHARES);
    });

    it("an investor cannot decrypt another investor's holding", async function () {
      await expect(decryptSharesOf(signers.alice, signers.bob)).to.be.rejected;
    });

    it("non-agent cannot mint", async function () {
      const input = await fhevm.createEncryptedInput(sharesAddress, signers.bob.address).add64(1).encrypt();
      await expect(
        shares
          .connect(signers.bob)
          ["confidentialMint(address,bytes32,bytes)"](signers.bob.address, input.handles[0], input.inputProof),
      ).to.be.reverted;
    });

    it("investors self-delegate to activate voting checkpoints", async function () {
      for (const s of [signers.alice, signers.bob, signers.carol]) {
        await (await shares.connect(s).delegate(s.address)).wait();
      }
      expect(await shares.delegates(signers.alice.address)).to.eq(signers.alice.address);
    });
  });

  describe("supply disclosure", function () {
    it("discloses total issued shares through the oracle with an on-chain proof", async function () {
      await (await shares.requestSupplyDisclosure()).wait();

      const supplyHandle = await shares.confidentialTotalSupply();
      const result = await fhevm.publicDecrypt([supplyHandle]);
      const clearSupply = result.clearValues[supplyHandle as `0x${string}`] as bigint;
      expect(clearSupply).to.eq(TOTAL_SHARES);

      await (await shares.finalizeSupplyDisclosure(clearSupply, result.decryptionProof)).wait();
      expect(await shares.totalSharesOnRecord()).to.eq(TOTAL_SHARES);
    });

    it("rejects a forged cleartext", async function () {
      await (await shares.requestSupplyDisclosure()).wait();
      const supplyHandle = await shares.confidentialTotalSupply();
      const result = await fhevm.publicDecrypt([supplyHandle]);
      await expect(shares.finalizeSupplyDisclosure(123456n, result.decryptionProof)).to.be.reverted;
      // clean up: finalize honestly
      const clearSupply = result.clearValues[supplyHandle as `0x${string}`] as bigint;
      await (await shares.finalizeSupplyDisclosure(clearSupply, result.decryptionProof)).wait();
    });
  });

  describe("distributions", function () {
    it("issuer funds treasury and approves the distributor", async function () {
      await (await mcUSD.mint(signers.issuer.address, 2n * POOL)).wait();
      const until = (await ethers.provider.getBlock("latest"))!.timestamp + 1_000_000;
      await (await mcUSD.connect(signers.issuer).setOperator(distributorAddress, until)).wait();
      expect(await mcUSD.isOperator(signers.issuer.address, distributorAddress)).to.eq(true);
    });

    it("requires shares to be paused before declaring a distribution", async function () {
      await expect(distributor.declare(mcUSDAddress, POOL)).to.be.revertedWithCustomError(
        distributor,
        "DistributorSharesNotPaused",
      );
    });

    it("issuer declares a distribution at the record-date pause", async function () {
      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, POOL)).wait();
      const d = await distributor.getDistribution(0);
      expect(d.pool).to.eq(POOL);
      expect(d.totalShares).to.eq(TOTAL_SHARES);
    });

    it("refuses to pay while share transfers are live (no record date)", async function () {
      await (await shares.unpause()).wait();
      await expect(distributor.payBatch(0, [signers.alice.address])).to.be.revertedWithCustomError(
        distributor,
        "DistributorSharesNotPaused",
      );
    });

    it("pays each investor their exact pro-rata cut, encrypted", async function () {
      await (await shares.pause()).wait();
      await (await distributor.payBatch(0, [signers.alice.address, signers.bob.address, signers.carol.address])).wait();
      await (await shares.unpause()).wait();

      expect(await decryptUSDOf(signers.alice)).to.eq((POOL * BigInt(ALICE_SHARES)) / BigInt(TOTAL_SHARES));
      expect(await decryptUSDOf(signers.bob)).to.eq((POOL * BigInt(BOB_SHARES)) / BigInt(TOTAL_SHARES));
      expect(await decryptUSDOf(signers.carol)).to.eq((POOL * BigInt(CAROL_SHARES)) / BigInt(TOTAL_SHARES));
    });

    it("cannot pay the same investor twice", async function () {
      await (await shares.pause()).wait();
      await expect(distributor.payBatch(0, [signers.alice.address])).to.be.revertedWithCustomError(
        distributor,
        "DistributorAlreadyPaid",
      );
      await (await shares.unpause()).wait();
    });

    it("non-issuer cannot declare or pay", async function () {
      await expect(distributor.connect(signers.bob).declare(mcUSDAddress, POOL)).to.be.revertedWithCustomError(
        distributor,
        "DistributorNotIssuer",
      );
    });

    it("rejects a stale disclosed supply after new issuance", async function () {
      await mintShares(signers.auditor, AUDITOR_EXTRA_SHARES);
      expect(await shares.supplyDisclosureStale()).to.eq(true);

      await (await shares.pause()).wait();
      await expect(distributor.declare(mcUSDAddress, 1n)).to.be.revertedWithCustomError(
        distributor,
        "DistributorStaleSupply",
      );
      await (await shares.unpause()).wait();

      await (await shares.requestSupplyDisclosure()).wait();
      const supplyHandle = await shares.confidentialTotalSupply();
      const result = await fhevm.publicDecrypt([supplyHandle]);
      const clearSupply = result.clearValues[supplyHandle as `0x${string}`] as bigint;
      expect(clearSupply).to.eq(TOTAL_SHARES + AUDITOR_EXTRA_SHARES);

      await (await shares.finalizeSupplyDisclosure(clearSupply, result.decryptionProof)).wait();
      expect(await shares.supplyDisclosureStale()).to.eq(false);
    });
  });

  describe("resolutions", function () {
    let resolutionId: bigint;

    it("issuer proposes a resolution", async function () {
      const tx = await resolutions.propose("Approve the Series A financing", 100);
      await tx.wait();
      resolutionId = (await resolutions.resolutionCount()) - 1n;
      const r = await resolutions.getResolution(resolutionId);
      expect(r.description).to.eq("Approve the Series A financing");
    });

    it("shareholders cast encrypted votes weighted by hidden holdings", async function () {
      const vote = async (voter: HardhatEthersSigner, support: boolean) => {
        const input = await fhevm.createEncryptedInput(resolutionsAddress, voter.address).addBool(support).encrypt();
        await (await resolutions.connect(voter).castVote(resolutionId, input.handles[0], input.inputProof)).wait();
      };
      await vote(signers.alice, true); // 500k FOR
      await vote(signers.bob, false); // 300k AGAINST
      await vote(signers.carol, true); // 200k FOR
    });

    it("rejects double votes and voters without checkpointed power", async function () {
      const input = await fhevm.createEncryptedInput(resolutionsAddress, signers.alice.address).addBool(true).encrypt();
      await expect(
        resolutions.connect(signers.alice).castVote(resolutionId, input.handles[0], input.inputProof),
      ).to.be.revertedWithCustomError(resolutions, "ResolutionsAlreadyVoted");

      const daveInput = await fhevm
        .createEncryptedInput(resolutionsAddress, signers.dave.address)
        .addBool(true)
        .encrypt();
      await expect(
        resolutions.connect(signers.dave).castVote(resolutionId, daveInput.handles[0], daveInput.inputProof),
      ).to.be.revertedWithCustomError(resolutions, "ResolutionsNoVotingPower");
    });

    it("settles with a publicly proven outcome after the deadline", async function () {
      await network.provider.send("hardhat_mine", ["0x80"]); // past the 100-block deadline

      await (await resolutions.requestTally(resolutionId)).wait();
      const r = await resolutions.getResolution(resolutionId);
      await expect(fhevm.publicDecrypt([r.forVotes])).to.be.rejected;
      await expect(fhevm.publicDecrypt([r.againstVotes])).to.be.rejected;

      const result = await fhevm.publicDecrypt([r.passedHandle]);
      const passed = result.clearValues[r.passedHandle as `0x${string}`] as boolean;
      expect(passed).to.eq(true);

      await (await resolutions.settle(resolutionId, passed, result.decryptionProof)).wait();
      const settled = await resolutions.getResolution(resolutionId);
      expect(settled.resolved).to.eq(true);
      expect(settled.passed).to.eq(true);
    });
  });

  describe("resolutions v2 quorum", function () {
    let v2: CharterResolutionsV2;
    let v2Address: string;

    before(async function () {
      // The quorum module is registered live through the same share token's module registry —
      // no share-token redeploy — exactly as it is swapped in on Sepolia.
      const factory = await ethers.getContractFactory("CharterResolutionsV2");
      v2 = (await factory.deploy(sharesAddress, 3)) as unknown as CharterResolutionsV2;
      v2Address = await v2.getAddress();
      await (await shares.setModule(v2Address, true)).wait();
    });

    const voteOn = async (id: bigint, voter: HardhatEthersSigner, support: boolean) => {
      const input = await fhevm.createEncryptedInput(v2Address, voter.address).addBool(support).encrypt();
      await (await v2.connect(voter).castVote(id, input.handles[0], input.inputProof)).wait();
    };

    it("reaches quorum with enough voters and settles the outcome", async function () {
      await (await v2.propose("Approve the employee option pool", 20)).wait();
      const id = (await v2.resolutionCount()) - 1n;
      await voteOn(id, signers.alice, true); // 500k FOR
      await voteOn(id, signers.bob, false); // 300k AGAINST
      await voteOn(id, signers.carol, true); // 200k FOR

      await network.provider.send("hardhat_mine", ["0x20"]);
      await (await v2.requestTally(id)).wait();
      const r = await v2.getResolution(id);
      expect(r.quorumReached).to.eq(true);

      const result = await fhevm.publicDecrypt([r.passedHandle]);
      const passed = result.clearValues[r.passedHandle as `0x${string}`] as boolean;
      expect(passed).to.eq(true); // 700k FOR vs 300k AGAINST
      await (await v2.settle(id, passed, result.decryptionProof)).wait();
      expect((await v2.getResolution(id)).passed).to.eq(true);
    });

    it("fails a resolution below quorum without disclosing any tally", async function () {
      await (await v2.propose("Sub-quorum resolution", 20)).wait();
      const id = (await v2.resolutionCount()) - 1n;
      await voteOn(id, signers.alice, true);
      await voteOn(id, signers.bob, true); // only 2 voters, quorum is 3

      await network.provider.send("hardhat_mine", ["0x20"]);
      await (await v2.requestTally(id)).wait();
      const r = await v2.getResolution(id);
      expect(r.quorumReached).to.eq(false);
      expect(r.resolved).to.eq(true);
      expect(r.passed).to.eq(false);
      await expect(v2.settle(id, true, "0x")).to.be.revertedWithCustomError(v2, "ResolutionsQuorumNotReached");
    });
  });

  describe("auditor observer access", function () {
    it("a holder appoints an observer who can then decrypt their balance", async function () {
      await expect(decryptSharesOf(signers.alice, signers.auditor)).to.be.rejected;
      await (await shares.connect(signers.alice).setObserver(signers.alice.address, signers.auditor.address)).wait();
      expect(await decryptSharesOf(signers.alice, signers.auditor)).to.eq(ALICE_SHARES);
    });

    it("only the account itself can appoint its observer", async function () {
      await expect(shares.connect(signers.bob).setObserver(signers.alice.address, signers.bob.address)).to.be.reverted;
    });
  });

  describe("compliance controls", function () {
    it("blocked investors cannot transfer", async function () {
      await (await shares.blockUser(signers.bob.address)).wait();
      const input = await fhevm.createEncryptedInput(sharesAddress, signers.bob.address).add64(1).encrypt();
      await expect(
        shares
          .connect(signers.bob)
          ["confidentialTransfer(address,bytes32,bytes)"](signers.alice.address, input.handles[0], input.inputProof),
      ).to.be.reverted;
      await (await shares.unblockUser(signers.bob.address)).wait();
    });

    it("agent can force-transfer shares (court order / recovery)", async function () {
      const amount = 10_000;
      const input = await fhevm.createEncryptedInput(sharesAddress, signers.issuer.address).add64(amount).encrypt();
      await (
        await shares["forceConfidentialTransferFrom(address,address,bytes32,bytes)"](
          signers.carol.address,
          signers.dave.address,
          input.handles[0],
          input.inputProof,
        )
      ).wait();
      expect(await decryptSharesOf(signers.dave)).to.eq(amount);
      expect(await decryptSharesOf(signers.carol)).to.eq(CAROL_SHARES - amount);
    });

    it("non-module callers cannot read balance handles", async function () {
      await expect(shares.connect(signers.bob).allowBalanceAccess(signers.alice.address)).to.be.revertedWithCustomError(
        shares,
        "CharterNotModule",
      );
    });
  });

  describe("demo share faucet", function () {
    it("lets a wallet claim encrypted demo shares once", async function () {
      await (await demoFaucet.connect(signers.erin).claim()).wait();
      expect(await decryptSharesOf(signers.erin)).to.eq(1000);
      await expect(demoFaucet.connect(signers.erin).claim()).to.be.revertedWithCustomError(
        demoFaucet,
        "AlreadyClaimed",
      );
    });
  });
});
