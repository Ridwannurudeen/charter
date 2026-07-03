import { ethers as hardhatEthers, deployments, fhevm } from "hardhat";

/**
 * Rolling governance keeper. Run on a schedule (e.g. hourly) to keep an open
 * resolution available for judges to vote on and to settle any resolution whose
 * voting window has closed. Also re-discloses total supply when it has gone stale
 * (a demo-share claim mints shares and invalidates the distribution denominator).
 *
 *   npx hardhat run scripts/rolling-resolution.ts --network sepolia
 *
 * Uses account 0 of the configured MNEMONIC (the issuer/agent). Because propose()
 * is agent-gated, whatever host runs this must hold that key — keep it a low-value
 * demo burner and schedule it somewhere you control, not on a shared box.
 */

const VOTING_PERIOD_BLOCKS = 300; // ~1 hour of Sepolia blocks
const PROPOSALS = [
  "Ratify the quarterly confidential financial statements",
  "Approve the employee option pool top-up",
  "Authorize a confidential secondary buyback window",
  "Elect the independent board observer",
];

async function main() {
  const [signer] = await hardhatEthers.getSigners();
  const sharesDeployment = await deployments.get("CharterShares");
  const resolutionsDeployment = await deployments.get("CharterResolutionsV2");
  const shares = await hardhatEthers.getContractAt("CharterShares", sharesDeployment.address, signer);
  const resolutions = await hardhatEthers.getContractAt("CharterResolutionsV2", resolutionsDeployment.address, signer);

  // 1. Re-disclose supply if a demo claim made it stale, so distributions stay correct.
  if (await shares.supplyDisclosureStale()) {
    await (await shares.requestSupplyDisclosure()).wait();
    const supplyHandle = await shares.confidentialTotalSupply();
    const disclosed = await fhevm.publicDecrypt([supplyHandle]);
    const clear = disclosed.clearValues[supplyHandle as `0x${string}`];
    await (await shares.finalizeSupplyDisclosure(clear as bigint, disclosed.decryptionProof)).wait();
    console.log(`re-disclosed supply: ${clear}`);
  }

  const clock = Number(await shares.clock());
  const count = Number(await resolutions.resolutionCount());

  // 2. Settle every closed-but-unresolved resolution.
  for (let i = 0; i < count; i++) {
    const r = await resolutions.getResolution(i);
    if (r.resolved || clock <= Number(r.deadline)) continue;
    if (!r.tallyRequested) await (await resolutions.requestTally(i)).wait();
    const updated = await resolutions.getResolution(i);
    if (!updated.quorumReached) {
      console.log(`resolution ${i}: rejected (no quorum)`);
      continue;
    }
    const handle = updated.passedHandle as `0x${string}`;
    const decrypted = await fhevm.publicDecrypt([handle]);
    const passed = decrypted.clearValues[handle];
    if (typeof passed !== "boolean") continue;
    await (await resolutions.settle(i, passed, decrypted.decryptionProof)).wait();
    console.log(`resolution ${i}: settled ${passed ? "passed" : "rejected"}`);
  }

  // 3. Keep exactly one open resolution available for live voting.
  const openExists = await (async () => {
    for (let i = 0; i < count; i++) {
      const r = await resolutions.getResolution(i);
      if (!r.resolved && clock <= Number(r.deadline)) return true;
    }
    return false;
  })();
  if (!openExists) {
    const text = PROPOSALS[count % PROPOSALS.length];
    await (await resolutions.propose(text, VOTING_PERIOD_BLOCKS)).wait();
    console.log(`proposed new resolution #${count}: "${text}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
