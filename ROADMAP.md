# Charter Roadmap — from primitive to the ownership layer of the FHE economy

Charter today is a confidential equity-registry primitive: nine verified contracts on Sepolia, 70 passing tests, a live
self-serve demo, and a module registry that has already survived three live governance swaps (V1→V2→V3) and six bolt-on
modules without a share-token redeploy. That module registry is the seed of everything below.

The thesis of this roadmap: **every confidential asset in the Zama ecosystem needs an ownership registry, and none of
them should have to rebuild one.** Payroll needs vesting and gated issuance. Confidential funds need distributions and
tender. DAOs need hidden-weight voting. Today each team rebuilds these against raw ERC-7984. Charter's endgame is to be
the layer they compose with instead — the way OpenZeppelin became the default for token logic, but for confidential
ownership: registry, lifecycle, governance, and enforcement as audited, swappable modules.

Ambition is stated plainly below, and so are the gates. Each phase has a kill/verify criterion; a phase that misses its
gate blocks the next rather than being narrated past.

---

## Phase 0 — done (shipped, verified on Sepolia)

- ERC-7984 share registry with encrypted balances, observer access, module ACL, proof-verified supply disclosure.
- Nine composed modules live: dividends (pull-based claims), outcome-only governance with quorum and open proposals,
  confidential tender/buyback, cliff+linear vesting, default-deny gated issuance, M-of-N timelocked enforcement,
  demo faucets.
- Three live module swaps on the same share token — composability demonstrated on-chain, not claimed.
- Honest scoping: amount-privacy (not identity-privacy), primitive (not product), demo faucet ≠ compliant offering.

## Phase 1 — Harden the core into a dependency (0–3 months)

Being a hackathon winner and being a dependency are different standards. This phase closes the gap.

- **Extract `@charter/core`**: the share registry + module-ACL pattern as an installable package (contracts + TS
  bindings), so a third party deploys their own CharterShares in minutes instead of forking a repo. The module
  interface (`setModule`, transient ACL grants, `_validateHandleAllowance`) becomes a documented, versioned spec —
  the FHE-native equivalent of an ERC hook standard.
- **Module conformance test-kit**: a published hardhat/foundry suite a module author runs against their own module to
  prove it respects the ACL boundaries (no handle exfiltration, no unauthorized decrypt paths). This is the moat item:
  the hard part of writing an FHE module is not Solidity, it is not leaking ciphertext access — Charter makes that
  checkable.
- **Independent security review** of the core + ACL pattern (Zama grant/bounty budget if available; public self-audit
  with published findings otherwise). A dependency without an audit story stays a demo.
- **Identity-privacy option**: integrate stealth-address or commitment-based holder registration as an *optional*
  module, converting the known "hides amounts, not identities" limitation from a disclaimer into a roadmap item with
  a design doc and a prototype.
- **Gate:** one project we did not write deploys its own registry from `@charter/core` and passes the conformance kit.
  If nobody does even with direct support, the packaging is wrong — stop and fix onboarding before Phase 2.

## Phase 2 — Become infrastructure other builders choose (3–9 months)

- **Charter Module Marketplace**: a curated, conformance-tested registry of third-party modules (think: royalty
  splitters, SAFE-conversion, milestone escrow, secondary-transfer matching). Charter publishes the spec and the
  test-kit; builders publish modules; every new module makes the registry more valuable to the next deployer —
  the network effect that turns a library into an ecosystem.
- **Cross-protocol composition proofs**: live integrations with the strongest neighboring Zama-ecosystem projects —
  a confidential payroll paying into Charter vesting grants; a confidential fund running distributions through
  Charter's dividend module; hidden-weight voting offered to any ERC-7984 token via a thin adapter. Each proven with
  on-chain evidence in the E2E style this repo already uses, not partnership announcements.
- **The Charter Standard**: draft and publish an ERC for the confidential-module ACL pattern (working title:
  "Confidential Module Extensions for ERC-7984"), with Zama and OpenZeppelin confidential-contracts maintainers
  invited as co-authors. If the pattern is good, standardize it before someone standardizes a worse one.
- **Real-org pilot**: one real private company (or DAO treasury, or angel syndicate) runs a real cap-table event —
  a funding round's share issuance, a vesting schedule, one governed vote — on testnet with real participants and
  a signed writeup. Not real money yet; real *process*.
- **Gate:** ≥3 external modules in the marketplace and ≥1 real-org pilot completed. Misses here mean the demand thesis
  is wrong — revisit whether Charter should narrow to its strongest single module instead of the full registry.

## Phase 3 — The ownership layer of the FHE economy (9–24 months)

- **Mainnet, staged like an adult**: Zama mainnet deployment behind the audit from Phase 1, opt-in caps per registry,
  a published incident-response plan, and a canary registry running our own equity first. No big-bang launch.
- **Charter-as-a-Service**: hosted deployment flow (connect wallet → name registry → choose modules → deployed +
  verified), making a confidential ownership registry a 10-minute decision for a founder, not an FHE engineering
  project. The self-serve funnel this repo's judge-demo already prototypes, productized.
- **The compliance bridge**: partner integrations for the legal half Charter deliberately does not fake on-chain —
  e-signature/entity binding (the TokenOps-shaped seam), transfer-agent reporting exports, and jurisdiction-aware
  gated-issuance presets. Charter stays the cryptographic registry; partners own the legal wrapper; the seam between
  them is documented and tested.
- **Ecosystem heartbeat metrics, published live**: registries deployed, modules composed, encrypted events settled —
  a public dashboard in the spirit of this project's proof pages, so "heartbeat of the ecosystem" is a number anyone
  can check, not a slogan.
- **Gate / honest failure line:** if by month 18 no third-party asset lives on Charter rails without our involvement,
  the ecosystem-layer thesis has failed; the fallback is to fold the best modules upstream into
  `@openzeppelin/confidential-contracts` as contributions and keep Charter as the reference implementation.

---

## What we will not do

- No token. Charter's value accrues as infrastructure adoption, not as a speculative asset bolted onto a registry.
- No custody. Keys, shares, and decryption rights stay with holders; Charter never holds either side of a transfer.
- No legal cosplay. Contracts enforce process (quorums, timelocks, allowlists); they do not claim to verify court
  orders or securities law, and the docs will keep saying so.
- No silent scope creep past a failed gate. Each phase's gate is the tripwire; missing it triggers a public rescope,
  not a quieter definition of success.
