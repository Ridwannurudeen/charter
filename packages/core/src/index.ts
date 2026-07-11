import type { Signer } from "ethers";

import type { CharterShares } from "../types/contracts/CharterShares";
import { CharterShares__factory } from "../types/factories/contracts/CharterShares__factory";

export type { CharterShares } from "../types/contracts/CharterShares";
export { CharterShares__factory } from "../types/factories/contracts/CharterShares__factory";
export type { ICharterModule } from "../types/contracts/interfaces/ICharterModule.sol/ICharterModule";
export { ICharterModule__factory } from "../types/factories/contracts/interfaces/ICharterModule.sol/ICharterModule__factory";
export type { ICharterModuleFundsRecoverable } from "../types/contracts/interfaces/ICharterModule.sol/ICharterModuleFundsRecoverable";
export { ICharterModuleFundsRecoverable__factory } from "../types/factories/contracts/interfaces/ICharterModule.sol/ICharterModuleFundsRecoverable__factory";

export type DeployCharterRegistryOptions = {
  name?: string;
  symbol?: string;
  contractURI?: string;
  admin?: string;
  initialAgent?: string | false;
};

export async function deployCharterRegistry(
  signer: Signer,
  options: DeployCharterRegistryOptions = {},
): Promise<CharterShares> {
  const signerAddress = await signer.getAddress();
  const admin = options.admin ?? signerAddress;
  const registry = await new CharterShares__factory(signer).deploy(
    options.name ?? "Charter Registry",
    options.symbol ?? "CHTR",
    options.contractURI ?? "",
    admin,
  );
  await registry.waitForDeployment();

  const initialAgent =
    options.initialAgent === undefined && admin.toLowerCase() === signerAddress.toLowerCase()
      ? signerAddress
      : options.initialAgent;
  if (initialAgent) {
    await (await registry.addAgent(initialAgent)).wait();
  }

  return registry;
}
