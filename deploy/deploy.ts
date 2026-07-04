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

  // Governance v3: adds shareholder-initiated proposals (any self-delegated holder can propose).
  const resolutionsV3 = await deploy("CharterResolutionsV3", {
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

  // Confidential vesting: the lifecycle mechanic every real cap table is built around. Standalone
  // module — it escrows via confidentialTransferFrom/confidentialTransfer, not the module registry,
  // so it needs no setModule grant.
  const vesting = await deploy("VestingSchedule", {
    from: deployer,
    args: [shares.address],
    log: true,
  });

  // Accreditation gate: a regulated issuer mints only to a default-deny allowlist, not the open
  // public. GatedIssuance is the compliant counterpart to DemoShareFaucet, registered as its own
  // agent so it can mint — the open demo faucet is untouched for judges.
  const registry = await deploy("AccreditationRegistry", {
    from: deployer,
    args: [deployer],
    log: true,
  });
  const gatedIssuance = await deploy("GatedIssuance", {
    from: deployer,
    args: [shares.address, registry.address],
    log: true,
  });

  // Force-transfer guardian: production-recommended enforcement path. Instead of one key silently
  // seizing shares, a forced transfer must be proposed with a public reason, confirmed by a 2-of-3
  // guardian quorum, and wait out a timelock before anyone can execute it.
  const namedSigners = await hre.ethers.getSigners();
  const guardianAddresses = [namedSigners[3].address, namedSigners[4].address, namedSigners[5].address];
  const guardian = await deploy("ForceTransferGuardian", {
    from: deployer,
    args: [shares.address, guardianAddresses, 2, 30],
    log: true,
  });

  await execute("CharterShares", { from: deployer, log: true }, "setModule", distributor.address, true);
  await execute("CharterShares", { from: deployer, log: true }, "setModule", resolutions.address, true);
  await execute("CharterShares", { from: deployer, log: true }, "setModule", resolutionsV2.address, true);
  await execute("CharterShares", { from: deployer, log: true }, "setModule", resolutionsV3.address, true);
  await execute("CharterShares", { from: deployer, log: true }, "setModule", tenderOffer.address, true);
  await execute("CharterShares", { from: deployer, log: true }, "addAgent", deployer);
  await execute("CharterShares", { from: deployer, log: true }, "addAgent", demoFaucet.address);
  await execute("CharterShares", { from: deployer, log: true }, "addAgent", gatedIssuance.address);
  await execute("CharterShares", { from: deployer, log: true }, "addAgent", guardian.address);

  console.log(`CharterShares:            ${shares.address}`);
  console.log(`MockConfidentialUSD:      ${mcUSD.address}`);
  console.log(`DividendDistributor:      ${distributor.address}`);
  console.log(`CharterResolutions:       ${resolutions.address}`);
  console.log(`CharterResolutionsV2:     ${resolutionsV2.address}`);
  console.log(`CharterResolutionsV3:     ${resolutionsV3.address}`);
  console.log(`ConfidentialTenderOffer:  ${tenderOffer.address}`);
  console.log(`DemoShareFaucet:          ${demoFaucet.address}`);
  console.log(`VestingSchedule:          ${vesting.address}`);
  console.log(`AccreditationRegistry:    ${registry.address}`);
  console.log(`GatedIssuance:            ${gatedIssuance.address}`);
  console.log(`ForceTransferGuardian:    ${guardian.address}`);
  console.log(`Guardians:                ${guardianAddresses.join(", ")}`);
};
export default func;
func.id = "deploy_charter";
func.tags = ["Charter"];
