import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hardhatCli = require.resolve("hardhat/internal/cli/bootstrap.js");
const result = spawnSync(globalThis.process.execPath, [hardhatCli, "test", "test/broken.ts"], {
  cwd: packageRoot,
  encoding: "utf8",
});

if (result.error) {
  throw result.error;
}

const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const expectedTitle = "(e) does not make another holder's handle publicly decryptable";

if (result.status === 0) {
  throw new Error(`Broken conformance suite unexpectedly passed.\n${output}`);
}
if (!output.includes(expectedTitle) || !output.includes("protected handle ACL leak detected")) {
  throw new Error(`Broken suite failed for an unexpected reason.\n${output}`);
}
if (!/4 passing/.test(output) || !/1 failing/.test(output)) {
  throw new Error(`Broken suite did not produce the expected four-pass, one-failure result.\n${output}`);
}

globalThis.console.log("Negative control verified: four checks passed and the public-decryption leak check failed.");
