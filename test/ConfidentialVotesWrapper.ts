import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm, network } from "hardhat";

import { ConfidentialVotesResolution, ConfidentialVotesWrapper, MockConfidentialUSD } from "../types";

describe("ConfidentialVotesWrapper", function () {
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let underlying: MockConfidentialUSD;
  let wrapper: ConfidentialVotesWrapper;
  let underlyingAddress: string;
  let wrapperAddress: string;

  const allocations = [500n, 300n, 200n];
  const operatorExpiry = 4_000_000_000;

  before(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs on the FHEVM mock only");
      this.skip();
    }
  });

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const underlyingFactory = await ethers.getContractFactory("MockConfidentialUSD");
    underlying = (await underlyingFactory.deploy()) as unknown as MockConfidentialUSD;
    underlyingAddress = await underlying.getAddress();

    const wrapperFactory = await ethers.getContractFactory("ConfidentialVotesWrapper");
    wrapper = (await wrapperFactory.deploy(
      underlyingAddress,
      "Wrapped Confidential USD Votes",
      "wmcUSD-V",
      owner.address,
    )) as unknown as ConfidentialVotesWrapper;
    wrapperAddress = await wrapper.getAddress();

    for (const [holder, amount] of [alice, bob, carol].map((signer, index) => [signer, allocations[index]]) as [
      HardhatEthersSigner,
      bigint,
    ][]) {
      await (await underlying.mint(holder.address, amount)).wait();
      await (await underlying.connect(holder).setOperator(wrapperAddress, operatorExpiry)).wait();
      const input = await fhevm.createEncryptedInput(wrapperAddress, holder.address).add64(amount).encrypt();
      await (await wrapper.connect(holder).deposit(input.handles[0], input.inputProof)).wait();
    }
  });

  async function decryptBalance(
    token: MockConfidentialUSD | ConfidentialVotesWrapper,
    tokenAddress: string,
    holder: HardhatEthersSigner,
    reader: HardhatEthersSigner = holder,
  ) {
    const handle = await token.confidentialBalanceOf(holder.address);
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddress, reader);
  }

  it("escrows a plain ERC-7984 token and returns the same hidden units on withdrawal", async function () {
    expect(await decryptBalance(underlying, underlyingAddress, alice)).to.equal(0n);
    expect(await decryptBalance(wrapper, wrapperAddress, alice)).to.equal(allocations[0]);
    await expect(decryptBalance(wrapper, wrapperAddress, alice, bob)).to.be.rejected;

    const overDeposit = await fhevm.createEncryptedInput(wrapperAddress, alice.address).add64(1).encrypt();
    await (await wrapper.connect(alice).deposit(overDeposit.handles[0], overDeposit.inputProof)).wait();
    expect(await decryptBalance(wrapper, wrapperAddress, alice)).to.equal(allocations[0]);

    const withdrawal = 125n;
    const input = await fhevm.createEncryptedInput(wrapperAddress, alice.address).add64(withdrawal).encrypt();
    await (await wrapper.connect(alice).withdraw(input.handles[0], input.inputProof)).wait();

    expect(await decryptBalance(underlying, underlyingAddress, alice)).to.equal(withdrawal);
    expect(await decryptBalance(wrapper, wrapperAddress, alice)).to.equal(allocations[0] - withdrawal);
  });

  it("keeps wrapped units non-transferable and vote-handle access default-deny and revocable", async function () {
    const transfer = await fhevm.createEncryptedInput(wrapperAddress, alice.address).add64(1).encrypt();
    await expect(
      wrapper
        .connect(alice)
        ["confidentialTransfer(address,bytes32,bytes)"](bob.address, transfer.handles[0], transfer.inputProof),
    ).to.be.revertedWithCustomError(wrapper, "VotesWrapperNonTransferable");

    await (await wrapper.connect(alice).delegate(alice.address)).wait();
    const votesHandle = await wrapper.getVotes(alice.address);
    await expect(
      wrapper.connect(bob).getHandleAllowance(votesHandle, bob.address, false),
    ).to.be.revertedWithCustomError(wrapper, "HandleAccessManagerNotAllowed");

    const resolutionFactory = await ethers.getContractFactory("ConfidentialVotesResolution");
    const resolution = (await resolutionFactory.deploy(wrapperAddress, 1)) as unknown as ConfidentialVotesResolution;
    const resolutionAddress = await resolution.getAddress();
    await (await wrapper.setVoteModule(resolutionAddress, true)).wait();
    await (await resolution.connect(alice).propose("Access revocation check", 20)).wait();
    await (await wrapper.setVoteModule(resolutionAddress, false)).wait();

    const support = await fhevm.createEncryptedInput(resolutionAddress, alice.address).addBool(true).encrypt();
    await expect(
      resolution.connect(alice).castVote(0, support.handles[0], support.inputProof),
    ).to.be.revertedWithCustomError(wrapper, "HandleAccessManagerNotAllowed");
  });

  it("runs an outcome-only vote over wrapped units from a plain ERC-7984 token", async function () {
    // CharterResolutionsV3 is coupled to the concrete CharterShares registry and its admin/agent
    // authorization API. This standalone path uses the narrower votes-source interface in
    // ConfidentialVotesResolution instead of changing the deployed V3 source or @gudman/charter-core.
    const resolutionFactory = await ethers.getContractFactory("ConfidentialVotesResolution");
    const resolution = (await resolutionFactory.deploy(wrapperAddress, 3)) as unknown as ConfidentialVotesResolution;
    const resolutionAddress = await resolution.getAddress();

    await expect(wrapper.connect(bob).setVoteModule(resolutionAddress, true)).to.be.revertedWithCustomError(
      wrapper,
      "OwnableUnauthorizedAccount",
    );
    await (await wrapper.setVoteModule(resolutionAddress, true)).wait();

    for (const voter of [alice, bob, carol]) {
      await (await wrapper.connect(voter).delegate(voter.address)).wait();
    }

    await (await resolution.connect(alice).propose("Approve a confidential-token treasury policy", 20)).wait();
    const id = (await resolution.resolutionCount()) - 1n;

    const vote = async (voter: HardhatEthersSigner, support: boolean) => {
      const input = await fhevm.createEncryptedInput(resolutionAddress, voter.address).addBool(support).encrypt();
      await (await resolution.connect(voter).castVote(id, input.handles[0], input.inputProof)).wait();
    };
    await vote(alice, true);
    await vote(bob, true);
    await vote(carol, false);

    await network.provider.send("hardhat_mine", ["0x20"]);
    await (await resolution.requestTally(id)).wait();
    const pending = await resolution.getResolution(id);
    expect(pending.quorumReached).to.equal(true);
    await expect(fhevm.publicDecrypt([pending.forVotes])).to.be.rejected;
    await expect(fhevm.publicDecrypt([pending.againstVotes])).to.be.rejected;

    const result = await fhevm.publicDecrypt([pending.passedHandle]);
    const passed = result.clearValues[pending.passedHandle as `0x${string}`] as boolean;
    expect(passed).to.equal(true);
    await (await resolution.settle(id, passed, result.decryptionProof)).wait();

    const settled = await resolution.getResolution(id);
    expect(settled.resolved).to.equal(true);
    expect(settled.passed).to.equal(true);
  });
});
