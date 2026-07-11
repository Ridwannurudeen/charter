# Charter core security self-review

> **Status:** Internal security self-review and independent-audit preparation. This is not an independent audit,
> certification, formal verification, or statement that the system is safe for production value.

Review date: 2026-07-11

## Scope and baseline

The strict review scope is the Phase 1 `@charter/core` registry and its module boundary:

- [`CharterShares.sol`](../packages/core/contracts/CharterShares.sol)
- [`ICharterModule.sol`](../packages/core/contracts/interfaces/ICharterModule.sol)
- the inherited ERC-7984 RWA, voting, observer, and handle-access behavior used by the registry
- the module obligations documented in the [`@charter/core` README](../packages/core/README.md)
- the behavioral checks and stated limits in the [`@charter/conformance` README](../packages/conformance/README.md)

Two application contracts were checked only where they touch the core boundary:

- [`DividendDistributor.sol`](../contracts/DividendDistributor.sol), for record-date integrity
- [`ForceTransferGuardian.sol`](../contracts/ForceTransferGuardian.sol), for the recommended force-transfer path

Those are adjacent boundary checks, not an expansion of the reviewed core into every application module. Frontends,
wallets, relayers, KMS and coprocessor implementations, legal compliance, experimental identity privacy, deployment key
management, and the security of upstream dependencies are outside scope. This review describes the Phase 1 source; it
does not claim that an earlier deployed contract has these remediations.

Version baseline:

| Component                              | Reviewed version/configuration                    |
| -------------------------------------- | ------------------------------------------------- |
| `@charter/core`                        | `0.1.0`                                           |
| Solidity                               | `0.8.27`, Cancun, optimizer enabled with 800 runs |
| `@fhevm/solidity`                      | `0.11.1`                                          |
| `@openzeppelin/confidential-contracts` | `0.5.1`                                           |
| `@openzeppelin/contracts`              | `5.6.1`                                           |
| Hardhat                                | `2.28.6`                                          |

## Method

The review traced inheritance and external calls, enumerated admin/agent/module/operator capabilities, and walked these
state transitions adversarially:

1. supply-disclosure request, supply mutation, and proof finalization;
2. distribution declaration, ledger mutation, and payout;
3. module enable, overlap, disable, and fund recovery;
4. transient, persistent, delegated, and public FHE handle access;
5. pause, force transfer, recovery, and guardian execution.

Focused regression tests were written red-first for the two fixed integrity findings. The root suite, Solidity lint,
TypeScript checks, and formatting passed after remediation. The conformance package also includes an intentionally
leaking negative control; its expected failure is part of the test, not a passing-module guarantee.

Severity is based on plausible impact within the stated trust model. “Accepted” means the behavior remains and must be
handled operationally; it does not mean the risk is harmless.

## Findings register

| ID   | Severity | Finding                                                                                               | Status                              |
| ---- | -------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------- |
| C-01 | High     | A supply change between disclosure request and finalization could make an old total appear current    | Fixed                               |
| C-02 | High     | A balance change after distribution declaration could corrupt the record-date basis                   | Fixed; adjacent distributor         |
| C-03 | High     | A registered module can persist, forward, or publicly disclose registry-held handles                  | Accepted architectural risk         |
| C-04 | High     | Module removal revokes only future registry grants, not other authority or prior FHE effects          | Accepted architectural risk         |
| C-05 | Medium   | Module swaps permit an overlap or availability gap unless the admin sequences them atomically         | Accepted operational risk           |
| C-06 | Low      | A proof may be reused after a new request for the same unchanged supply handle                        | Accepted residual risk              |
| C-07 | Medium   | Pause does not constrain force-transfer agents; record-date modules need an independent state version | Mitigated; privileged risk accepted |
| C-08 | Medium   | The guardian is a policy layer, not an exclusive force-transfer gate                                  | Accepted; adjacent guardian         |
| C-09 | Medium   | Module identity checks prevent accidents but do not establish code safety or immutability             | Mitigated; review still required    |
| C-10 | Medium   | Module fund recovery trusts an external `sweep` implementation and a known token list                 | Accepted operational risk           |

## Detailed findings

### C-01: supply-disclosure request/finalize race

**Evidence and prior exploit path.** `requestSupplyDisclosure` exposes the current encrypted supply for public
decryption, while `finalizeSupplyDisclosure` later accepts the matching KMS proof. Before remediation, an agent could
request disclosure, mint or burn, and then finalize the old proof. The old total was stored while the record timepoint
was stamped at finalization, so `supplyDisclosureStale()` could return false.

