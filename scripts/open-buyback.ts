import { deployments, ethers as hardhatEthers } from "hardhat";

/**
 * Opens one live confidential buyback offer so the /tender page has an open offer
 * for judges to tender into. Run once:
 *   npx hardhat run scripts/open-buyback.ts --network sepolia
 */

const PRICE = 2n; // mcUSD units per share
const MAX_SHARES = 500_000n;
const WINDOW_BLOCKS = 3000; // ~10 hours of Sepolia blocks

async function main() {
  const [issuer] = await hardhatEthers.getSigners();
  const sharesDep = await deployments.get("CharterShares");
  const mcUSDDep = await deployments.get("MockConfidentialUSD");
  const tenderDep = await deployments.get("ConfidentialTenderOffer");

  const mcUSD = await hardhatEthers.getContractAt("MockConfidentialUSD", mcUSDDep.address, issuer);
  const tender = await hardhatEthers.getContractAt("ConfidentialTenderOffer", tenderDep.address, issuer);

  const escrow = PRICE * MAX_SHARES;
  await (await mcUSD.mint(issuer.address, escrow)).wait();
  await (await mcUSD.setOperator(tenderDep.address, 4_000_000_000)).wait();
  const tx = await tender.openOffer(mcUSDDep.address, PRICE, MAX_SHARES, WINDOW_BLOCKS);
  await tx.wait();

  const id = (await tender.offerCount()) - 1n;
  console.log(`opened buyback #${id} on ${tenderDep.address} (shares ${sharesDep.address}); tx ${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
