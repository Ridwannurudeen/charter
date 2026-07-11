import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm, network } from "hardhat";

import {
  AccreditationRegistry,
  CharterResolutions,
  CharterResolutions__factory,
  CharterResolutionsV2,
  CharterResolutionsV3,
  CharterShares,
  CharterShares__factory,
  ConfidentialTenderOffer,
  DemoShareFaucet,
  DemoShareFaucet__factory,
  DividendDistributor,
  DividendDistributor__factory,
  ForceTransferGuardian,
  GatedIssuance,
  MockConfidentialUSD,
  MockConfidentialUSD__factory,
  VestingSchedule,
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

  async function refreshSupplyDisclosure() {
    if (!(await shares.supplyDisclosureStale())) {
      return;
    }
    await (await shares.requestSupplyDisclosure()).wait();
    const supplyHandle = await shares.confidentialTotalSupply();
    const result = await fhevm.publicDecrypt([supplyHandle]);
    await (
      await shares.finalizeSupplyDisclosure(
        result.clearValues[supplyHandle as `0x${string}`] as bigint,
        result.decryptionProof,
      )
    ).wait();
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

    it("keeps an old disclosure stale when supply changes after the request", async function () {
      await (await shares.requestSupplyDisclosure()).wait();
      const requestedAt = await shares.clock();
      const requestedVersion = await shares.supplyVersion();
      const supplyHandle = await shares.confidentialTotalSupply();
      const result = await fhevm.publicDecrypt([supplyHandle]);
      const clearSupply = result.clearValues[supplyHandle as `0x${string}`] as bigint;
      let minted = false;

      try {
        await mintShares(signers.issuer, 1);
        minted = true;
        await (await shares.finalizeSupplyDisclosure(clearSupply, result.decryptionProof)).wait();

        expect(await shares.supplyDisclosureStale()).to.eq(true);
        expect(await shares.supplyVersion()).to.eq(requestedVersion + 1n);
        expect(await shares.recordTimepoint()).to.eq(requestedAt);
      } finally {
        if (minted) {
          const input = await fhevm.createEncryptedInput(sharesAddress, signers.issuer.address).add64(1).encrypt();
          await (
            await shares
              .connect(signers.issuer)
              ["confidentialBurn(address,bytes32,bytes)"](signers.issuer.address, input.handles[0], input.inputProof)
          ).wait();
        }
      }
    });
  });

  describe("distributions", function () {
    beforeEach(async function () {
      await refreshSupplyDisclosure();
      if (await shares.paused()) {
        await (await shares.unpause()).wait();
      }
    });

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

    it("rejects declaring a distribution to the zero address token", async function () {
      await (await shares.pause()).wait();
      await expect(distributor.declare(ethers.ZeroAddress, POOL)).to.be.revertedWithCustomError(
        distributor,
        "DistributorInvalidToken",
      );
      await (await shares.unpause()).wait();
    });

    it("issuer declares a distribution at the record-date pause", async function () {
      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, POOL)).wait();
      const d = await distributor.getDistribution(0);
      expect(d.pool).to.eq(POOL);
      expect(d.totalShares).to.eq(TOTAL_SHARES);
    });

    it("refuses to pay while share transfers are live (no record date)", async function () {
      if (await shares.paused()) {
        await (await shares.unpause()).wait();
      }
      await expect(distributor.payBatch(0, [signers.alice.address])).to.be.revertedWithCustomError(
        distributor,
        "DistributorSharesNotPaused",
      );
    });

    it("rejects payBatch calls above the explicit batch-size guard", async function () {
      const batch = (await ethers.getSigners()).slice(7, 20).map((signer) => signer.address);
      expect(batch).to.have.length(13);
      await (await shares.pause()).wait();
      await expect(distributor.payBatch(0, batch)).to.be.revertedWithCustomError(
        distributor,
        "DistributorBatchTooLarge",
      );
      await (await shares.unpause()).wait();
    });

    it("pays each investor their exact pro-rata cut, encrypted", async function () {
      await (await shares.pause()).wait();
      await (await distributor.payBatch(0, [signers.alice.address, signers.bob.address, signers.carol.address])).wait();
      await (await shares.unpause()).wait();

      expect(await decryptUSDOf(signers.alice)).to.eq((POOL * BigInt(ALICE_SHARES)) / BigInt(TOTAL_SHARES));
      expect(await decryptUSDOf(signers.bob)).to.eq((POOL * BigInt(BOB_SHARES)) / BigInt(TOTAL_SHARES));
      expect(await decryptUSDOf(signers.carol)).to.eq((POOL * BigInt(CAROL_SHARES)) / BigInt(TOTAL_SHARES));
    });

    it("lets every investor claim distribution proceeds independently (including 15 claimants)", async function () {
      const signers15 = (await ethers.getSigners()).slice(9, 24);
      expect(signers15).to.have.length(15);
      const amounts = signers15.map((_, index) => 1000n + BigInt(index));
      for (let i = 0; i < signers15.length; i++) {
        await mintShares(signers15[i], Number(amounts[i]));
      }
      await refreshSupplyDisclosure();
      await (await mcUSD.mint(signers.issuer.address, 100_000n)).wait();
      const until = (await ethers.provider.getBlock("latest"))!.timestamp + 1_000_000;
      await (await mcUSD.connect(signers.issuer).setOperator(distributorAddress, until)).wait();

      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, 15_000n)).wait();
      const id = (await distributor.distributionCount()) - 1n;

      try {
        const before = signers15.map(() => 0n);
        const totalShares = (await distributor.getDistribution(id)).totalShares;
        for (const holder of signers15) {
          await (await distributor.connect(holder).claim(id)).wait();
        }
        const after: bigint[] = [];
        for (const holder of signers15) {
          after.push(await decryptUSDOf(holder));
        }

        for (let i = 0; i < signers15.length; i++) {
          const expected = (15_000n * amounts[i]) / totalShares;
          expect(after[i] - before[i]).to.eq(expected);
        }
      } finally {
        if (await shares.paused()) {
          await (await shares.unpause()).wait();
        }
      }
    });

    it("cannot claim the same distribution twice", async function () {
      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, 1_000n)).wait();
      const id = (await distributor.distributionCount()) - 1n;
      await (await distributor.connect(signers.alice).claim(id)).wait();
      await expect(distributor.connect(signers.alice).claim(id)).to.be.revertedWithCustomError(
        distributor,
        "DistributorAlreadyPaid",
      );
      await (await shares.unpause()).wait();
    });

    it("rejects payout with an unknown distribution id", async function () {
      const unknownId = (await distributor.distributionCount()) + 1_000n;
      await (await shares.pause()).wait();
      await expect(distributor.payBatch(unknownId, [signers.alice.address])).to.be.revertedWithCustomError(
        distributor,
        "DistributorInvalidDistribution",
      );
      await (await shares.unpause()).wait();
    });

    it("cannot pay the same investor twice", async function () {
      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, 1_000n)).wait();
      const id = (await distributor.distributionCount()) - 1n;
      await (await distributor.payBatch(id, [signers.alice.address])).wait();
      await expect(distributor.payBatch(id, [signers.alice.address])).to.be.revertedWithCustomError(
        distributor,
        "DistributorAlreadyPaid",
      );
      await (await shares.unpause()).wait();
    });

    it("rejects payout when supply disclosure is stale after declaration", async function () {
      await (await shares.requestSupplyDisclosure()).wait();
      const supplyHandle = await shares.confidentialTotalSupply();
      const supplyResult = await fhevm.publicDecrypt([supplyHandle]);
      await (
        await shares.finalizeSupplyDisclosure(
          supplyResult.clearValues[supplyHandle as `0x${string}`] as bigint,
          supplyResult.decryptionProof,
        )
      ).wait();

      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, 1_000n)).wait();
      const id = (await distributor.distributionCount()) - 1n;
      await (await shares.unpause()).wait();
      await mintShares(signers.issuer, 1);

      await (await shares.pause()).wait();
      await expect(distributor.payBatch(id, [signers.alice.address])).to.be.revertedWithCustomError(
        distributor,
        "DistributorStaleSupply",
      );
      await (await shares.unpause()).wait();
    });

    it("rejects payouts when balances change after the distribution record", async function () {
      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, 1_000n)).wait();
      const id = (await distributor.distributionCount()) - 1n;
      const declaredLedgerVersion = await distributor.distributionLedgerVersion(id);
      let transferred = false;

      try {
        await (await shares.unpause()).wait();
        const transfer = await fhevm.createEncryptedInput(sharesAddress, signers.alice.address).add64(1).encrypt();
        await (
          await shares
            .connect(signers.alice)
            [
              "confidentialTransfer(address,bytes32,bytes)"
            ](signers.bob.address, transfer.handles[0], transfer.inputProof)
        ).wait();
        transferred = true;
        await (await shares.pause()).wait();

        expect(await shares.ledgerVersion()).to.eq(declaredLedgerVersion + 1n);
        await expect(distributor.payBatch(id, [signers.alice.address])).to.be.revertedWithCustomError(
          distributor,
          "DistributorStaleLedger",
        );
        await expect(distributor.connect(signers.bob).claim(id)).to.be.revertedWithCustomError(
          distributor,
          "DistributorStaleLedger",
        );
      } finally {
        if (await shares.paused()) {
          await (await shares.unpause()).wait();
        }
        if (transferred) {
          const restore = await fhevm.createEncryptedInput(sharesAddress, signers.bob.address).add64(1).encrypt();
          await (
            await shares
              .connect(signers.bob)
              [
                "confidentialTransfer(address,bytes32,bytes)"
              ](signers.alice.address, restore.handles[0], restore.inputProof)
          ).wait();
        }
      }
    });

    it("recovers distributor leftovers via shares after disabling the module", async function () {
      const leftOverPool = 10_000n;
      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, leftOverPool)).wait();
      const id = (await distributor.distributionCount()) - 1n;

      const issuerBefore = await decryptUSDOf(signers.issuer);
      await (await distributor.payBatch(id, [signers.alice.address])).wait();
      const aliceAfterBatch = await decryptUSDOf(signers.alice);

      await (await shares.unpause()).wait();
      await (await shares.setModule(distributorAddress, false)).wait();
      await (await shares.recoverModuleFunds(distributorAddress, mcUSDAddress, signers.issuer.address)).wait();
      const issuerAfter = await decryptUSDOf(signers.issuer);

      expect(issuerAfter).to.be.gt(issuerBefore);
      expect(aliceAfterBatch).to.be.gt(0);
      await (await shares.setModule(distributorAddress, true)).wait();
    });

    it("recovers distributor leftovers through batch recovery before re-enabling", async function () {
      const leftOverPool = 12_000n;
      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, leftOverPool)).wait();
      const id = (await distributor.distributionCount()) - 1n;

      const issuerBefore = await decryptUSDOf(signers.issuer);
      await (await distributor.payBatch(id, [signers.alice.address])).wait();

      await (
        await shares.disableModuleAndRecoverBatch(distributorAddress, [mcUSDAddress], signers.issuer.address)
      ).wait();
      const issuerAfter = await decryptUSDOf(signers.issuer);

      expect(issuerAfter).to.be.gt(issuerBefore);
      await (await shares.unpause()).wait();
      await (await shares.setModule(distributorAddress, true)).wait();
    });

    it("disables and recovers a module in one step", async function () {
      const leftOverPool = 10_000n;
      await (await shares.pause()).wait();
      await (await distributor.declare(mcUSDAddress, leftOverPool)).wait();
      const id = (await distributor.distributionCount()) - 1n;

      const issuerBefore = await decryptUSDOf(signers.issuer);
      await (await distributor.payBatch(id, [signers.alice.address])).wait();
      const aliceAfterBatch = await decryptUSDOf(signers.alice);

      await (await shares.disableModuleAndRecover(distributorAddress, mcUSDAddress, signers.issuer.address)).wait();
      const issuerAfter = await decryptUSDOf(signers.issuer);

      expect(issuerAfter).to.be.gt(issuerBefore);
      expect(aliceAfterBatch).to.be.gt(0);
      await (await shares.unpause()).wait();
      await (await shares.setModule(distributorAddress, true)).wait();
    });

    it("non-issuer cannot declare or pay", async function () {
      await expect(distributor.connect(signers.bob).declare(mcUSDAddress, POOL)).to.be.revertedWithCustomError(
        distributor,
        "DistributorNotIssuer",
      );
    });

    it("rejects a stale disclosed supply after new issuance", async function () {
      await (await shares.requestSupplyDisclosure()).wait();
      const baselineHandle = await shares.confidentialTotalSupply();
      const baselineResult = await fhevm.publicDecrypt([baselineHandle]);
      const baselineSupply = baselineResult.clearValues[baselineHandle as `0x${string}`] as bigint;

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
      expect(clearSupply).to.eq(baselineSupply + BigInt(AUDITOR_EXTRA_SHARES));

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
    it("does not allow faucet claims until the faucet is enabled as a token agent", async function () {
      await expect(demoFaucet.connect(signers.erin).claim()).to.be.reverted;
    });

    it("lets a wallet claim encrypted demo shares once", async function () {
      await (await shares.addAgent(demoFaucetAddress)).wait();
      await (await demoFaucet.connect(signers.erin).claim()).wait();
      expect(await decryptSharesOf(signers.erin)).to.eq(1000);
      await expect(demoFaucet.connect(signers.erin).claim()).to.be.revertedWithCustomError(
        demoFaucet,
        "AlreadyClaimed",
      );
    });
  });

  describe("confidential tender offer (buyback)", function () {
    let tender: ConfidentialTenderOffer;
    let tenderAddress: string;
    let seller1: HardhatEthersSigner;
    let seller2: HardhatEthersSigner;
    const FAR_FUTURE = 2_000_000_000; // uint48 operator expiry

    before(async function () {
      const ethSigners = await ethers.getSigners();
      seller1 = ethSigners[7];
      seller2 = ethSigners[8];
      if (await shares.paused()) {
        await (await shares.unpause()).wait();
      }

      const factory = await ethers.getContractFactory("ConfidentialTenderOffer");
      tender = (await factory.deploy(sharesAddress)) as unknown as ConfidentialTenderOffer;
      tenderAddress = await tender.getAddress();
      await (await shares.setModule(tenderAddress, true)).wait();

      // Fresh holders with known balances.
      await mintShares(seller1, 10_000);
      await mintShares(seller2, 5_000);
      // Issuer holds payment-token escrow and approves the buyback to pull it.
      await (await mcUSD.mint(signers.issuer.address, 1_000_000)).wait();
      await (await mcUSD.setOperator(tenderAddress, FAR_FUTURE)).wait();
      // Sellers let the buyback pull their accepted shares.
      await (await shares.connect(seller1).setOperator(tenderAddress, FAR_FUTURE)).wait();
      await (await shares.connect(seller2).setOperator(tenderAddress, FAR_FUTURE)).wait();
    });

    const submitTender = async (id: bigint, seller: HardhatEthersSigner, qty: number) => {
      const input = await fhevm.createEncryptedInput(tenderAddress, seller.address).add64(qty).encrypt();
      await (await tender.connect(seller).tender(id, input.handles[0], input.inputProof)).wait();
    };

    const settle = async (id: bigint) => {
      await network.provider.send("hardhat_mine", ["0x20"]);
      await (await tender.requestTotal(id)).wait();
      const o = await tender.getOffer(id);
      const result = await fhevm.publicDecrypt([o.totalTendered]);
      const total = result.clearValues[o.totalTendered as `0x${string}`] as bigint;
      await (await tender.settleTotal(id, total, result.decryptionProof)).wait();
      return total;
    };

    it("rejects opening a tender offer with the zero address token", async function () {
      await expect(tender.openOffer(ethers.ZeroAddress, 2, 1_000, 20)).to.be.revertedWithCustomError(
        tender,
        "TenderInvalidToken",
      );
    });

    it("fills every tender when undersubscribed, paying sellers in ciphertext", async function () {
      const price = 2;
      await (await tender.openOffer(mcUSDAddress, price, 20_000, 20)).wait();
      const id = (await tender.offerCount()) - 1n;
      await submitTender(id, seller1, 4_000);
      await submitTender(id, seller2, 3_000);

      const total = await settle(id);
      expect(total).to.eq(7_000n); // 7,000 < 20,000 cap: full fill

      await (await tender.claim(id, [seller1.address, seller2.address])).wait();
      expect(await decryptSharesOf(seller1)).to.eq(10_000 - 4_000);
      expect(await decryptSharesOf(seller2)).to.eq(5_000 - 3_000);
      expect(await decryptUSDOf(seller1)).to.eq(4_000 * price);
      expect(await decryptUSDOf(seller2)).to.eq(3_000 * price);
    });

    it("scales accepted shares pro-rata on ciphertext when oversubscribed", async function () {
      const price = 2;
      // Remaining balances: seller1 6,000, seller2 2,000. Cap 4,000 with 8,000 tendered.
      await (await tender.openOffer(mcUSDAddress, price, 4_000, 20)).wait();
      const id = (await tender.offerCount()) - 1n;
      await submitTender(id, seller1, 6_000);
      await submitTender(id, seller2, 2_000);

      const total = await settle(id);
      expect(total).to.eq(8_000n); // oversubscribed vs the 4,000 cap

      const s1Before = await decryptSharesOf(seller1);
      const s2Before = await decryptSharesOf(seller2);
      await (await tender.claim(id, [seller1.address, seller2.address])).wait();

      // accepted = tendered * cap / total: seller1 6000*4000/8000=3000, seller2 2000*4000/8000=1000.
      expect(s1Before - (await decryptSharesOf(seller1))).to.eq(3_000);
      expect(s2Before - (await decryptSharesOf(seller2))).to.eq(1_000);
    });

    it("rejects oversized tender claim batches", async function () {
      const price = 2;
      const holders = (await ethers.getSigners()).slice(0, 13).map((s) => s.address);
      await (await tender.openOffer(mcUSDAddress, price, 4_000, 20)).wait();
      const id = (await tender.offerCount()) - 1n;
      await settle(id);

      await expect(tender.claim(id, holders)).to.be.revertedWithCustomError(tender, "TenderBatchTooLarge");
    });

    it("cannot pay more than shares still held at claim time", async function () {
      const price = 2;
      const holders = await ethers.getSigners();
      const holder = holders[24];
      await (await tender.openOffer(mcUSDAddress, price, 4_000, 20)).wait();
      const id = (await tender.offerCount()) - 1n;

      await mintShares(holder, 10_000);
      await (await shares.connect(holder).setOperator(tenderAddress, FAR_FUTURE)).wait();
      await submitTender(id, holder, 4_000);

      const total = await settle(id);
      expect(total).to.eq(4_000n);

      const preTransferBalance = await decryptSharesOf(holder);
      expect(preTransferBalance).to.eq(10_000n);
      await (await mcUSD.mint(holder.address, 1_000n)).wait();
      const cashBefore = await decryptUSDOf(holder);

      const transferOutInput = await fhevm.createEncryptedInput(sharesAddress, holder.address).add64(10_000).encrypt();
      await (
        await shares
          .connect(holder)
          [
            "confidentialTransfer(address,bytes32,bytes)"
          ](signers.issuer.address, transferOutInput.handles[0], transferOutInput.inputProof)
      ).wait();

      expect(await decryptSharesOf(holder)).to.eq(0n);
      await (await tender.claim(id, [holder.address])).wait();
      expect(await decryptSharesOf(holder)).to.eq(0n);
      expect(await decryptUSDOf(holder)).to.eq(cashBefore);
    });

    it("recovers unclaimed tender-offer escrow after module deactivation", async function () {
      const price = 2;
      await (await tender.openOffer(mcUSDAddress, price, 4_000, 20)).wait();
      const id = (await tender.offerCount()) - 1n;

      await submitTender(id, seller1, 3_000);
      await submitTender(id, seller2, 3_000);

      await settle(id);
      const issuerBefore = await decryptUSDOf(signers.issuer);
      await (await tender.claim(id, [seller1.address])).wait();

      await (await shares.setModule(tenderAddress, false)).wait();
      await (await shares.recoverModuleFunds(tenderAddress, mcUSDAddress, signers.issuer.address)).wait();
      const issuerAfter = await decryptUSDOf(signers.issuer);

      expect(issuerAfter).to.be.gt(issuerBefore);
      await (await shares.setModule(tenderAddress, true)).wait();
    });

    it("recovers tender-offer escrow through batch module recovery", async function () {
      const price = 2;
      await (await tender.openOffer(mcUSDAddress, price, 4_000, 20)).wait();
      const id = (await tender.offerCount()) - 1n;

      await submitTender(id, seller1, 1_000);
      await settle(id);

      const issuerBefore = await decryptUSDOf(signers.issuer);
      await (await tender.claim(id, [seller1.address])).wait();

      await (await shares.disableModuleAndRecoverBatch(tenderAddress, [mcUSDAddress], signers.issuer.address)).wait();
      const issuerAfter = await decryptUSDOf(signers.issuer);

      expect(issuerAfter).to.be.gt(issuerBefore);
      await (await shares.setModule(tenderAddress, true)).wait();
    });
  });

  describe("resolutions v3 shareholder proposals", function () {
    let v3: CharterResolutionsV3;
    let v3Address: string;

    beforeEach(async function () {
      const factory = await ethers.getContractFactory("CharterResolutionsV3");
      v3 = (await factory.deploy(sharesAddress, 3)) as unknown as CharterResolutionsV3;
      v3Address = await v3.getAddress();
      await (await shares.setModule(v3Address, true)).wait();
    });

    it("lets a self-delegated shareholder (not the issuer) open a resolution", async function () {
      // alice self-delegated during issuance; she is not an admin/agent.
      expect(await v3.canPropose(signers.alice.address)).to.eq(true);
      await (await v3.connect(signers.alice).propose("Shareholder-initiated: expand the board", 20)).wait();
      const id = (await v3.resolutionCount()) - 1n;
      expect((await v3.getResolution(id)).description).to.eq("Shareholder-initiated: expand the board");
    });

    it("limits each proposer to one unresolved resolution at a time", async function () {
      await (await v3.connect(signers.alice).propose("Spam resolution", 20)).wait();
      await expect(v3.connect(signers.alice).propose("Spam resolution #2", 20)).to.be.revertedWithCustomError(
        v3,
        "ResolutionsActiveProposal",
      );

      const firstId = (await v3.resolutionCount()) - 1n;
      await network.provider.send("hardhat_mine", ["0x20"]);
      await (await v3.requestTally(firstId)).wait();
      await network.provider.send("hardhat_mine", ["0x40"]);

      await (await v3.connect(signers.alice).propose("After resolution closes", 20)).wait();
    });

    it("auto-clears an expired unresolved proposal so the same proposer can move on", async function () {
      await (await v3.connect(signers.alice).propose("Expired unresolved", 20)).wait();
      await network.provider.send("hardhat_mine", ["0x100"]); // past deadline and proposal cooldown
      await expect(v3.connect(signers.alice).propose("Fresh proposal", 20)).to.not.be.reverted;
    });

    it("rejects proposals from a wallet with no voting power", async function () {
      const stranger = (await ethers.getSigners())[9];
      expect(await v3.canPropose(stranger.address)).to.eq(false);
      await expect(v3.connect(stranger).propose("Spam", 20)).to.be.revertedWithCustomError(
        v3,
        "ResolutionsCannotPropose",
      );
    });

    it("requires proposal authors to have voting handle visibility", async function () {
      const outsider = (await ethers.getSigners())[25];
      await (await shares.connect(outsider).delegate(outsider.address)).wait();
      await expect(v3.connect(outsider).propose("No-op proposal", 20)).to.be.revertedWithCustomError(
        v3,
        "ResolutionsCannotPropose",
      );
    });

    it("requires proposal authors to self-delegate", async function () {
      await (await shares.connect(signers.alice).delegate(signers.bob.address)).wait();
      await expect(v3.connect(signers.alice).propose("delegated outsider proposal", 20)).to.be.revertedWithCustomError(
        v3,
        "ResolutionsCannotPropose",
      );
      await (await shares.connect(signers.alice).delegate(signers.alice.address)).wait();
    });

    it("rejects proposals with an oversized voting period", async function () {
      const maxVotingPeriod = await v3.maxVotingPeriod();
      await expect(v3.connect(signers.alice).propose("Too long", maxVotingPeriod + 1n)).to.be.revertedWithCustomError(
        v3,
        "ResolutionsVotingPeriodTooLong",
      );
    });

    it("enforces a proposal cooldown for repeated proposers", async function () {
      await (await v3.connect(signers.alice).propose("First self-proposed resolution", 20)).wait();
      const firstId = (await v3.resolutionCount()) - 1n;
      await network.provider.send("hardhat_mine", ["0x20"]);
      await (await v3.requestTally(firstId)).wait();

      await expect(v3.connect(signers.alice).propose("Second resolution too soon", 20)).to.be.revertedWithCustomError(
        v3,
        "ResolutionsProposalCooldown",
      );

      await network.provider.send("hardhat_mine", ["0x60"]);
      await expect(v3.connect(signers.alice).propose("Second resolution after cooldown", 20)).to.not.be.reverted;
    });

    it("runs the full shareholder-driven loop to a settled outcome", async function () {
      await (await v3.connect(signers.alice).propose("Shareholder-initiated: approve buyback", 20)).wait();
      const id = (await v3.resolutionCount()) - 1n;
      const vote = async (voter: HardhatEthersSigner, support: boolean) => {
        const input = await fhevm.createEncryptedInput(v3Address, voter.address).addBool(support).encrypt();
        await (await v3.connect(voter).castVote(id, input.handles[0], input.inputProof)).wait();
      };
      await vote(signers.alice, true);
      await vote(signers.bob, true);
      await vote(signers.carol, false);

      await network.provider.send("hardhat_mine", ["0x20"]);
      await (await v3.requestTally(id)).wait();
      const r = await v3.getResolution(id);
      expect(r.quorumReached).to.eq(true);
      const result = await fhevm.publicDecrypt([r.passedHandle]);
      const passed = result.clearValues[r.passedHandle as `0x${string}`] as boolean;
      await (await v3.settle(id, passed, result.decryptionProof)).wait();
      expect((await v3.getResolution(id)).resolved).to.eq(true);
    });
  });

  describe("vesting schedule", function () {
    let vesting: VestingSchedule;
    let vestingAddress: string;
    let beneficiary: HardhatEthersSigner;
    const FAR_FUTURE = 4_000_000_000;

    before(async function () {
      beneficiary = (await ethers.getSigners())[26];
      const factory = await ethers.getContractFactory("VestingSchedule");
      vesting = (await factory.deploy(sharesAddress)) as unknown as VestingSchedule;
      vestingAddress = await vesting.getAddress();
      if (await shares.paused()) {
        await (await shares.unpause()).wait();
      }

      await mintShares(signers.issuer, 100_000);
      await (await shares.connect(signers.issuer).setOperator(vestingAddress, FAR_FUTURE)).wait();
    });

    it("releases nothing before the cliff, the proportional catch-up at the cliff, and the rest linearly", async function () {
      const total = 40_000;
      const input = await fhevm.createEncryptedInput(vestingAddress, signers.issuer.address).add64(total).encrypt();
      await (
        await vesting
          .connect(signers.issuer)
          .createGrant(beneficiary.address, input.handles[0], input.inputProof, 10, 40)
      ).wait();
      const id = (await vesting.grantCount()) - 1n;

      const [preElapsed] = await vesting.vestingProgress(id);
      expect(preElapsed).to.eq(0);
      await (await vesting.connect(beneficiary).claim(id)).wait();
      expect(await decryptSharesOf(beneficiary)).to.eq(0);

      await network.provider.send("hardhat_mine", ["0xc"]); // past the 10-block cliff
      await (await vesting.connect(beneficiary).claim(id)).wait();
      // Read progress AFTER the claim tx lands, at the same block it executed in, so the expected
      // fraction matches exactly what claim() itself computed (a claim() call mines its own block).
      const [midElapsed, duration] = await vesting.vestingProgress(id);
      const expectedAtCliff = (BigInt(total) * BigInt(midElapsed)) / BigInt(duration);
      expect(await decryptSharesOf(beneficiary)).to.eq(expectedAtCliff);

      await network.provider.send("hardhat_mine", ["0x28"]); // well past full vest at 40 blocks
      await (await vesting.connect(beneficiary).claim(id)).wait();
      expect(await decryptSharesOf(beneficiary)).to.eq(total);
    });

    it("rejects claims from anyone but the beneficiary", async function () {
      const input = await fhevm.createEncryptedInput(vestingAddress, signers.issuer.address).add64(1000).encrypt();
      await (
        await vesting
          .connect(signers.issuer)
          .createGrant(beneficiary.address, input.handles[0], input.inputProof, 0, 10)
      ).wait();
      const id = (await vesting.grantCount()) - 1n;
      await expect(vesting.connect(signers.dave).claim(id)).to.be.revertedWithCustomError(
        vesting,
        "VestingNotBeneficiary",
      );
    });

    it("rejects creating a grant for the zero address", async function () {
      const input = await fhevm.createEncryptedInput(vestingAddress, signers.issuer.address).add64(1000).encrypt();
      await expect(
        vesting.connect(signers.issuer).createGrant(ethers.ZeroAddress, input.handles[0], input.inputProof, 0, 10),
      ).to.be.revertedWithCustomError(vesting, "VestingInvalidBeneficiary");
    });

    it("rejects grants that overflow the vesting schedule clock window", async function () {
      const nowClock = await shares.clock();
      const maxWindow = (1n << 48n) - 1n - nowClock + 1n;
      const input = await fhevm.createEncryptedInput(vestingAddress, signers.issuer.address).add64(1000).encrypt();
      await expect(
        vesting
          .connect(signers.issuer)
          .createGrant(beneficiary.address, input.handles[0], input.inputProof, 0, maxWindow),
      ).to.be.revertedWithCustomError(vesting, "VestingBadSchedule");
    });

    it("settles a revoked grant: pays out vested-to-date, returns the unvested remainder", async function () {
      const total = 20_000;
      const input = await fhevm.createEncryptedInput(vestingAddress, signers.issuer.address).add64(total).encrypt();
      await (
        await vesting
          .connect(signers.issuer)
          .createGrant(beneficiary.address, input.handles[0], input.inputProof, 5, 20)
      ).wait();
      const id = (await vesting.grantCount()) - 1n;

      await network.provider.send("hardhat_mine", ["0xa"]);
      const beneficiaryBefore = await decryptSharesOf(beneficiary);
      const issuerBefore = await decryptSharesOf(signers.issuer);
      await (await vesting.connect(signers.issuer).revoke(id)).wait();
      // Read progress AFTER revoke() lands, at the same block it executed in — revoke() mines its
      // own block, so reading before it would understate elapsed by one block.
      const [elapsed, duration] = await vesting.vestingProgress(id);
      const expectedVested = (BigInt(total) * BigInt(elapsed)) / BigInt(duration);

      expect((await decryptSharesOf(beneficiary)) - beneficiaryBefore).to.eq(expectedVested);
      expect((await decryptSharesOf(signers.issuer)) - issuerBefore).to.eq(BigInt(total) - expectedVested);

      await expect(vesting.connect(beneficiary).claim(id)).to.be.revertedWithCustomError(
        vesting,
        "VestingAlreadyRevoked",
      );
    });
  });

  describe("gated issuance (accreditation allowlist)", function () {
    let registry: AccreditationRegistry;
    let gated: GatedIssuance;
    let gatedAddress: string;
    let applicant: HardhatEthersSigner;

    before(async function () {
      applicant = (await ethers.getSigners())[10];
      const registryFactory = await ethers.getContractFactory("AccreditationRegistry");
      registry = (await registryFactory.deploy(signers.issuer.address)) as unknown as AccreditationRegistry;
      const registryAddress = await registry.getAddress();
      if (await shares.paused()) {
        await (await shares.unpause()).wait();
      }

      const gatedFactory = await ethers.getContractFactory("GatedIssuance");
      gated = (await gatedFactory.deploy(sharesAddress, registryAddress)) as unknown as GatedIssuance;
      gatedAddress = await gated.getAddress();
      await (await shares.addAgent(gatedAddress)).wait();
      await (await shares.setModule(gatedAddress, true)).wait();
    });

    it("refuses to mint to a wallet that has not been accredited", async function () {
      const input = await fhevm.createEncryptedInput(gatedAddress, signers.issuer.address).add64(1000).encrypt();
      await expect(
        gated.connect(signers.issuer).issue(applicant.address, input.handles[0], input.inputProof),
      ).to.be.revertedWithCustomError(gated, "IssuanceNotAccredited");
    });

    it("remains default-deny after accreditation revocation", async function () {
      await (await registry.connect(signers.issuer).setAccredited(applicant.address, true)).wait();
      const input = await fhevm.createEncryptedInput(gatedAddress, signers.issuer.address).add64(1000).encrypt();
      await (await gated.connect(signers.issuer).issue(applicant.address, input.handles[0], input.inputProof)).wait();
      await (await registry.connect(signers.issuer).setAccredited(applicant.address, false)).wait();

      const blocked = await fhevm.createEncryptedInput(gatedAddress, signers.issuer.address).add64(1).encrypt();
      await expect(
        gated.connect(signers.issuer).issue(applicant.address, blocked.handles[0], blocked.inputProof),
      ).to.be.revertedWithCustomError(gated, "IssuanceNotAccredited");
    });

    it("mints once the wallet is accredited", async function () {
      await (await registry.connect(signers.issuer).setAccredited(applicant.address, true)).wait();
      const before = await decryptSharesOf(applicant);
      const input = await fhevm.createEncryptedInput(gatedAddress, signers.issuer.address).add64(1000).encrypt();
      await (await gated.connect(signers.issuer).issue(applicant.address, input.handles[0], input.inputProof)).wait();
      expect((await decryptSharesOf(applicant)) - before).to.eq(1000);
    });

    it("rejects minting to the zero address", async function () {
      const input = await fhevm.createEncryptedInput(gatedAddress, signers.issuer.address).add64(1000).encrypt();
      await expect(
        gated.connect(signers.issuer).issue(ethers.ZeroAddress, input.handles[0], input.inputProof),
      ).to.be.revertedWithCustomError(gated, "IssuanceInvalidRecipient");
    });

    it("restricts accreditation changes to the registry admin", async function () {
      await expect(
        registry.connect(signers.bob).setAccredited(signers.bob.address, true),
      ).to.be.revertedWithCustomError(registry, "RegistryNotAdmin");
    });

    it("restricts issuance to the token's issuer role", async function () {
      const input = await fhevm.createEncryptedInput(gatedAddress, signers.bob.address).add64(1000).encrypt();
      await expect(
        gated.connect(signers.bob).issue(applicant.address, input.handles[0], input.inputProof),
      ).to.be.revertedWithCustomError(gated, "IssuanceNotIssuer");
    });

    it("blocks issuance when the gated module is unregistered in the share registry", async function () {
      await (await shares.setModule(gatedAddress, false)).wait();
      const input = await fhevm.createEncryptedInput(gatedAddress, signers.issuer.address).add64(1000).encrypt();
      await expect(
        gated.connect(signers.issuer).issue(applicant.address, input.handles[0], input.inputProof),
      ).to.be.revertedWithCustomError(gated, "IssuanceModuleNotActive");
      await (await shares.setModule(gatedAddress, true)).wait();
    });
  });

  describe("force-transfer guardian (M-of-N, timelocked enforcement)", function () {
    let guardian: ForceTransferGuardian;
    let guardianAddress: string;
    let g1: HardhatEthersSigner;
    let g2: HardhatEthersSigner;
    let g3: HardhatEthersSigner;
    let recovery: HardhatEthersSigner;
    const TIMELOCK_BLOCKS = 5;

    before(async function () {
      const s = await ethers.getSigners();
      [g1, g2, g3, recovery] = [s[24], s[25], s[28], s[29]];
      const factory = await ethers.getContractFactory("ForceTransferGuardian");
      guardian = (await factory.deploy(
        sharesAddress,
        [g1.address, g2.address, g3.address],
        2,
        TIMELOCK_BLOCKS,
      )) as unknown as ForceTransferGuardian;
      guardianAddress = await guardian.getAddress();
      await (await shares.addAgent(guardianAddress)).wait();
    });

    it("rejects duplicate guardian entries during deployment", async function () {
      const factory = await ethers.getContractFactory("ForceTransferGuardian");
      await expect(
        factory.deploy(sharesAddress, [g1.address, g1.address], 2, TIMELOCK_BLOCKS),
      ).to.be.revertedWithCustomError(guardian, "GuardianInvalidGuardian");
    });

    it("blocks execution until quorum is reached and the timelock elapses, then moves the shares", async function () {
      const amount = 1_000;
      const input = await fhevm.createEncryptedInput(guardianAddress, g1.address).add64(amount).encrypt();
      await (
        await guardian
          .connect(g1)
          .propose(
            signers.alice.address,
            recovery.address,
            input.handles[0],
            input.inputProof,
            "frozen wallet recovery order #1",
          )
      ).wait();
      const id = (await guardian.proposalCount()) - 1n;
      expect((await guardian.getProposal(id)).confirmations).to.eq(1);

      await expect(guardian.execute(id)).to.be.revertedWithCustomError(guardian, "GuardianQuorumNotReached");

      await (await guardian.connect(g2).confirm(id)).wait();
      expect((await guardian.getProposal(id)).confirmations).to.eq(2);
      await expect(guardian.execute(id)).to.be.revertedWithCustomError(guardian, "GuardianTimelockNotElapsed");

      // `recovery` has never held a balance yet, so its confidentialBalanceOf handle is genuinely
      // uninitialized (not an encrypted zero) — only read it after this transfer initializes it.
      const aliceBefore = await decryptSharesOf(signers.alice);

      await network.provider.send("hardhat_mine", ["0x5"]);
      await (await guardian.execute(id)).wait();

      expect(aliceBefore - (await decryptSharesOf(signers.alice))).to.eq(amount);
      expect(await decryptSharesOf(recovery)).to.eq(amount);

      await expect(guardian.execute(id)).to.be.revertedWithCustomError(guardian, "GuardianAlreadyExecuted");
    });

    it("rejects proposals and confirmations from non-guardians", async function () {
      const input = await fhevm.createEncryptedInput(guardianAddress, signers.bob.address).add64(1).encrypt();
      await expect(
        guardian
          .connect(signers.bob)
          .propose(signers.alice.address, recovery.address, input.handles[0], input.inputProof, "not a guardian"),
      ).to.be.revertedWithCustomError(guardian, "GuardianNotGuardian");
    });

    it("rejects confirm/execute calls for non-existent proposal IDs", async function () {
      const badId = 9999n;
      await expect(guardian.connect(g1).confirm(badId)).to.be.revertedWithCustomError(
        guardian,
        "GuardianProposalNotFound",
      );
      await expect(guardian.connect(g1).execute(badId)).to.be.revertedWithCustomError(
        guardian,
        "GuardianProposalNotFound",
      );
    });

    it("rejects guardian proposals with invalid transfer endpoints", async function () {
      const input = await fhevm.createEncryptedInput(guardianAddress, g1.address).add64(1).encrypt();
      await expect(
        guardian
          .connect(g1)
          .propose(ethers.ZeroAddress, recovery.address, input.handles[0], input.inputProof, "zero from"),
      ).to.be.revertedWithCustomError(guardian, "GuardianBadParams");
      await expect(
        guardian
          .connect(g1)
          .propose(signers.alice.address, ethers.ZeroAddress, input.handles[0], input.inputProof, "zero to"),
      ).to.be.revertedWithCustomError(guardian, "GuardianBadParams");
      await expect(
        guardian
          .connect(g1)
          .propose(signers.alice.address, signers.alice.address, input.handles[0], input.inputProof, "same endpoint"),
      ).to.be.revertedWithCustomError(guardian, "GuardianBadParams");
    });

    it("rejects a guardian confirming the same proposal twice", async function () {
      const input = await fhevm.createEncryptedInput(guardianAddress, g1.address).add64(1).encrypt();
      await (
        await guardian
          .connect(g1)
          .propose(signers.alice.address, recovery.address, input.handles[0], input.inputProof, "second order")
      ).wait();
      const id = (await guardian.proposalCount()) - 1n;
      await expect(guardian.connect(g1).confirm(id)).to.be.revertedWithCustomError(
        guardian,
        "GuardianAlreadyConfirmed",
      );
    });
  });
});
