# Charter

Charter is a **confidential equity-registry primitive** on Ethereum Sepolia — not a Carta replacement, and not another
confidential-token cap-table dashboard (that lane belongs to [TokenOps](https://tokenops.xyz), which Zama acquired).
Charter is the on-chain layer _beneath_ that kind of product: encrypted ERC-7984 shareholdings, proof-backed aggregate
disclosure, confidential dividends, hidden-weight governance, a confidential secondary-market buyback, cliff-vesting
grants, a compliant (accreditation-gated) issuance path, and an M-of-N timelocked enforcement gate — all swappable
through one module registry without ever redeploying the ledger. See "Known limitations, addressed" below for exactly
what this does and does not solve.

App URL: `https://charter.gudman.xyz`.

## Screenshots

![Charter landing](docs/img/charter-landing.png)

![Investor portal entry](docs/img/charter-investor.png)

![Governance entry](docs/img/charter-governance.png)

## Why Charter exists

Public-chain cap tables leak the holdings, transfers, voting weight, and payout history of every investor. Traditional
private-company cap tables preserve privacy by becoming opaque off-chain silos, where enforcement, payouts, and audits
depend on coordination outside the chain. Private equity needs enforceable infrastructure with selective disclosure:
public totals and proof-backed outcomes, private investor-level economics. Charter makes the registry programmable while
keeping quantities encrypted.

## Known limitations, addressed

A self-review of this project asked six hard questions. Each is answered by a specific, tested, deployed module — not by
softer language. Full tx evidence is in `docs/E2E-RUN.md`.

1. **"A cap table's hard part is legal state (vesting, conversion), and Charter modeled none of it."** `VestingSchedule`
   now implements cliff-and-linear vesting with the standard proportional cliff catch-up, funded by escrow and claimed
   by the beneficiary over time — the single most important lifecycle mechanic a real cap table runs on. Conversion
   (SAFE-to-priced-round), 409A pricing, and legal-entity binding remain out of scope; see item 2.
2. **"Tokens minted here have no legal standing as equity, and the open demo faucet models an unregistered offering."**
   That is still true and cannot be fixed by a smart contract. What _can_ be built is the on-chain gate a real issuance
   would require: `AccreditationRegistry` + `GatedIssuance` mint only to wallets an admin has explicitly allowlisted
   (default-deny), replacing "mint to anyone, block bad actors after" with "mint only to pre-cleared wallets." The open
   `DemoShareFaucet` is left untouched for judges — `GatedIssuance` is the parallel, production-shaped path.
3. **"Force-transfer is one key silently seizing shares, dressed up as `compliance`."** `ForceTransferGuardian` replaces
   the raw agent key for enforcement actions: a forced transfer must be proposed with a public reason, confirmed by a
   2-of-3 guardian quorum, and wait out a 30-block timelock before anyone can execute it — an auditable due-process
   trail instead of a silent seizure. This models genuine checks-and-balances; it is not a claim that a court order was
   verified on-chain, which no contract can do. (The demo's three guardians share one mnemonic for convenience; a real
   deployment assigns each to an independently-held key.)
4. **"Charter hides amounts but keeps identity and timing public — maybe the wrong half of the privacy problem."** This
   is a correct critique of ERC-7984 generally, not something a redesign fixes: identity-privacy needs a fundamentally
   different primitive (stealth addresses, shielded pools), out of scope here. Charter is precisely an
   **amount-privacy** primitive — the README no longer implies more than that (see "Design Decisions and Constraints").
5. **"The ~15-investor batch-size claim was a guess, not a benchmark."** It has now been measured. `payBatch` was probed
   with `staticCall` at increasing sizes: **12 investors succeeds, 13 reverts** — a real, lower, and now-known ceiling,
   not a guess. See the benchmark table in `docs/E2E-RUN.md` for gas numbers and the underlying tx.
6. **"Against TokenOps, Charter reads as pre-revenue theater claiming to be a cap-table product."** Fixed by scope, not
   spin: the framing above no longer says "cap table." Charter is the confidential equity-registry primitive a real
   cap-table product would be built on top of, with a demonstrated (not claimed) composable-module pattern — see
   "Composes With."

## Architecture

```text
Issuer / Investor / Auditor / Governance UI
        |
        | user decryption: EIP-712 session -> relayer/KMS -> cleartext in browser
        | public disclosure: publicDecrypt -> KMS proof -> FHE.checkSignatures on-chain
        v
+--------------------+        module ACL        +-----------------------+
| CharterShares      | <----------------------> | DividendDistributor   |
| ERC7984Rwa         |                           | encrypted pro-rata    |
| ERC7984Votes       |                           | mcUSD payouts         |
| ObserverAccess     |                           +-----------------------+
+---------+----------+
          | module ACL / agent grant
          v
+--------------------+                           +-----------------------+
| CharterResolutions |                           | MockConfidentialUSD   |
| encrypted votes    | <-----------------------> | testnet ERC-7984 cash |
| outcome proof      |        payouts            | token                 |
+--------------------+                           +-----------------------+
          ^
          |
+--------------------+
| DemoShareFaucet    |
| one-time grants    |
+--------------------+
```

Four more modules register against `CharterShares` the same way (module ACL / agent grant, diagram omitted for space):
`ConfidentialTenderOffer` (buyback), `VestingSchedule` (cliff vesting), `GatedIssuance` + `AccreditationRegistry`
(compliant issuance), and `ForceTransferGuardian` (M-of-N enforcement) — see "Composes With" and the addresses table.

The frontend loads the relayer SDK only through `web/lib/fhevm.ts`. User decryptions use an EIP-712 session cached in
`sessionStorage` for one day. Public disclosures use relayer/KMS output that the contracts verify with
`FHE.checkSignatures`.

## Flows

| Flow              | Contract path                                                                                          | What stays private                  | What becomes public                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------ |
| Issuance          | `CharterShares.confidentialMint(address,bytes32,bytes)`                                                | Each minted allocation              | Holder address and encrypted handle                                      |
| Supply disclosure | `requestSupplyDisclosure()` -> relayer `publicDecrypt` -> `finalizeSupplyDisclosure(uint64,bytes)`     | Individual balances                 | Total issued shares, record block, and KMS proof verification            |
| Distributions     | `pause()` -> `DividendDistributor.declare()` -> `payBatch()`                                           | Each investor balance and payout    | Pool amount, distribution id, batch investor addresses, and paid flag    |
| Resolutions       | self-delegate -> `propose()` -> encrypted `castVote()` -> `requestTally()` -> `settle(bool,bytes)`     | Vote direction and weight per voter | Pass/fail outcome and which addresses voted                              |
| Observer access   | `setObserver(account, observer)` -> `/auditor` decrypts `confidentialBalanceOf(account)`               | Everyone else still sees ciphertext | Holder-chosen observer can decrypt that holder's share balance           |
| Buyback (tender)  | `openOffer(price, cap)` -> encrypted `tender(qty)` -> `requestTotal()` -> `settleTotal()` -> `claim()` | Each holder's tendered quantity     | Price, cap, aggregate tendered, and whether oversubscribed               |
| Vesting           | `createGrant(cliff, duration)` -> `claim()` / `revoke()`                                               | Grant size, released amount         | Cliff/vesting-end blocks, that a grant exists between issuer/beneficiary |
| Gated issuance    | `AccreditationRegistry.setAccredited()` -> `GatedIssuance.issue()`                                     | Minted allocation                   | Which wallets are accredited; issuance transaction                       |
| Enforcement       | `ForceTransferGuardian.propose(reason)` -> `confirm()` x N -> `execute()` after timelock               | Transfer amount                     | Proposer, reason, confirmations, and the timelock deadline               |
| Self-serve demo   | `DemoShareFaucet.claim()` and `MockConfidentialUSD.faucet()`                                           | Claimed balances                    | Claim transaction and recipient address                                  |

Distribution math is computed over ciphertext: `encBalance * pool / totalSharesOnRecord`. The divisor is scalar and
public; individual balances and payout handles remain encrypted. Resolution voting uses an encrypted `ebool` and
checkpointed `getPastVotes` weight, then discloses only the encrypted comparison result: pass or fail.

## Design Decisions And Constraints

- Only the pass/fail outcome of a resolution is disclosed. Individual vote weights and directions never leave
  ciphertext. Voter participation is public.
- The active governance module (`CharterResolutionsV3`) lets any self-delegated shareholder open a resolution (not just
  the issuer) and enforces a minimum-participation quorum (measured on the public voter count, so it leaks nothing new).
  Below quorum a resolution fails without any tally being disclosed.
- Cap-table membership and participation are public; only quantities are encrypted.
- Dividend record date is the pause that must be in place at `declare`. The contract enforces pause-before-declare.
- Re-run supply disclosure after any issuance before declaring a distribution. `supplyDisclosureStale()` enforces this.
- User-decryption plaintext is reconstructed in the browser. The relayer sees only ciphertext, but the Zama threshold
  KMS committee performs the underlying decryption as part of the protocol. The issuer/agent inherently can decrypt
  allocations it mints.
- Observer removal is prospective only. Values already shared remain decryptable by the former observer.
- `mcUSD` is an open-mint testnet mock with no value.
- `payBatch`'s real per-transaction ceiling is **measured, not guessed**: 12 investors succeeds, 13 reverts (probed with
  `staticCall` on Sepolia; see the benchmark table in `docs/E2E-RUN.md` for gas numbers and tx hashes).
- `pool * totalShares <= 2^64` is enforced before distribution declaration so encrypted `euint64` payout math cannot
  overflow. With a fresh, non-stale supply disclosure, no holder balance can exceed the denominator.
- Shares are whole units with `decimals() == 0`, matching private-company share ledgers.
- Total shares are deliberately public after disclosure. Real cap tables can expose the count while keeping holder-level
  ownership and payouts private.
- `sweep` is issuer-trusted and can return remaining confidential payment-token balance to a chosen address.
- `CharterShares.isModule` is a trusted-module registry: a registered module can request ACL access to handles the token
  contract holds; the shipped modules request only transient, per-transaction access to the balances and checkpoints
  they compute on. Module registration is admin-only and is the trust boundary.
- **Charter hides quantities, not identities.** Holder addresses, transfer events, grant participants, and enforcement
  proposals are all public — only amounts are encrypted. This is the actual guarantee ERC-7984 confidential tokens
  provide; treat any "private cap table" claim as amount-privacy, not holder anonymity.
- `AccreditationRegistry`/`GatedIssuance` are the on-chain gate a regulated issuer would need (default-deny, admin
  allowlist) — they do not perform real identity verification themselves, which happens off-chain before an admin
  accredits a wallet, exactly as it does for every real securities offering.
- `ForceTransferGuardian` requires a 2-of-3 confirmed, timelocked, publicly-reasoned proposal before a forced transfer
  executes — a genuine due-process improvement over a single agent key, but it is not a claim that a real court order is
  verified on-chain. The demo's three guardian keys are derived from one mnemonic for convenience; a production
  deployment would assign each guardian to an independently-held key.
- `VestingSchedule` escrows the grant total from the issuer's own balance at creation (via `confidentialTransferFrom`,
  requiring a prior `setOperator` approval); it does not itself model SAFE conversion, 409A pricing, or acceleration.

