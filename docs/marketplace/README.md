# Charter module marketplace

The Charter module marketplace is a repository-curated catalog of extensions that builders can review before wiring them
to a Charter registry. It is documentation and evidence, not an on-chain registry, package registry, deployment service,
approval oracle, or guarantee that a contract is safe. The current catalog contains only first-party reference
implementations; the [third-party section](MODULES.md#third-party-modules) is empty.

Phase 1's external-adoption gate and Phase 2's external-module and real-organization gates remain open. A module written
in this repository does not count toward either external gate.

## Listing criteria

A third-party application module is eligible for review only when its submitted revision:

1. exposes the identity surface and follows every normative MUST and MUST NOT in the
   [`@charter/core` module ACL specification](../../packages/core/README.md#normative-module-acl-specification);
2. passes all five checks in [`@charter/conformance`](../../packages/conformance/README.md#checks) against the exact
   source revision submitted for listing;
3. publishes its source, license, compiler and dependency versions, immutable commit identifier, contract path, and
   deployment bytecode or explorer record when a deployment is claimed;
4. documents every separate authority it needs, including module registration, administrator or agent roles, holder
   operator approvals, upgrade authority, and any off-chain signer or service;
5. documents whether it escrows assets, who can move or recover them, and the complete decommission procedure;
6. states exactly which values remain encrypted and which addresses, timing, participation, aggregates, outcomes, or
   other data become public; and
7. distinguishes local tests, source review, independent audit, and live deployment evidence without treating one as
   another.

The five-check harness requires an exercised `allowBalanceAccess` or `getHandleAllowance` path. A standalone adapter or
control path that does not consume a registry-held handle cannot claim a conformance pass. It may appear in the
first-party reference inventory with conformance marked not applicable, but it is not an external marketplace module and
does not count toward the Phase 2 gate.

## Submit a module

Open a pull request that adds one row to [`MODULES.md`](MODULES.md) and includes all of the following in the pull
request description or a permanent evidence document in the submitted repository:

- source repository, immutable commit, contract path, contract name, and license;
- the exact versions of `@charter/core`, `@charter/conformance`, Solidity, `@fhevm/solidity`, and
  `@openzeppelin/confidential-contracts` used for the run;
- the conformance fixture and unedited output showing all five checks passing on the submitted revision;
- tests for every other security-sensitive function and branch that the single conformance exercise does not cover;
- required roles, approvals, escrow and recovery behavior, upgradeability, public outputs, and privacy limitations;
- any deployment's chain ID, address, source-verification link, and relationship to the submitted source; and
- audit or review status, with a report link when one exists, or an explicit statement that no independent review has
  occurred.

Repository maintainers reproduce the conformance run, inspect the submitted source and disclosures, and review whether
the evidence matches the row. Review is discretionary and may request narrower claims or more tests. Inclusion records
that the stated evidence was reviewed; it is not an endorsement, certification, independent audit, or instruction for an
administrator to register the module.

## Curation and delisting

Repository maintainers curate the catalog through normal pull-request review. A listing may be corrected, suspended, or
removed when:

- the listed source, deployment bytecode, proxy implementation, package contents, or dependency baseline changes;
- a conformance regression, unreported authority, privacy leak, custody risk, or material vulnerability is found;
- evidence can no longer be reproduced;
- privacy, audit, deployment, or external-adoption claims become misleading; or
- the source or license is no longer available on the terms recorded in the listing.

A maintainer should link the reason in the removal change. The publisher may submit a new revision with updated source
and evidence. Delisting changes only this catalog. It cannot disable deployed code, revoke FHE allowances, revoke agent
or administrator roles, expire holder approvals, or recover escrow. Registry administrators must execute the separate
decommission steps described by the module.

## Trust, privacy, and custody boundaries

The marketplace never takes custody of shares, payment tokens, private keys, decryption keys, or administrator rights.
Individual modules may escrow assets as part of their documented operation; that is a module-specific trust boundary,
not marketplace custody.

Registering a module is a confidentiality trust decision. An active module can request a holder balance and, through the
inherited handle manager, can request access to registry-held handles. A malicious authorized module can persist,
forward, or make a protected handle publicly decryptable. Removing it blocks future registry grants but cannot reverse
prior persistent or public ACL effects, revoke separate roles or operator approvals, or recover unknown escrow. See the
[core security self-review](../SECURITY-REVIEW.md#c-03-registered-module-fhe-acl-power) for the full boundary.

Conformance is behavioral evidence for one supplied action and two nominated handles on the Hardhat FHEVM mock. It does
not inspect every function, branch, handle, recipient, upgrade, network, deployment configuration, external call, or
off-chain component. A pass is not formal verification or an audit, and registration itself checks only deployed code
plus the module's `SHARES()` response. Source review, adversarial tests, deployment-bytecode verification, and an
independent audit remain necessary for production use.

ERC-7984 encrypts amounts, not transaction identity. Holder addresses, calls, timestamps or block numbers, operator
approvals, and participation may remain public, while a module may intentionally disclose a derived aggregate or
outcome. Each listing must state its narrower privacy guarantee instead of describing the module as simply private.
