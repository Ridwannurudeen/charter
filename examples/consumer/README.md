# Standalone Charter consumer

This is a deliberately independent Hardhat project. It is outside the repository's npm workspaces and depends on the
packed `@gudman/charter-core` and `@gudman/charter-conformance` tarballs, not their workspace source directories.

The example deploys its own `CharterShares` registry on the local FHEVM mock, mints encrypted balances for two holders,
registers a custom `BalanceAttestationModule`, verifies its private derived attestation, and runs all five conformance
checks against that module.

## Run from a clean checkout

Starting at the repository root, create both local package tarballs:

```bash
cd packages/core
npm pack
cd ../conformance
npm pack
cd ../../examples/consumer
```

The two pack commands create the exact files referenced by this project's `package.json`:

- `../../packages/core/charter-core-0.1.0.tgz`
- `../../packages/conformance/charter-conformance-0.1.0.tgz`

Install only inside this standalone project from its committed lockfile, then typecheck and test it:

```bash
npm ci
npm run verify
```

`npm run verify` runs TypeScript checking and the Hardhat test suite. A successful run deploys a fresh registry for each
conformance check and reports the module's five checks as passing.

## What this proves

This simulates the Phase 1 onboarding path: a project outside the monorepo workspaces installs packed artifacts, deploys
its own registry, registers its own module, and runs the published conformance harness.

It does **not** satisfy the ROADMAP Phase 1 gate. This repository's authors wrote this example. The gate requires a real
external team to complete the same flow in its own project. The conformance result is also a behavioral boundary check,
not a security audit or proof that unexercised module paths are safe.

No command in this example publishes a package or deploys a contract to a public network.