## Security Posture

Charter builds on `@openzeppelin/confidential-contracts` v0.5.1 and `@fhevm/solidity` v0.11.1. Inherited surfaces
include `ERC7984Rwa` for admin/agent controls, restrictions, freezes, force transfers, and pause; `ERC7984Votes` for
checkpointed encrypted voting power; and `ERC7984ObserverAccess` for holder-appointed observers.

The custom code adds the supply disclosure flow, trusted module registry, pro-rata distributor, outcome-only resolution
modules (v1-v3), a confidential buyback, cliff-vesting, a compliant issuance gate, an M-of-N enforcement guardian, a
one-time demo share faucet, and testnet mcUSD token. The local FHEVM mock test suite currently covers all of the above:
**41 tests** across issuance, disclosure, distributions, stale-supply rejection, outcome-only resolutions and quorum,
shareholder-initiated proposals, observer access, compliance controls, demo faucet claims, the confidential buyback
(both full-fill and pro-rata-oversubscribed paths), vesting (cliff catch-up, linear release, revocation), gated
issuance, and the guardian's quorum/timelock/execution flow.

## Getting Started

```bash
git clone https://github.com/Ridwannurudeen/charter
cd charter
npm i
npx hardhat test
cd web && npm i && npm run dev
```

### Scenario Tasks

