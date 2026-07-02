# Charter Sepolia E2E run

Date: 2026-07-02 Network: Sepolia, chain id 11155111 Deployer: `0x04045Ca68BEF611adBD76e58C028cEFf4a3d640D` Investor 1:
`0x510456aB08994AaC33fc8487b00774F531cD1e6C` Investor 2: `0x697B2D132a86d3f07ACe4a296f8d5c3bd150B7Dc`

No mnemonic or private key was printed or written during this run.

## Gas preflight

| Check                     | Result                                     |
| ------------------------- | ------------------------------------------ |
| Initial `eth_gasPrice`    | 40.616 gwei, held deployment               |
| 10-minute recheck         | 51.649 gwei, held deployment               |
| Second 10-minute recheck  | 13.511 gwei, deployment allowed            |
| Final pre-deploy check    | 12.778 gwei, deployer balance 0.500000 ETH |
| Post-deploy balance check | 0.397947 ETH                               |

## Deployment

| Step                         | Address                                      | Tx                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CharterShares` deploy       | `0x6E823303Ff9416Fa500915A5D56b32e2c3158e45` | [0x3db35cb106da48d30c71aeccc8eedb07869bb166ca7e05fd344f7679ff3315bc](https://sepolia.etherscan.io/tx/0x3db35cb106da48d30c71aeccc8eedb07869bb166ca7e05fd344f7679ff3315bc) |
| `MockConfidentialUSD` deploy | `0xee3B37E13e4833969050Ae6D34311E4E3eD0396a` | [0x7a6994b361ee6593101a62d4c9f1309533d10449ba7ff70a72871d0cdc6f385b](https://sepolia.etherscan.io/tx/0x7a6994b361ee6593101a62d4c9f1309533d10449ba7ff70a72871d0cdc6f385b) |
| `DividendDistributor` deploy | `0x33274e28cA4f04D5177c388517904f73F94CAd99` | [0x64b6eee20684c4b1777b97a64f1b727ef48b4c86ee1bfb9af2e47f9a0a8c9aa6](https://sepolia.etherscan.io/tx/0x64b6eee20684c4b1777b97a64f1b727ef48b4c86ee1bfb9af2e47f9a0a8c9aa6) |
| `CharterResolutions` deploy  | `0x083E64CC897dD33a7616E30400c1620b9E5DAcD1` | [0xbb9d95e9335759562987d5b4c8fe8b3726fca5090030fb5232cc3f857a734350](https://sepolia.etherscan.io/tx/0xbb9d95e9335759562987d5b4c8fe8b3726fca5090030fb5232cc3f857a734350) |
| Register distributor module  | `0x33274e28cA4f04D5177c388517904f73F94CAd99` | [0x66f28c19644b6c50868aa8818e3fff9928bcee2d26d19332d91aa8cd33496203](https://sepolia.etherscan.io/tx/0x66f28c19644b6c50868aa8818e3fff9928bcee2d26d19332d91aa8cd33496203) |
| Register resolutions module  | `0x083E64CC897dD33a7616E30400c1620b9E5DAcD1` | [0x685953d9d021068db0e0dd0cc2d2196ae5070cec1c5daaa2486cccbba71a2ebc](https://sepolia.etherscan.io/tx/0x685953d9d021068db0e0dd0cc2d2196ae5070cec1c5daaa2486cccbba71a2ebc) |
| Add deployer agent role      | `0x04045Ca68BEF611adBD76e58C028cEFf4a3d640D` | [0x40a39ce64fe8c3e10ddebca7e75adc939b8222fc59f2ab33eebb5f0d44aa72f1](https://sepolia.etherscan.io/tx/0x40a39ce64fe8c3e10ddebca7e75adc939b8222fc59f2ab33eebb5f0d44aa72f1) |

## Verification

| Contract              | Sourcify                                                                                                                | Etherscan                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `CharterShares`       | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x6E823303Ff9416Fa500915A5D56b32e2c3158e45/) | Skipped: `ETHERSCAN_API_KEY` is not set |
| `MockConfidentialUSD` | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0xee3B37E13e4833969050Ae6D34311E4E3eD0396a/) | Skipped: `ETHERSCAN_API_KEY` is not set |
| `DividendDistributor` | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x33274e28cA4f04D5177c388517904f73F94CAd99/) | Skipped: `ETHERSCAN_API_KEY` is not set |
| `CharterResolutions`  | [partial match](https://repo.sourcify.dev/contracts/partial_match/11155111/0x083E64CC897dD33a7616E30400c1620b9E5DAcD1/) | Skipped: `ETHERSCAN_API_KEY` is not set |

## Frontend wiring

- `npm run export:addresses` wrote `web/.env.local`.
- `cd web && npm run build` passed after one transient Next build-worker exit; `npx tsc --noEmit` and `npx eslint .`
  were clean with the same env, and the rerun built all five routes.
- Exported routes confirmed: `/`, `/issuer`, `/investor`, `/governance`, `/auditor`.

## Demo investor funding

Both demo investor wallets started at `0 ETH`. Each received one 0.03 ETH transfer.

| Recipient  | Tx                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Investor 1 | [0x7660042d083a1b9faa56d59d025bdcd27d99e2f63f6c5e80b3e6f8bdc992723c](https://sepolia.etherscan.io/tx/0x7660042d083a1b9faa56d59d025bdcd27d99e2f63f6c5e80b3e6f8bdc992723c) |
| Investor 2 | [0x523ce0f3def4c77cd3859ed659cb9f21b634391500681165ee9dc9a89e4e7fa0](https://sepolia.etherscan.io/tx/0x523ce0f3def4c77cd3859ed659cb9f21b634391500681165ee9dc9a89e4e7fa0) |

## Lifecycle e2e

Initial `scenario:status`: `totalSharesOnRecord=0`, `paused=false`, `distributionCount=0`, `resolutionCount=0`.

| Step                            | Expected / observed value                                    | Tx                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Issue investor 1                | 500000 encrypted shares                                      | [0x005b7b52d32bf167269faab2099e7118ce53c28a260429fbc3a65bd7fb44a0b1](https://sepolia.etherscan.io/tx/0x005b7b52d32bf167269faab2099e7118ce53c28a260429fbc3a65bd7fb44a0b1) |
| Issue investor 2                | 300000 encrypted shares                                      | [0x543feb0d9bfa4b61fcea0c86392cf9a132f19993a583cc6ed3741c4b79dcb99e](https://sepolia.etherscan.io/tx/0x543feb0d9bfa4b61fcea0c86392cf9a132f19993a583cc6ed3741c4b79dcb99e) |
| Request supply disclosure       | Total supply handle requested                                | [0xfbc9214022839aa52ccb792fac542fbde8073347aa2e3a4980aa11ba50bb01d1](https://sepolia.etherscan.io/tx/0xfbc9214022839aa52ccb792fac542fbde8073347aa2e3a4980aa11ba50bb01d1) |
| Finalize supply disclosure      | Observed `800000` shares                                     | [0x8e7eda2a113e9505bfdb55d483db1cfd44fc051436f89fdc94563f3a7225471d](https://sepolia.etherscan.io/tx/0x8e7eda2a113e9505bfdb55d483db1cfd44fc051436f89fdc94563f3a7225471d) |
| Delegate investor 1             | Self-delegated                                               | [0xfd1c42799faf25689bad78a01cb4783606f8f58cf3a35db772ec6de3afe95fdc](https://sepolia.etherscan.io/tx/0xfd1c42799faf25689bad78a01cb4783606f8f58cf3a35db772ec6de3afe95fdc) |
| Delegate investor 2             | Self-delegated                                               | [0x4e7ffe84c75650ee4470623067866767acdb947ae9676a6b381634b5a0329076](https://sepolia.etherscan.io/tx/0x4e7ffe84c75650ee4470623067866767acdb947ae9676a6b381634b5a0329076) |
| Mint mcUSD                      | 10000 mcUSD to deployer                                      | [0x17d8ff2fd1bb0f82b3fab78f9cbdbf7dd392709949b18b687576a4a54020817e](https://sepolia.etherscan.io/tx/0x17d8ff2fd1bb0f82b3fab78f9cbdbf7dd392709949b18b687576a4a54020817e) |
| Approve distributor as operator | Operator until 1783102874                                    | [0x158c9a0c6aeb79d53a04c292e8d2b2a1133007892c9b190847e934713198d4bb](https://sepolia.etherscan.io/tx/0x158c9a0c6aeb79d53a04c292e8d2b2a1133007892c9b190847e934713198d4bb) |
| Declare distribution            | Distribution id `0`, pool 10000 mcUSD                        | [0x1a4f18d7e5e44e61791ecae1ed827c561ba4c5ac645e5716538d400061593c7a](https://sepolia.etherscan.io/tx/0x1a4f18d7e5e44e61791ecae1ed827c561ba4c5ac645e5716538d400061593c7a) |
| Pause shares                    | Record date set                                              | [0x7c1034f74f112f79c504f785382de5af7d5cc92cb5646dbca1e3fd8ddb4674c3](https://sepolia.etherscan.io/tx/0x7c1034f74f112f79c504f785382de5af7d5cc92cb5646dbca1e3fd8ddb4674c3) |
| Pay batch                       | Investors 1 and 2 paid                                       | [0xadb7d4d3f0bb4595010ef95619055fae8876c767567614ff505da0446e15ce7b](https://sepolia.etherscan.io/tx/0xadb7d4d3f0bb4595010ef95619055fae8876c767567614ff505da0446e15ce7b) |
| Unpause shares                  | Transfers live again                                         | [0xb771d38eaf650d44717c198c11ff34cf3aace5b893547b6b2ced58a744ed5b83](https://sepolia.etherscan.io/tx/0xb771d38eaf650d44717c198c11ff34cf3aace5b893547b6b2ced58a744ed5b83) |
| Propose resolution              | Resolution id `0`, 40-block window                           | [0x89bbdb5e491306ef42308e19d37d4912694fc09d42fc42571f602b47c1b8e400](https://sepolia.etherscan.io/tx/0x89bbdb5e491306ef42308e19d37d4912694fc09d42fc42571f602b47c1b8e400) |
| Vote investor 1                 | FOR                                                          | [0xb044f9a946cb3ca32575405c2e0a7e543ce08ce4610b000a0a237a08be0e059d](https://sepolia.etherscan.io/tx/0xb044f9a946cb3ca32575405c2e0a7e543ce08ce4610b000a0a237a08be0e059d) |
| Vote investor 2                 | AGAINST                                                      | [0xaab72441218fbd051b3377d4ddf95ddee51a70df35b101cc931050bd83c132a3](https://sepolia.etherscan.io/tx/0xaab72441218fbd051b3377d4ddf95ddee51a70df35b101cc931050bd83c132a3) |
| Request tally                   | Voting deadline `11188845`, requested after block `11188847` | [0x16a02db024b570392616e99fd1f8ed2fc17ebaba8e4021b93d1e0804ddd64cd0](https://sepolia.etherscan.io/tx/0x16a02db024b570392616e99fd1f8ed2fc17ebaba8e4021b93d1e0804ddd64cd0) |
| Settle resolution               | Observed `500000 FOR / 300000 AGAINST`, passed               | [0x03826050a07f672f72de37bb7422161d338998620ee9fd470c5215d3489a8df1](https://sepolia.etherscan.io/tx/0x03826050a07f672f72de37bb7422161d338998620ee9fd470c5215d3489a8df1) |

Final `scenario:status`: `totalSharesOnRecord=800000`, `paused=false`, `distributionCount=1`, `resolutionCount=1`,
`resolved=true`, `passed=true`, `tallyRequested=true`.
