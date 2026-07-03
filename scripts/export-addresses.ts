import fs from "node:fs";
import path from "node:path";

const ARTIFACTS = [
  ["CharterShares", "NEXT_PUBLIC_SHARES_ADDRESS"],
  ["MockConfidentialUSD", "NEXT_PUBLIC_MCUSD_ADDRESS"],
  ["DividendDistributor", "NEXT_PUBLIC_DISTRIBUTOR_ADDRESS"],
  // The active governance module is CharterResolutionsV2 (quorum-enforcing), swapped in live
  // through the share token's module registry. The original module remains on-chain as history.
  ["CharterResolutionsV2", "NEXT_PUBLIC_RESOLUTIONS_ADDRESS"],
  ["ConfidentialTenderOffer", "NEXT_PUBLIC_TENDER_ADDRESS"],
  ["DemoShareFaucet", "NEXT_PUBLIC_DEMO_FAUCET_ADDRESS"],
] as const;

type DeploymentArtifact = {
  address?: unknown;
};

function readAddress(deploymentsDir: string, contractName: string): string {
  const artifactPath = path.join(deploymentsDir, `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`missing deployment artifact: ${artifactPath}`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as DeploymentArtifact;
  if (typeof artifact.address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(artifact.address)) {
    throw new Error(`invalid address in deployment artifact: ${artifactPath}`);
  }
  return artifact.address;
}

function main() {
  const root = process.cwd();
  const deploymentsDir = path.join(root, "deployments", "sepolia");
  const envPath = path.join(root, "web", ".env.local");
  const lines = ARTIFACTS.map(([contractName, envName]) => {
    const address = readAddress(deploymentsDir, contractName);
    return `${envName}=${address}`;
  });

  fs.writeFileSync(envPath, `${lines.join("\n")}\n`);
  console.log(`Wrote ${envPath}`);
}

try {
  main();
} catch (error) {
  console.error(`export:addresses failed: ${(error as Error).message}`);
  process.exit(1);
}
