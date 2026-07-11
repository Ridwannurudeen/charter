import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const WRAPPER_NAME = "Wrapped Confidential USD Votes";
const WRAPPER_SYMBOL = "wmcUSD-V";
const MIN_VOTERS = 3;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, get } = hre.deployments;

  const underlying = await get("MockConfidentialUSD");
  const wrapper = await deploy("ConfidentialVotesWrapper", {
    from: deployer,
    args: [underlying.address, WRAPPER_NAME, WRAPPER_SYMBOL, deployer],
    log: true,
  });
  const resolution = await deploy("ConfidentialVotesResolution", {
    from: deployer,
    args: [wrapper.address, MIN_VOTERS],
    log: true,
  });

  const wrapperContract = await hre.ethers.getContractAt("ConfidentialVotesWrapper", wrapper.address);
  if (!(await wrapperContract.isVoteModule(resolution.address))) {
    await execute("ConfidentialVotesWrapper", { from: deployer, log: true }, "setVoteModule", resolution.address, true);
  }

  console.log(`ConfidentialVotesWrapper:    ${wrapper.address}`);
  console.log(`ConfidentialVotesResolution: ${resolution.address}`);
  console.log(`Underlying ERC-7984:          ${underlying.address}`);
};

export default func;
func.id = "deploy_phase2_votes_wrapper";
func.tags = ["Phase2"];