**Impact.** A consumer could use an outdated denominator as a current supply record, producing incorrect pro-rata
results.

**Fix and verification.** [`CharterShares`](../packages/core/contracts/CharterShares.sol) now increments `supplyVersion`
on every mint/burn, captures that version and the clock at request time, and records the captured values at
finalization. Staleness compares current and recorded versions. The regression test “keeps an old disclosure stale when
supply changes after the request” verifies both the stale result and request-time `recordTimepoint`.

Finalization intentionally remains permissionless and may finalize an old request once; after an intervening supply
change, the result is marked stale. Every consumer MUST check `supplyDisclosureStale()` before relying on the record.

### C-02: distribution record-ledger drift

**Evidence and prior exploit path.** A distribution previously captured the disclosed total while paused but later read
live holder balances. An agent could unpause, balances could move, and the agent could pause again without changing
total supply. The supply-staleness check alone would still pass.

**Impact.** Payouts could use post-record balances against a pre-record denominator, moving value between holders or
making aggregate payout math inconsistent with the declaration.

**Fix and verification.** The core now increments `ledgerVersion` on every successful `_update`, including transfers,
mints, burns, recoveries, and force transfers. The adjacent
[`DividendDistributor`](../contracts/DividendDistributor.sol) stores that version outside the existing `Distribution`
struct and requires an exact match in both `payBatch` and `claim`. The regression test “rejects payouts when balances
change after the distribution record” covers both paths.

This is deliberately conservative: even an update that ultimately transfers zero invalidates the record. Once invalid,
the distribution cannot resume; the issuer must recover remaining escrow and declare a fresh record. That availability
cost is accepted in exchange for deterministic record-date integrity.

### C-03: registered-module FHE ACL power

**Evidence.** `allowBalanceAccess(account)` lets any active module request any holder’s current balance and gives the
caller transient access. Inherited `getHandleAllowance(handle, account, persistent)` accepts a caller-selected account
and persistence flag. The core’s `_validateHandleAllowance` checks only whether the caller is an active module; it does
not bind the handle or recipient. The FHE ACL permits an authorized caller to persist access, forward it, or make the
handle publicly decryptable.

**Impact.** A malicious or compromised registered module can irreversibly widen access to holder balances, voting
weights, or other handles for which the registry has permission. Registration is therefore a confidentiality trust
decision, not sandboxing.

**Accepted-risk rationale and verification.** Restricting every valid module computation in the registry would require
application-specific policy and would defeat the generic module boundary. The normative core specification instead
forbids persistence, forwarding, and disclosure of source handles. `@charter/conformance` observes those behaviors for
one supplied action and two supplied handles and proves its negative control is detected. It does not cover untested
functions, branches, handles, recipients, upgrades, or networks. Source review and an independent audit remain required.

### C-04: module removal is not complete revocation

**Evidence.** `setModule(module, false)` changes only `isModule`. It blocks future `allowBalanceAccess` and
`getHandleAllowance` requests, but it does not revoke:

- persistent ACL entries or public-decryption flags already created;
- `AGENT_ROLE`, admin roles, or holder operator approvals;
- handles or derived state stored by the module;
- module functions that can continue using their own stored permissions without requesting a new registry grant.

The pinned FHE ACL surface exposes transient cleanup but no general revocation of a persistent handle allowance or a
public-decryption flag.

**Impact.** Treating `ModuleSet(module, false)` as a kill switch can leave confidentiality, mint/burn, transfer, escrow,
or stored-state authority active.

**Accepted-risk rationale.** Authorities originate in different systems and cannot honestly be collapsed into one
boolean. A decommission procedure MUST disable future registry grants, revoke agent/admin roles, revoke or expire holder
operator approvals, recover known escrow, and assess prior persistent/public ACL effects. A module with irreversible ACL
effects cannot be made confidential again by removal.

### C-05: module swap overlap and gap

**Evidence.** `isModule` is an independent boolean per address. The registry has no module class, canonical active slot,
or enforced old-to-new transition. Enabling the replacement first creates a period when both modules are trusted;
disabling the old module first creates an availability gap.

**Impact.** During overlap, both modules may request handles. During a gap, dependent operations fail. Roles, operator
approvals, and escrow can also remain attached to the old module after the mapping changes.

