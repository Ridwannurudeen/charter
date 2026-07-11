# Confidential Module Extensions for ERC-7984

| Field          | Value                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| ERC            | TBD                                                                      |
| Title          | Confidential Module Extensions for ERC-7984                              |
| Description    | Grant-scoped application modules for confidential fungible token handles |
| Author         | TBD before submission                                                    |
| Discussions-To | Not assigned; this in-repository draft has not been submitted            |
| Status         | Draft                                                                    |
| Type           | Standards Track                                                          |
| Category       | ERC                                                                      |
| Created        | 2026-07-11                                                               |
| Requires       | [ERC-7984](https://ercs.ethereum.org/ERCS/erc-7984)                      |

This is an in-repository working draft. It has not been submitted to the Ethereum ERCs repository, assigned an ERC
number, reviewed by ERC editors, or endorsed by ERC-7984, Zama, or OpenZeppelin maintainers.

## Abstract

This specification defines an application-module access-control pattern for confidential fungible token registries. An
ERC-7984 host keeps an explicit module registry and exposes two grant paths: a transaction-scoped grant for a holder's
current balance pointer, and a validated grant for another confidential pointer held by the host. A module receives no
balance pointer merely because it is enabled; it requests the input needed for one application operation and completes
that computation in the same transaction.

The pattern supports application-layer functions such as distributions, governance, vesting, tender offers, and gated
issuance without putting every module in the token's transfer lifecycle. It specifies module identity, registration,
grant use, disclosure, removal, and recovery obligations. It does not make arbitrary module code safe, and it cannot
revoke persistent or public access created by a malicious or defective module.

## Motivation

ERC-7984 standardizes confidential fungible-token pointers and transfers while leaving pointer resolution and
manipulation implementation-specific. Applications that compute over a token's private state still need a shared way to
answer four questions:

1. Which application contracts may request a confidential pointer held by the token?
2. How does an authorized application receive only the pointer needed for the current operation?
3. Which obligations prevent that application from persisting, forwarding, or disclosing a holder-level input?
4. What does disabling an application revoke, and what authority survives removal?

Without a common boundary, each application either embeds its logic in the token, receives standing confidential access,
or invents an incompatible grant interface. Embedding application logic makes upgrades and independent review harder.
Standing access enlarges the confidentiality blast radius. Incompatible interfaces prevent reusable modules and shared
conformance tests.

This specification separates application authorization from transfer authorization. Module registration permits a
contract to request a narrowly timed grant; it does not grant an agent role, administrator role, token-operator
approval, or automatic participation in transfers.

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT
RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Scope and terminology

This extension applies to ERC-7984 implementations whose confidential-pointer system supports access-control grants with
transaction-scoped and persistent lifetimes. An implementation without a transaction-scoped grant primitive MUST NOT
claim conformance with the transient-grant requirements in this specification.

- **Host**: the ERC-7984 token registry that owns or is permitted to use a confidential pointer.
- **Module**: an application contract enabled by one host.
- **Active module**: a module for which the host's `isModule` query returns `true`.
- **Handle**: the `bytes32` confidential pointer used by an FHE-based ERC-7984 implementation.
- **Transient grant**: permission that exists only for the transaction in which it is created.
- **Persistent grant**: permission that survives the transaction in which it is created.
- **Source handle**: a holder balance, voting weight, checkpoint, or other holder-level input supplied by the host.
- **Derived result**: a new confidential pointer computed from one or more inputs, rather than an alias of a source
  handle.

### Interfaces

The following Solidity interfaces describe the required ABI. The `bytes32` spelling follows ERC-7984. An implementation
MAY use an ABI-compatible user-defined value type, such as the reference implementation's `euint64` over `bytes32`.

```solidity
interface IERC7984ApplicationModule {
  function SHARES() external view returns (address);
}

interface IERC7984ApplicationModuleHost {
  event ModuleSet(address indexed module, bool enabled);

  function isModule(address module) external view returns (bool);
  function setModule(address module, bool enabled) external;
  function allowBalanceAccess(address account) external returns (bytes32 balance);
  function getHandleAllowance(bytes32 handle, address account, bool persistent) external;
}
```

`SHARES` identifies the host token for this draft's ABI. It does not require the ERC-7984 token to represent corporate
shares.

An escrowing module SHOULD expose this optional recovery ABI. `IERC7984` is represented as `address` at the ABI
boundary.

```solidity
interface IERC7984ApplicationModuleFundsRecoverable {
  function sweep(address token, address to) external;
}
```

This specification does not assign ERC-165 interface identifiers. The in-repository reference implementation predates
this draft and does not advertise a dedicated interface identifier.

### Module identity and authorization

- A module MUST expose `SHARES() external view returns (address)`, and it MUST return the host passed to `setModule`.
- The host MUST restrict both enabling and disabling modules to its designated module administrator. An unauthorized
  call MUST revert.
- When enabling a module, the host MUST reject the zero address, an address without deployed code, and a module whose
  `SHARES()` result is not the host's address.
- A successful `setModule(module, enabled)` call MUST make `isModule(module)` return `enabled` and MUST emit
  `ModuleSet(module, enabled)`.
- Registration is an explicit confidentiality trust decision, not a security sandbox.
- A module MUST NOT grant itself an agent role, administrator role, operator approval, or any authority outside the
  capability the administrator configured separately.
- A module that also needs an agent role or a holder's operator approval MUST document that separate authority and its
  revocation procedure. Module registration does not imply either authority.

### Balance-handle grants

- A module MUST obtain a current holder balance through `allowBalanceAccess(holder)`. Reading
  `confidentialBalanceOf(holder)` returns a pointer but does not grant the module permission to compute on it.
- `allowBalanceAccess` MUST revert unless its caller is an active module.
- For an initialized balance handle, `allowBalanceAccess` MUST grant the calling module transient permission and MUST
  return that same handle. It MUST NOT grant another account or create persistent permission.
- A module MUST finish every computation that depends on the transient balance input in the transaction that obtained
  it.
- A module MUST NOT persist the raw balance handle, grant it to itself or another address, delegate it to another
  contract, or make it publicly decryptable.
- A module MAY persist a newly derived result only after granting that result to itself. It MAY grant that derived
  result to an intended recipient when the module's documented privacy policy requires it.

### Other host-held handles

- A module MAY request access through `getHandleAllowance(handle, account, persistent)` only when `handle` was obtained
  from that host for the operation being executed.
- The host MUST reject a `getHandleAllowance` request whose caller is not an active module. A host MAY impose stricter
  handle-specific policy.
- A conforming module MUST pass its own address as `account` and `false` as `persistent`.
- A module MUST NOT request access for a third party or request persistent access to a source handle.
- The host's internal allowance validation authorizes the active caller. In the reference implementation it does not
  identify which handle the module should use or bind the requested recipient and lifetime. Correct handle selection,
  recipient selection, and transient lifetime are therefore module obligations.

### Outputs and disclosure

- A module MUST NOT make a holder balance, vote-weight handle, or other holder-level source handle publicly decryptable.
- A module MAY make a newly derived aggregate or outcome publicly decryptable only when that disclosure is part of its
  documented interface and reveals no forbidden source handle.

### Removal and recovery

- `setModule(module, false)` MUST block that module's future calls to `allowBalanceAccess` and `getHandleAllowance`.
- Removal does not revoke persistent grants, public-decryption flags, agent roles, administrator roles, operator
  approvals, or handles already stored by a module. An implementation MUST NOT describe module removal as revoking those
  separate effects.
- Before treating a module as retired, a decommission procedure MUST disable future host grants, revoke each separately
  applicable role and operator approval, recover known escrowed funds, and assess any prior persistent or public grant.
- A module that escrows confidential tokens SHOULD implement
  `IERC7984ApplicationModuleFundsRecoverable.sweep(token, to)` so the host can recover known assets after the module is
  disabled.

## Rationale

### Explicit registration with per-call grants

Registration makes the trust decision observable while keeping confidential access default-deny at the usage boundary.
An active module receives no holder balance merely by being listed. It must request a current handle during the
application call that consumes it. A transient grant limits accidental standing access and makes the intended handle
lifetime testable.

Application modules are untrusted by default with respect to automatic input delivery: registration alone supplies no
balance handle. This is not an untrusted-code sandbox. Once an active module receives a source handle, a hostile
implementation may use the underlying confidential-computation ACL to persist, forward, or disclose it. The normative
module rules and conformance tests reduce integration mistakes; administrator review remains part of the security model.

### Separate paths for balances and other handles

Balances have a canonical lookup, so `allowBalanceAccess(holder)` can retrieve the current handle and grant it in one
operation. Other application inputs, such as encrypted vote checkpoints, are selected by the module's workflow. The
generic `getHandleAllowance` path permits those use cases without adding an endpoint for every application, at the cost
of making correct handle selection a module obligation.

### Module identity getter

The `SHARES()` getter prevents accidental registration of a module configured for another host. It establishes binding
to a host address, not code safety, immutability, conformance, or upgrade safety. A proxy can preserve the getter while
changing its implementation.

### Relationship to OpenZeppelin hook modules

OpenZeppelin Confidential Contracts 0.5.1 provides
[`IERC7984HookModule`](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts/blob/v0.5.1/contracts/interfaces/IERC7984HookModule.sol)
and
[`ERC7984Hooked`](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts/blob/v0.5.1/contracts/token/ERC7984/extensions/ERC7984Hooked.sol).
That prior-art pattern and this specification solve different lifecycle problems:

| Property                | `IERC7984HookModule` / `ERC7984Hooked`                           | Application-module ACL in this draft                        |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Invocation              | Host calls every installed module before and after each transfer | Application or user calls a module for a specific operation |
| Transfer-path authority | Pre-transfer hook can reduce a transfer to zero                  | Module is not automatically in the transfer path            |
| Input grant             | Host grants the encrypted transfer amount to each hook           | Module explicitly requests a balance or another host handle |
| Typical use             | Transfer policy and transfer-coupled accounting                  | Governance, distributions, vesting, tender, issuance        |
| Failure effect          | Hook revert reverts the token transfer                           | Module revert affects the application call                  |
| Trust boundary          | Installed hooks are explicitly trusted with host-private state   | Active modules are trusted to obey grant obligations        |

`ERC7984Hooked` calls `preTransfer` and `postTransfer` from its token update path, grants each hook transient access to
the transfer amount, and lets installed hooks request any handle the token can access. Its source explicitly warns that
hook modules are trusted and that allowances may persist after uninstall. Hook modules are appropriate when policy or
accounting must execute for every transfer.

Application modules are appropriate when logic should run only for an explicit higher-level operation and should not add
cost, availability risk, or veto power to unrelated transfers. The two patterns are complementary and MAY be used by the
same ERC-7984 host, but their registries and decommission procedures remain independent unless an implementation
explicitly unifies them.

## Backwards Compatibility

This proposal is an optional extension to ERC-7984 and does not change its transfer, operator, event, or receiver ABI.
Existing ERC-7984 tokens remain valid without implementing this extension. Existing modules require no changes when
their ABI and behavior already satisfy the interfaces and obligations above.

Hosts that cannot create transaction-scoped confidential-pointer grants cannot implement the required balance-grant
semantics. Hook-only ERC-7984 implementations do not become application-module hosts merely by exposing
`IERC7984HookModule`; the invocation model and required ABI differ.

## Test Cases

The reference conformance package exercises five observable boundaries against a fresh host and module:

1. no FHE operation on the nominated source handle before an explicit grant;
2. use and expiry of the nominated transient grant without access to another holder's handle;
3. no agent or administrator escalation from registration;
4. no new host grant after removal; and
5. no persistent or public grant for the exercised source handles.

Its negative control deliberately makes another holder's balance publicly decryptable and is expected to fail the fifth
check. These cases are behavioral evidence for one supplied action and two supplied handles. They are not proof of
conformance for untested functions, branches, recipients, handles, upgrades, or networks.

## Security Considerations

### Registration is a confidentiality trust decision

An active module can request confidential handles that the host is permitted to use. In the reference implementation,
the generic handle path validates the caller's active status but cannot enforce the module's claimed source, recipient,
or lifetime. A malicious module can therefore violate this specification even though it exposes the required ABI.
Administrators MUST review pinned implementation code and SHOULD run adversarial tests for every sensitive path before
registration and after any upgrade.

### Grant lifetime and irreversible disclosure

Transient permission ends with the transaction; it does not prevent the authorized module from creating a persistent
grant or public-decryption flag during that transaction. The reviewed ACL exposes no general revocation mechanism for a
persistent allowance or public-decryption flag. A source handle made public cannot be made confidential again by
disabling the module.

Derived outputs require the same scrutiny. A public aggregate or outcome can leak a private input when its anonymity set
is small, when repeated queries permit differencing, or when the output aliases rather than derives from the input.
Modules MUST document intended disclosure and MUST NOT label a pointer as derived merely to bypass the source-handle
rules.

### Removal and module swaps

Removal revokes only future host grants. Stored handles, prior ACL effects, roles, operator approvals, escrow, and
module-owned state may survive. Enabling a replacement before disabling its predecessor creates a trust overlap;
disabling the predecessor first creates an availability gap. Implementations SHOULD pause affected application workflows
during a swap and MUST inventory each independent authority in the decommission runbook.

### Recovery is cooperative

A host cannot generally enumerate every confidential asset held by a module or force an arbitrary module to implement
recovery correctly. A `sweep` call may revert, ignore an asset, or transfer an amount that cannot be verified publicly.
Recovery events MUST NOT be treated as proof of a clear amount received.

### Privacy scope

This specification governs access to confidential pointers. It does not hide account addresses, transaction senders,
module addresses, call timing, event count, calldata shape, or other public metadata. Conformance with this extension is
not a claim of identity privacy, legal compliance, custody safety, or production readiness.

### Conformance testing is not an audit

A conformance run observes only the supplied execution paths and handles. It does not establish bytecode immutability,
exclude hidden branches, analyze an upgrade administrator, or verify behavior on another confidential-computation
backend. Source review and an independent security assessment remain required for privileged production modules.

## Reference Implementation

The local reference implementation is pinned to `@gudman/charter-core` 0.1.0, `@openzeppelin/confidential-contracts`
0.5.1, and `@fhevm/solidity` 0.11.1:

- [`CharterShares.sol`](../../packages/core/contracts/CharterShares.sol) implements the host registry, balance grant,
  and handle validation. Public repository URL:
  <https://github.com/Ridwannurudeen/charter/blob/main/packages/core/contracts/CharterShares.sol>.
- [`ICharterModule.sol`](../../packages/core/contracts/interfaces/ICharterModule.sol) defines module identity and the
  optional recovery surface. Public repository URL:
  <https://github.com/Ridwannurudeen/charter/blob/main/packages/core/contracts/interfaces/ICharterModule.sol>.
- [`@gudman/charter-core` documentation](../../packages/core/README.md) contains the matching normative module
  obligations. Public repository URL: <https://github.com/Ridwannurudeen/charter/tree/main/packages/core>.
- [`@gudman/charter-conformance`](../../packages/conformance/README.md) implements the behavioral test cases and
  intentional negative control. Public repository URL:
  <https://github.com/Ridwannurudeen/charter/tree/main/packages/conformance>.
- The [`security self-review`](../SECURITY-REVIEW.md) records the accepted ACL, removal, swap, and recovery risks. It is
  internal audit preparation, not an independent audit.

These references are implementations and test evidence, not evidence that this draft has been accepted, assigned a
number, or deployed as a standard.

## Copyright

Copyright terms for a future ERC submission remain subject to author approval. A submitted version would need the CC0
waiver required by the official ERC template; this in-repository draft remains under the repository's existing license.