| Task                                                                                                 | Purpose                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `npx hardhat scenario:issue --network sepolia --to 0x... --amount 500000`                            | Mint encrypted shares to an investor              |
| `npx hardhat scenario:claim-shares --network sepolia --signer 3`                                     | Claim one-time demo shares for a signer           |
| `npx hardhat scenario:disclose --network sepolia`                                                    | Publicly disclose total supply with proof         |
| `npx hardhat scenario:fund --network sepolia --amount 10000`                                         | Mint mcUSD to deployer and approve distributor    |
| `npx hardhat scenario:declare --network sepolia --pool 10000`                                        | Pause if needed, then declare a distribution pool |
| `npx hardhat scenario:pay --network sepolia --id 0 --investors 0x...,0x...`                          | Pay a paused distribution batch, then unpause     |
| `npx hardhat scenario:delegate --network sepolia --signer 1`                                         | Self-delegate voting power for a signer           |
| `npx hardhat scenario:propose --network sepolia --text "Approve the Series A financing" --blocks 40` | Create a resolution                               |
| `npx hardhat scenario:vote --network sepolia --id 0 --support true --signer 1`                       | Cast an encrypted vote                            |
| `npx hardhat scenario:request-tally --network sepolia --id 0`                                        | Request a pass/fail outcome without settling      |
| `npx hardhat scenario:settle --network sepolia --id 0`                                               | Publicly decrypt the pass/fail outcome and settle |
| `npx hardhat scenario:status --network sepolia`                                                      | Print read-only lifecycle state                   |

