import hre, { deployments, ethers } from "hardhat";

async function main() {
  const { deployer } = await hre.getNamedAccounts();
  const sharesDeployment = await deployments.get("CharterShares");
  const previousDistributor = await deployments.get("DividendDistributor");

  const distributor = await deployments.deploy("DividendDistributor", {
    from: deployer,
    args: [sharesDeployment.address],
    log: true,
  });

  const [signer] = await ethers.getSigners();
  const shares = await ethers.getContractAt("CharterShares", sharesDeployment.address, signer);

  if (!(await shares.isModule(distributor.address))) {
    const grantTx = await shares.setModule(distributor.address, true);
    console.log(`CharterShares.setModule(new distributor, true): ${grantTx.hash}`);
    await grantTx.wait();
  }

  if (previousDistributor.address.toLowerCase() !== distributor.address.toLowerCase()) {
    if (await shares.isModule(previousDistributor.address)) {
      const revokeTx = await shares.setModule(previousDistributor.address, false);
      console.log(`CharterShares.setModule(old distributor, false): ${revokeTx.hash}`);
      await revokeTx.wait();
    }
  }

  console.log(`Previous DividendDistributor: ${previousDistributor.address}`);
  console.log(`Active DividendDistributor:   ${distributor.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
