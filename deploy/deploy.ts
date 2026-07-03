import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute } = hre.deployments;

  const shares = await deploy("CharterShares", {
    from: deployer,
    args: ["Charter Demo Corp", "CDC-S", "", deployer],
    log: true,
  });

  const mcUSD = await deploy("MockConfidentialUSD", {
    from: deployer,
    args: [],
    log: true,
  });

  const distributor = await deploy("DividendDistributor", {
    from: deployer,
    args: [shares.address],
    log: true,
  });

  const resolutions = await deploy("CharterResolutions", {
    from: deployer,
    args: [shares.address],
    log: true,
  });

  const demoFaucet = await deploy("DemoShareFaucet", {
    from: deployer,
    args: [shares.address],
    log: true,
  });

  // Governance v2: same share token, quorum-enforcing resolutions module, registered live.
  const resolutionsV2 = await deploy("CharterResolutionsV2", {
    from: deployer,
    args: [shares.address, 3],
    log: true,
  });

  // Confidential secondary-market buyback module.
  const tenderOffer = await deploy("ConfidentialTenderOffer", {
    from: deployer,
    args: [shares.address],
    log: true,
  });

  await execute("CharterShares", { from: deployer, log: true }, "setModule", distributor.address, true);
  await execute("CharterShares", { from: deployer, log: true }, "setModule", resolutions.address, true);
  await execute("CharterShares", { from: deployer, log: true }, "setModule", resolutionsV2.address, true);
  await execute("CharterShares", { from: deployer, log: true }, "setModule", tenderOffer.address, true);
  await execute("CharterShares", { from: deployer, log: true }, "addAgent", deployer);
  await execute("CharterShares", { from: deployer, log: true }, "addAgent", demoFaucet.address);

  console.log(`CharterShares:            ${shares.address}`);
  console.log(`MockConfidentialUSD:      ${mcUSD.address}`);
  console.log(`DividendDistributor:      ${distributor.address}`);
  console.log(`CharterResolutions:       ${resolutions.address}`);
  console.log(`CharterResolutionsV2:     ${resolutionsV2.address}`);
  console.log(`ConfidentialTenderOffer:  ${tenderOffer.address}`);
  console.log(`DemoShareFaucet:          ${demoFaucet.address}`);
};
export default func;
func.id = "deploy_charter";
func.tags = ["Charter"];