## Deployed Contracts

Round-two contracts were redeployed on Sepolia on 2026-07-03 and source-verified on both Etherscan and Sourcify (partial
match).

| Contract                                     | Address                                      | Etherscan                                                                                        | Sourcify                                                                                                                |
| -------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `CharterShares`                              | `0xc5Af9E2b3A110D20D914c5771beb5DFBA5F6d61A` | [verified](https://sepolia.etherscan.io/address/0xc5Af9E2b3A110D20D914c5771beb5DFBA5F6d61A#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0xc5Af9E2b3A110D20D914c5771beb5DFBA5F6d61A/) |
| `MockConfidentialUSD`                        | `0xb6B08dC3014D944231E01Ad5a0292Efeea859112` | [verified](https://sepolia.etherscan.io/address/0xb6B08dC3014D944231E01Ad5a0292Efeea859112#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0xb6B08dC3014D944231E01Ad5a0292Efeea859112/) |
| `DividendDistributor`                        | `0x42C8c19fbC1E2F5649d540237759E7bFee5617b9` | [verified](https://sepolia.etherscan.io/address/0x42C8c19fbC1E2F5649d540237759E7bFee5617b9#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x42C8c19fbC1E2F5649d540237759E7bFee5617b9/) |
| `CharterResolutions` (v1, history)           | `0x7FE785A2ec9cFb10283fAB7aE6d2c2d3Ad5662B3` | [verified](https://sepolia.etherscan.io/address/0x7FE785A2ec9cFb10283fAB7aE6d2c2d3Ad5662B3#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x7FE785A2ec9cFb10283fAB7aE6d2c2d3Ad5662B3/) |
| `CharterResolutionsV2` (v2, history)         | `0x88f7337CCdD92Cd4B27509edBA3b3bb66a34e4e2` | [verified](https://sepolia.etherscan.io/address/0x88f7337CCdD92Cd4B27509edBA3b3bb66a34e4e2#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x88f7337CCdD92Cd4B27509edBA3b3bb66a34e4e2/) |
| `CharterResolutionsV3` (active governance)   | `0x4561F5E4515C674382141452C043E53F1f8fA5FF` | [verified](https://sepolia.etherscan.io/address/0x4561F5E4515C674382141452C043E53F1f8fA5FF#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x4561F5E4515C674382141452C043E53F1f8fA5FF/) |
| `ConfidentialTenderOffer` (buyback)          | `0xd61aCcaC2F89F78016F22861156c4F9121edE575` | [verified](https://sepolia.etherscan.io/address/0xd61aCcaC2F89F78016F22861156c4F9121edE575#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0xd61aCcaC2F89F78016F22861156c4F9121edE575/) |
| `VestingSchedule` (cliff + linear vesting)   | `0xa66E2749A411a9cC3e7eedA33f5097d0D1dB06A1` | [verified](https://sepolia.etherscan.io/address/0xa66E2749A411a9cC3e7eedA33f5097d0D1dB06A1#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0xa66E2749A411a9cC3e7eedA33f5097d0D1dB06A1/) |
| `AccreditationRegistry` (allowlist)          | `0x737461559C405b173288d8E8a42F6CD1711A356E` | [verified](https://sepolia.etherscan.io/address/0x737461559C405b173288d8E8a42F6CD1711A356E#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x737461559C405b173288d8E8a42F6CD1711A356E/) |
| `GatedIssuance` (compliant issuance path)    | `0xB426cF0e43037e1eA02D6eb2F8886394E708F1CA` | [verified](https://sepolia.etherscan.io/address/0xB426cF0e43037e1eA02D6eb2F8886394E708F1CA#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0xB426cF0e43037e1eA02D6eb2F8886394E708F1CA/) |
| `ForceTransferGuardian` (M-of-N enforcement) | `0x881dFcb218bF739BeEBCd82e5cd7F91193aF0AE7` | [verified](https://sepolia.etherscan.io/address/0x881dFcb218bF739BeEBCd82e5cd7F91193aF0AE7#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x881dFcb218bF739BeEBCd82e5cd7F91193aF0AE7/) |
| `DemoShareFaucet`                            | `0x9AF5A8e7d036E4347D0458748D9bC27131D0710C` | [verified](https://sepolia.etherscan.io/address/0x9AF5A8e7d036E4347D0458748D9bC27131D0710C#code) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x9AF5A8e7d036E4347D0458748D9bC27131D0710C/) |

## Composes With

Charter is a reusable ERC-7984 equity-registry primitive. The share token is a standard confidential token that can sit
beside the Confidential Wrapper Registry and other ERC-7984 token rails. The module registry lets new distribution,
governance, compliance, or reporting modules plug into the share token without changing the registry itself, with module
registration acting as the explicit trust boundary.

**This composability is demonstrated live, not just claimed — twice.** The governance module was upgraded on-chain in
two steps, each by deploying a new module against the **same share token** and registering it through
`CharterShares.setModule` (no share-token redeploy, no migration of holdings):

- **v1 -> v2** added a minimum-participation quorum, so a resolution can no longer pass on a single vote.
- **v2 -> v3** opened proposal rights to any self-delegated shareholder (not just the issuer), so a holder can drive the
  entire governance loop themselves: activate voting, propose, vote, and settle.

All three modules remain verified on-chain (see the addresses table); the frontend points at v3. Quorum is enforced on
the public voter count, so nothing that was previously private is leaked. This v1 -> v2 -> v3 lineage is the module
registry working exactly as intended: behaviour beneath the equity ledger is swappable without disturbing the ledger.

The same registry extends to secondary-market mechanics: `ConfidentialTenderOffer` is a registered module that runs a
confidential share buyback. Holders tender an encrypted quantity, only the aggregate is disclosed (with a KMS proof),
and oversubscribed offers clear pro-rata on ciphertext — how much any single holder sells is never revealed. This is the
kind of confidential secondary-market primitive that a public-chain equity registry uniquely enables.

Three more modules extend the same pattern without touching the ledger: `VestingSchedule` (cliff-and-linear grants),
`GatedIssuance` + `AccreditationRegistry` (a compliant, allowlist-gated minting path alongside the open demo faucet),
and `ForceTransferGuardian` (M-of-N timelocked enforcement in place of a raw agent key). Seven modules now sit on one
unmoved share token — the registry is not a one-off trick, it is how this project is actually built.

Charter is not a token cap-table dashboard. It is the privacy-preserving equity registry layer beneath dividends,
shareholder governance, buybacks, and auditor access.

## Program

Built for the [Zama Developer Program Season 3](https://www.zama.org/programs/developer-program), Builder Track.
