# Charter

Charter is a confidential cap-table registry for private-company equity on Ethereum Sepolia. Shares are ERC-7984
confidential tokens: issuers can mint, disclose aggregate supply, distribute confidential payouts, run hidden-weight
votes, and grant auditor view access without publishing individual positions. The operating line is simple: verifiable
totals, hidden individuals.

## Why Charter exists

Public-chain cap tables leak the exact holdings, transfers, voting weight, and payout history of every investor.
Traditional private-company cap tables solve privacy by becoming opaque silos, where enforcement, payouts, and audits
depend on off-chain coordination. Private equity needs the opposite pairing: enforceable infrastructure with selective
disclosure. Charter makes the registry public and programmable while keeping individual balances encrypted. The public
can verify totals and outcomes; holders, appointed observers, and relayed proofs reveal only the data each flow
requires.

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
          |
          | module ACL
          v
+--------------------+                           +-----------------------+
| CharterResolutions |                           | MockConfidentialUSD   |
| encrypted votes    | <-----------------------> | testnet ERC-7984 cash |
| proven tallies     |        payouts            | token                 |
+--------------------+                           +-----------------------+
```

The frontend never imports the relayer SDK directly outside `web/lib/fhevm.ts`. User decryptions use an EIP-712 session
cached in `sessionStorage`; public disclosures use relayer/KMS output that the contracts verify with
`FHE.checkSignatures`.

## The four flows, precisely

| Flow              | Contract path                                                                                      | What stays private                  | What becomes public                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| Issuance          | `CharterShares.confidentialMint(address,bytes32,bytes)`                                            | Each minted allocation              | Holder address and encrypted handle                             |
| Supply disclosure | `requestSupplyDisclosure()` -> relayer `publicDecrypt` -> `finalizeSupplyDisclosure(uint64,bytes)` | Individual balances                 | Total issued shares and proof-backed record block               |
| Distributions     | `DividendDistributor.declare()` -> pause-as-record-date -> `payBatch()`                            | Each investor balance and payout    | Pool amount, distribution id, paid flag                         |
| Resolutions       | self-delegate -> `propose()` -> encrypted `castVote()` -> `requestTally()` -> `settle()`           | Vote direction and weight per voter | Final for/against totals and pass/fail                          |
| Observer access   | `setObserver(account, observer)` -> `/auditor` decrypts `confidentialBalanceOf(account)`           | Everyone else still sees ciphertext | Holder-chosen observer can decrypt that holder's share position |

Distribution math is computed over ciphertext: `encBalance * pool / totalSharesOnRecord`. The divisor is scalar and
public; individual balances and payout handles remain encrypted. Resolution voting uses an encrypted `ebool` multiplied
through the checkpointed `getPastVotes` weight, then settles only after public decryption of aggregate handles in
`[forVotes, againstVotes]` order.

## Design decisions and constraints

- HCU budget drives batching. `payBatch` is designed for roughly 15 investors per transaction instead of one unbounded
  settlement.
- `pool * totalShares <= 2^64` is enforced before distribution declaration so encrypted `euint64` payout math cannot
  overflow.
- Shares are whole units with `decimals() == 0`, matching private-company share ledgers.
- Total shares are deliberately public after disclosure. Real cap tables can expose the count while keeping holder-level
  ownership and payouts private.
- Pause-as-record-date is a practical demo tradeoff: payouts require `CharterShares.paused()` so balances cannot move
  between batches. A checkpoint-based record-date module is the natural post-hackathon upgrade.
- `CharterShares.isModule` is a trusted-module registry. Registered modules receive transient ACL grants for handles
  they need to compute distributions or votes, and no more.

## Security posture

Charter builds on `@openzeppelin/confidential-contracts` v0.5.1. The installed package README identifies npm installs as
audited releases, and the Charter dependency is pinned through `package-lock.json`. Inherited surfaces include
`ERC7984Rwa` for admin/agent controls, restrictions, freezes, force transfers, and pause; `ERC7984Votes` for
checkpointed encrypted voting power; and `ERC7984ObserverAccess` for holder-appointed observers.

The custom code adds the share-supply disclosure flow, the trusted module registry, the pro-rata distributor, the
resolution module, and the testnet mcUSD token. Contracts are intentionally small and covered by the 20-test suite in
`test/Charter.ts`.

## Getting started

```bash
git clone https://github.com/gudmanii/charter
cd charter
npm i
npx hardhat test
cd web && npm i && npm run dev
```

The local test suite runs against the FHEVM mock and currently covers issuance, disclosure, distributions, resolutions,
observer access, and compliance controls.

### Scenario tasks

| Task                                                                                                 | Purpose                                        |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `npx hardhat scenario:issue --network sepolia --to 0x... --amount 500000`                            | Mint encrypted shares to an investor           |
| `npx hardhat scenario:disclose --network sepolia`                                                    | Publicly disclose total supply with proof      |
| `npx hardhat scenario:fund --network sepolia --amount 10000`                                         | Mint mcUSD to deployer and approve distributor |
| `npx hardhat scenario:declare --network sepolia --pool 10000`                                        | Declare a public distribution pool             |
| `npx hardhat scenario:pay --network sepolia --id 0 --investors 0x...,0x...`                          | Pause, pay a batch, and unpause                |
| `npx hardhat scenario:delegate --network sepolia --signer 1`                                         | Self-delegate voting power for a signer        |
| `npx hardhat scenario:propose --network sepolia --text "Approve the Series A financing" --blocks 40` | Create a resolution                            |
| `npx hardhat scenario:vote --network sepolia --id 0 --support true --signer 1`                       | Cast an encrypted vote                         |
| `npx hardhat scenario:settle --network sepolia --id 0`                                               | Publicly decrypt tallies and settle            |
| `npx hardhat scenario:status --network sepolia`                                                      | Print read-only lifecycle state                |

## Deployed contracts (Sepolia)

| Contract              | Address                                      | Etherscan                                                                                  | Sourcify                                                                                                                |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `CharterShares`       | `0x6E823303Ff9416Fa500915A5D56b32e2c3158e45` | [address](https://sepolia.etherscan.io/address/0x6E823303Ff9416Fa500915A5D56b32e2c3158e45) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x6E823303Ff9416Fa500915A5D56b32e2c3158e45/) |
| `MockConfidentialUSD` | `0xee3B37E13e4833969050Ae6D34311E4E3eD0396a` | [address](https://sepolia.etherscan.io/address/0xee3B37E13e4833969050Ae6D34311E4E3eD0396a) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0xee3B37E13e4833969050Ae6D34311E4E3eD0396a/) |
| `DividendDistributor` | `0x33274e28cA4f04D5177c388517904f73F94CAd99` | [address](https://sepolia.etherscan.io/address/0x33274e28cA4f04D5177c388517904f73F94CAd99) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x33274e28cA4f04D5177c388517904f73F94CAd99/) |
| `CharterResolutions`  | `0x083E64CC897dD33a7616E30400c1620b9E5DAcD1` | [address](https://sepolia.etherscan.io/address/0x083E64CC897dD33a7616E30400c1620b9E5DAcD1) | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x083E64CC897dD33a7616E30400c1620b9E5DAcD1/) |

## Ecosystem positioning

Charter is ERC-7984-native, so the share registry sits on the same confidential-token rails as Zama's token examples and
OpenZeppelin's confidential contracts. It is TokenOps-adjacent rather than a distribution-tool competitor: Charter is
the privacy-preserving registry layer below payout, governance, and audit workflows. Public totals and proof-backed
outcomes make it usable for compliance review without turning every holder into public market data.

## Program

Built for the [Zama Developer Program Season 3](https://www.zama.org/programs/developer-program), Builder Track.
