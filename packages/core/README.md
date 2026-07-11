# @charter/core

`@charter/core` is the reusable Charter ownership registry: an ERC-7984 confidential share token, RWA controls,
encrypted voting checkpoints, observer access, verifiable aggregate-supply disclosure, and the trusted module ACL used
by Charter applications.

The package contains the Solidity sources, compiled artifacts and ABIs, generated ethers v6 bindings, and a deployment
helper. Application modules are deliberately outside this package.

## Install

Until the owner approves an npm release, build and install the package tarball locally:

```bash
npm pack --workspace @charter/core
npm install ./packages/core/charter-core-0.1.0.tgz
```

A Solidity consumer imports the registry from the package rather than copying it:

```solidity
import { CharterShares } from "@charter/core/contracts/CharterShares.sol";
```

## Deploy a registry

```ts
import { deployCharterRegistry } from "@charter/core";
import { ethers } from "hardhat";

const [deployer] = await ethers.getSigners();
const shares = await deployCharterRegistry(deployer, {
  name: "Example Holdings",
  symbol: "EXH",
  contractURI: "https://example.com/charter.json",
});
```

By default the signer is both admin and initial agent, so it can configure modules and mint. If `admin` is a different
address, pass `initialAgent: false`; that admin must configure agents in a later transaction. The helper deploys only on
networks supported by the pinned `ZamaEthereumConfig`: the local FHEVM mock and Ethereum Sepolia are the currently
exercised targets. The upstream Ethereum-mainnet configuration still contains placeholder addresses and is not a
production target.

## Register a module

Every module exposes an immutable `SHARES` getter that points to its registry:

```solidity
contract BalanceFlagModule is ZamaEthereumConfig {
  CharterShares public immutable SHARES;

  constructor(CharterShares shares) {
    SHARES = shares;
  }

  function computeFlag(address holder) external returns (ebool flag) {
    euint64 balance = SHARES.allowBalanceAccess(holder);
    flag = FHE.gt(balance, 0);
    FHE.allowThis(flag);
    FHE.allow(flag, holder);
  }
}
```

Deploy it against the same registry and enable it as the registry admin:

```ts
const module = await ethers.deployContract("BalanceFlagModule", [await shares.getAddress()]);
await module.waitForDeployment();
await (await shares.setModule(await module.getAddress(), true)).wait();
```

`setModule` rejects EOAs and modules whose `SHARES()` getter names another registry.

## Normative module ACL specification

The words MUST, MUST NOT, SHOULD, and MAY in this section are normative.

### Module identity and authorization

- A module MUST expose `SHARES() external view returns (address)` and it MUST return the registry passed to `setModule`.
- Only the registry admin MAY enable or disable a module. Registration is an explicit trust decision, not a security
  sandbox.
- A module MUST NOT grant itself an agent role, admin role, operator approval, or any authority outside the capability
  the administrator configured separately.
- A module that also needs `AGENT_ROLE` or a holder's operator approval MUST document that separate authority and its
  revocation procedure. Module registration does not imply either authority.

### Balance handles

- A module MUST obtain a current holder balance through `allowBalanceAccess(holder)`. Calling
  `confidentialBalanceOf(holder)` returns a handle but does not grant the module permission to compute on it.
- `allowBalanceAccess` grants the calling module transient permission for the current transaction only. A module MUST
  finish all computations that depend on that input in the same transaction.
- A module MUST NOT persist the raw balance handle, call `FHE.allow` on it, delegate it to another address, or call
  `FHE.makePubliclyDecryptable` on it.
- A module MAY persist a newly derived result only after granting that result to itself with `FHE.allowThis`. It MAY
  grant that derived result to an intended recipient when the module's documented privacy policy requires it.

### Voting and other registry-held handles

- A module MAY request a registry-held handle through inherited `getHandleAllowance(handle, account, persistent)` only
  when the handle was obtained from that registry for the operation being executed.
- A conforming module MUST pass `persistent = false`. It MUST request access only for itself and MUST NOT forward the
  allowance to a third party.
- The registry's `_validateHandleAllowance` authorizes active modules; it does not identify which handle a module should
  use. Correct handle selection is therefore a module obligation.

### Outputs, disclosure, and removal

- A module MUST NOT make a holder balance, vote-weight handle, or other holder-level registry handle publicly
  decryptable.
- A module MAY make a newly derived aggregate or outcome publicly decryptable only when that disclosure is part of its
  documented interface and reveals no forbidden input handle.
- `setModule(module, false)` revokes future calls to `allowBalanceAccess` and `getHandleAllowance`. It does not revoke
  persistent ACL entries, public-decryption flags, agent roles, operator approvals, or handles already stored by a
  module. A decommission MUST revoke each separately applicable authority and recover escrowed funds before treating a
  module as retired.
- A module that escrows confidential tokens SHOULD implement
  `ICharterModuleFundsRecoverable.sweep(IERC7984 token, address to)` so the registry can recover known assets after the
  module is disabled.

## Security boundary

An enabled module can ask the inherited handle manager for persistent access to any handle the registry may use, and a
transiently authorized module can deliberately persist or disclose that handle. Solidity cannot revoke those FHE ACL
effects after the fact. Review module code before registration and run `@charter/conformance`; a passing suite is
behavioral evidence for exercised paths, not proof that arbitrary module code is safe.

See the repository's
[public security self-review](https://github.com/Ridwannurudeen/charter/blob/main/docs/SECURITY-REVIEW.md) for the
complete threat model and accepted risks.
