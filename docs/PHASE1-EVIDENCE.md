# Phase 1 packaging and consumer evidence

Run date: 2026-07-11

This record covers the local Phase 1 implementation path: package the core, package the conformance harness, install
both tarballs in a non-workspace project, deploy a fresh registry and custom module, and run every required test. No npm
package was published and no contract was deployed to a public network.

## Status

| Deliverable                | Evidence                                                                                         | Status                           |
| -------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| Core dependency            | [`@gudman/charter-core`](../packages/core/README.md), deploy helper, contracts, artifacts, types | Packed and tested locally        |
| Module conformance         | [`@gudman/charter-conformance`](../packages/conformance/README.md), positive and negative suites | Packed and tested locally        |
| Security review            | [Public self-review](SECURITY-REVIEW.md) with ten findings                                       | Internal audit preparation       |
| Identity privacy           | [Design](design/IDENTITY-PRIVACY.md) and experimental local adapter                              | Local prototype only             |
| Independent consumer       | [`examples/consumer`](../examples/consumer/README.md)                                            | Tarball-only path passes locally |
| Real external-team gate    | A project not written by this repository's authors                                               | Open                             |
| Independent external audit | Review by a separate security team                                                               | Open                             |

The local consumer is deliberately not counted as the ROADMAP gate. It proves that the onboarding path works under the
same repository's control; a real external team must still reproduce it independently.

## Environment

```text
Node.js v24.15.0
npm 11.12.1
Hardhat 2.28.6
Solidity 0.8.27, Cancun, optimizer 800 runs
@fhevm/solidity 0.11.1
@openzeppelin/confidential-contracts 0.5.1
@openzeppelin/contracts 5.6.1
ethers 6.17.0
```

## Package builds

The package tarballs were created from their package directories so the consumer's relative file dependencies match the
generated paths exactly.

```bash
cd packages/core
npm pack
cd ../conformance
npm pack
```

Core pack result:

```text
@gudman/charter-core@0.1.0
charter-core-0.1.0.tgz
package size: 83.9 kB
unpacked size: 553.9 kB
total files: 48
```

The 48 files are `LICENSE`, `README.md`, `package.json`, two Solidity source files, three exact contract artifacts, and
the compiled deploy helper and TypeChain JavaScript, declarations, and source maps under `dist/`.

Conformance pack result:

```text
@gudman/charter-conformance@0.1.0
charter-conformance-0.1.0.tgz
package size: 7.8 kB
unpacked size: 29.7 kB
total files: 7
```

Its seven files are `LICENSE`, `README.md`, `package.json`, and the JavaScript, declaration, and two source-map files
under `dist/src/`.

Listing both archives with `tar -tf` confirmed that they contain no environment files, deployment records, internal
briefs, signing material, or unrelated application contracts.

## Independent consumer run

`examples/consumer` is not matched by the root `packages/*` workspace. Its lockfile resolves
`@gudman/charter-core@0.1.0` and `@gudman/charter-conformance@0.1.0` from the two generated tarballs.

The final `npm ci` used an isolated empty npm cache. Both archive SHA-512 values match the lockfile, and the installed
package manifests match the packed manifests.

After clearing prior build outputs, the recorded clean install and verification were:

```bash
cd examples/consumer
npm ci
npm run verify
```

Output excerpt:

```text
added 387 packages, and audited 388 packages

> charter-independent-consumer@0.1.0 typecheck
> tsc --noEmit

> charter-independent-consumer@0.1.0 test
> hardhat test

Compiled 50 Solidity files successfully (evm target: cancun).

standalone Charter consumer
  1 passing assertion for the private derived attestation

BalanceAttestationModule Charter module conformance
  (a) rejects FHE use without an explicit grant
  (b) scopes and expires the transient grant
  (c) gains no agent or administrator rights
  (d) receives no new grants after unregistration
  (e) does not make another holder's handle publicly decryptable

6 passing
```

The clean npm install reported 25 development dependency-tree audit findings: 14 low, 8 moderate, and 3 high.
`npm audit --omit=dev` reported zero production vulnerabilities after raising the minimum ethers version to 6.17.0. No
automatic audit fix was applied to the remaining development tree because that could silently change the verified
Hardhat/FHEVM toolchain; dependency upgrades require a separate compatibility review.

## Repository and workspace tests

Root suite:

```bash
npx hardhat test
```

```text
72 application and integrity tests
4 experimental identity-privacy tests
15 conformance checks across three existing modules
91 passing (5s)
```

Core workspace:

```bash
npm test --workspace @gudman/charter-core
```

```text
deployCharterRegistry
  2 passing
```

Conformance workspace:

```bash
npm test --workspace @gudman/charter-conformance
```

```text
HonestBalanceAccessProbe Charter module conformance
  5 passing

Negative control verified: four checks passed and the public-decryption leak check failed.
```

The negative fixture's failure is required evidence: the harness rejects its deliberate public-decryption leak instead
of merely demonstrating that honest fixtures pass.

## Static checks and frozen surfaces

The final repository gate runs:

```bash
npm run lint
npm run build:ts
npm run build:workspaces
npm run prettier:check
git diff --check
```

All complete without errors. The Solidity source search returns one `CharterShares.sol`, under
`packages/core/contracts/`; application modules import that package path rather than carrying copies.

A path-scoped diff from the pre-Phase 1 commit is empty for the existing Sepolia deployment records, the three live
frontend integration files, and `docs/E2E-RUN.md`. The nine deployed contracts and their evidence history therefore
remain unchanged. The new security fixes and experimental adapter are source-level, local-only work and must not be
described as deployed.

## Remaining gates

- Publish neither package until the owner explicitly approves the release.
- Obtain a genuinely independent security review of the pinned core and module boundary.
- Have a real external team install the released packages, deploy its own registry, and pass conformance in its own
  project. Until that happens, ROADMAP Phase 1's adoption gate remains open.
