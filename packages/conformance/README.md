# `@gudman/charter-conformance`

Hardhat/Mocha checks for the encrypted-handle boundary between a Charter registry and one installed module.

## Install

```bash
npm install --save-dev @gudman/charter-conformance @fhevm/hardhat-plugin @nomicfoundation/hardhat-chai-matchers @nomicfoundation/hardhat-ethers @nomicfoundation/hardhat-network-helpers hardhat
```

Import the FHEVM, ethers, and Chai matcher plugins in the consumer's Hardhat config. Run this suite on the Hardhat FHEVM
mock network.

## Use

Call `describeCharterModuleConformance` at test-definition time. The factory must return a fresh registry, registered
module, initialized balances for two different holders, and one successful module action. `accessHandle` is the exact
`euint64` handle consumed by that action. `otherHolderHandle` is the second holder's balance handle.

```ts
import { describeCharterModuleConformance } from "@gudman/charter-conformance";

describeCharterModuleConformance("MyModule", async () => {
  // Deploy a fresh registry and module, mint to holder and otherHolder,
  // register the module, and prepare its normal action.
  return {
    registry,
    admin,
    moduleAddress: await module.getAddress(),
    holderAddress: holder.address,
    accessHandle: await registry.confidentialBalanceOf(holder.address),
    otherHolderHandle: await registry.confidentialBalanceOf(otherHolder.address),
    accessPath: "balance",
    exercise: async () => {
      const receipt = await (await module.run(holder.address)).wait();
      if (receipt === null) throw new Error("Module transaction was not mined");
      return receipt;
    },
  };
});
```

Use `accessPath: "handle"` when the module obtains a non-balance registry handle through
`getHandleAllowance(handle, moduleAddress, false)`, such as a voting checkpoint. Check 4 validates the selected registry
grant endpoint after unregistration.

The factory is called once per check. Do not reuse deployments or one-shot module state between calls. The harness
confirms that `exercise()` emitted an FHE coprocessor operation from the module which referenced `accessHandle`; a setup
callback that does not exercise the declared handle fails the suite.

## Checks

The suite verifies that:

1. Registration alone does not let the module perform an FHE operation on the nominated holder handle.
2. The normal action uses the nominated handle, while its grant is absent after the transaction and does not cover the
   second holder's handle.
3. Registration does not grant agent or administrator roles, and calls from the module cannot self-grant either role.
4. After `setModule(module, false)`, the module's selected registry grant endpoint rejects it and its normal action
   fails.
5. The normal action neither emits a persistent/public ACL grant for either protected handle nor makes either handle
   publicly decryptable.

`npm test` runs the honest probe and then runs an intentionally leaky module in a child Hardhat process. The parent test
passes only when that child exits nonzero with four passing checks and check 5 failing for the public-decryption leak.
`npm run test:broken` is expected to exit nonzero.

## Limits

This is a behavioral boundary check, not a proof, static analyzer, formal verification, or security audit. It observes
only the action and two handles supplied by the factory. Untested functions, branches, recipients, handles, and network
behavior remain outside its result.

Encrypted handle bytes are public on ERC-7984; check 1 proves that the module cannot use the nominated handle in an FHE
operation without ACL access. It does not claim the handle identifier is hidden.

A registered module is trusted while active. Once it receives transient access, FHEVM permits it to persist that access,
grant another account, or make the handle publicly decryptable. This suite detects those actions only when the exercised
path performs them. Removing a module blocks future grants but does not revoke a persistent or public-decryption ACL
flag created earlier. A passing module still requires source review, adversarial tests for every sensitive path, and an
independent audit before production use.

Modules may legitimately disclose derived aggregates or outcomes. Do not nominate those intentional outputs as
`accessHandle` or `otherHolderHandle`; nominate the private source handles whose ACL boundary must remain intact.