**Accepted-risk rationale.** This remains an administrator-controlled deployment operation. The inherited `multicall`
can batch enable/disable calls in one transaction, and `disableModuleAndRecover` atomically disables and attempts known
fund recovery, but neither function identifies mutually exclusive modules or completes the C-04 checklist. Swap runbooks
must name the intended ordering, pause affected workflows, and verify every separate authority.

### C-06: proof replay after version remediation

**Evidence.** Finalization verifies the pending handle and clear value, then clears the pending handle. An immediate
second finalization therefore reverts. A later request for a different supply handle rejects an old proof because the
verified handle differs. If supply is unchanged and a later request exposes the same handle again, the prior valid proof
can be accepted because the KMS proof is not bound to a Charter request nonce.

**Impact and accepted-risk rationale.** For the same unchanged handle, the clear supply and captured `supplyVersion`
remain accurate; reuse does not make a changed supply current. If supply changed after the original request, C-01 marks
that finalized record stale. Request-nonce replay prevention would add state without improving supply integrity under
these semantics. Consumers must still enforce the staleness check rather than treating proof validity as freshness.

### C-07: pause, record dates, and force transfer

**Evidence.** Normal ERC-7984 updates require an unpaused token. `forceConfidentialTransferFrom` and address recovery
are agent-only paths that bypass pause and restriction checks; frozen amounts remain excluded. Any existing agent can
use those paths directly. An admin is not automatically an agent, but can grant an agent role.

**Impact.** Pause is not protection against the issuer’s enforcement authority. A force transfer during a record window
changes balances even though the token remains paused.

**Mitigation and residual risk.** `ledgerVersion` increments through the shared `_update`, so the adjacent distributor
rejects payout after normal or forced balance changes. This protects that module’s record integrity but does not remove
the underlying force-transfer trust. Production role policy should keep enforcement agents minimal and monitored.

### C-08: force-transfer guardian boundaries

**Evidence.** The adjacent guardian validates unique, nonzero guardians and a reachable threshold. Quorum starts an
immutable block delay; anyone may execute after it. The guardian list, threshold, and delay cannot be changed, and there
is no cancellation, expiry, or confirmation withdrawal. A zero delay is accepted by the constructor.

**Impact.** Lost or compromised guardian keys require deploying a replacement and changing token roles. A confirmed
proposal remains executable indefinitely. More importantly, another token agent can bypass the guardian and force a
transfer directly; an admin can grant such an agent role.

**Accepted-risk rationale and verification.** The guardian is an auditable policy path, not an on-chain claim that every
force transfer passed it. It is effective only when it is the sole enforcement agent and admin operations follow an
external governance policy. Tests cover constructor validation, quorum, duplicate confirmation, timelock, endpoint
validation, and single execution. Production configuration MUST use a nonzero delay and independently held keys.

### C-09: module identity validation

**Evidence and mitigation.** Enabling a module requires deployed code and a `SHARES()` getter equal to the registering
registry. This rejects EOAs and accidental cross-registry registration.

**Residual impact and rationale.** The check does not establish an interface beyond that getter, validate bytecode,
enforce conformance, or prevent a proxy from changing implementation later. A malicious module can return the expected
address and still violate every ACL obligation. The check is an identity guard, not security approval; admins must pin
and review implementation code and rerun conformance after upgrades.

### C-10: module fund-recovery boundary

**Evidence.** Recovery is admin-only, requires the module to be disabled, and calls the module’s external
`sweep(token, to)` for an administrator-supplied token list. The registry cannot enumerate confidential assets, verify a
clear recovered amount, or force a non-conforming module to cooperate. A module may revert, ignore an asset, or
implement different authorization. In the combined disable-and-recover functions, any failed sweep reverts the entire
transaction, including the disable.

**Impact and accepted-risk rationale.** Funds can remain inaccessible or recovery can be delayed by module behavior. The
boundary is intentionally explicit because the registry does not custody module escrow. Escrowing modules SHOULD
implement and test the recovery interface, inventories must list every supported token, and recovery events must not be
treated as proof of a clear amount received.

## Review conclusion and next gate

The two identified record-integrity defects have source-level fixes and regression coverage. The dominant remaining risk
is deliberate: an enabled module is trusted with powerful FHE capabilities that the registry cannot later unwind. The
package specification and conformance kit make that boundary testable and visible, but they do not replace review.

Before production use, obtain an independent review of the pinned core and each privileged module, rerun all root and
workspace tests from a clean install, review role and decommission runbooks, and bind the reviewed source to the exact
deployment bytecode. Until then, this document is audit preparation only.
