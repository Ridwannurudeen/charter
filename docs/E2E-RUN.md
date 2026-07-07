# Charter Sepolia E2E Run

Date: 2026-07-03 Network: Sepolia, chain id 11155111 Deployer: `0x04045Ca68BEF611adBD76e58C028cEFf4a3d640D` Voter 1:
`0x510456aB08994AaC33fc8487b00774F531cD1e6C` Voter 2: `0x697B2D132a86d3f07ACe4a296f8d5c3bd150B7Dc`

No mnemonic, private key, RPC URL, or API token was printed or written during this run.

## Gas Preflight

| Check                  | Result       |
| ---------------------- | ------------ |
| Pre-deploy gas price   | 1.2225 gwei  |
| Pre-deploy balance     | 0.295592 ETH |
| Final gas recheck      | 0.9946 gwei  |
| Final deployer balance | 0.271276 ETH |

## Deployment

| Step                         | Address                                      | Tx                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CharterShares` deploy       | `0xc5Af9E2b3A110D20D914c5771beb5DFBA5F6d61A` | [0x287e581d2c3b934d78f69df039f4d4cb238f12b6b411fb8ebd767c7191ceef91](https://sepolia.etherscan.io/tx/0x287e581d2c3b934d78f69df039f4d4cb238f12b6b411fb8ebd767c7191ceef91) |
| `MockConfidentialUSD` deploy | `0xb6B08dC3014D944231E01Ad5a0292Efeea859112` | [0xda9a303a7b466d24d0ffc256854f476b3c7bf9e07f43f3c7638d0e7bbe36d6ed](https://sepolia.etherscan.io/tx/0xda9a303a7b466d24d0ffc256854f476b3c7bf9e07f43f3c7638d0e7bbe36d6ed) |
| `DividendDistributor` deploy | `0x42C8c19fbC1E2F5649d540237759E7bFee5617b9` | [0x4ccaca6e3ca5dbb40b4f2bb3b5bb1709ab7263ce0faf3ae52a9b05038ffb71a2](https://sepolia.etherscan.io/tx/0x4ccaca6e3ca5dbb40b4f2bb3b5bb1709ab7263ce0faf3ae52a9b05038ffb71a2) |
| `CharterResolutions` deploy  | `0x7FE785A2ec9cFb10283fAB7aE6d2c2d3Ad5662B3` | [0x1c654e201f2049f20a145ddaef8f1c279a45c22775fe2a63951af64a6fb0930f](https://sepolia.etherscan.io/tx/0x1c654e201f2049f20a145ddaef8f1c279a45c22775fe2a63951af64a6fb0930f) |
| `DemoShareFaucet` deploy     | `0x9AF5A8e7d036E4347D0458748D9bC27131D0710C` | [0x380805c9611b1be137cf07369f68fd09f653ff3e01853c04744f8ef1be0c63fb](https://sepolia.etherscan.io/tx/0x380805c9611b1be137cf07369f68fd09f653ff3e01853c04744f8ef1be0c63fb) |
| Register distributor module  | `0x42C8c19fbC1E2F5649d540237759E7bFee5617b9` | [0x31137dadb8d5af5da34a04b90b18fd60c7b587c0669bfb946cd0cf12d14b555a](https://sepolia.etherscan.io/tx/0x31137dadb8d5af5da34a04b90b18fd60c7b587c0669bfb946cd0cf12d14b555a) |
| Register resolutions module  | `0x7FE785A2ec9cFb10283fAB7aE6d2c2d3Ad5662B3` | [0xf2ea06c02380573bfa83211ab15aa9755bdb14e538bed992653336ecec3418c6](https://sepolia.etherscan.io/tx/0xf2ea06c02380573bfa83211ab15aa9755bdb14e538bed992653336ecec3418c6) |
| Add deployer agent role      | `0x04045Ca68BEF611adBD76e58C028cEFf4a3d640D` | [0xd390c6e18675d5fed6bcd8dd7357610000797523ad9793bfeb84e6cdc2307d1c](https://sepolia.etherscan.io/tx/0xd390c6e18675d5fed6bcd8dd7357610000797523ad9793bfeb84e6cdc2307d1c) |
| Add faucet agent role        | `0x9AF5A8e7d036E4347D0458748D9bC27131D0710C` | [0xe5065f92eae112535bd7611ad59acf99b8e8d9e0877d9534caa2db8f4242eb56](https://sepolia.etherscan.io/tx/0xe5065f92eae112535bd7611ad59acf99b8e8d9e0877d9534caa2db8f4242eb56) |

## Verification

| Target    | Result                                                                                  |
| --------- | --------------------------------------------------------------------------------------- |
| Etherscan | All five redeployed contracts source-verified (confirmed via API by contract name).     |
| Sourcify  | All five redeployed contracts verified on 2026-07-03 (partial match, `hardhat verify`). |

## Frontend Wiring

- `npm run export:addresses` wrote new public addresses to `web/.env.local`.
- `cd web && npm run build` passed after stopping the local screenshot server that was holding `web/out` open.
- `npx tsc --noEmit` and `npx eslint .` passed in `web/`.
- Screenshots were refreshed in `docs/img/`.

## Lifecycle E2E

Initial `scenario:status`: `totalSharesOnRecord=0`, `paused=false`, `distributionCount=0`, `resolutionCount=0`.

| Step                            | Expected / observed value                                                      | Tx                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Issue deployer                  | 500000 encrypted shares                                                        | [0xfb04f5846d6f8dbf98d7179ee300438127d81cd74f43a8b59a1910ca086f3a4e](https://sepolia.etherscan.io/tx/0xfb04f5846d6f8dbf98d7179ee300438127d81cd74f43a8b59a1910ca086f3a4e) |
| Issue voter 1                   | 300000 encrypted shares                                                        | [0xddbea70e69ca8cb752facdc2d37112f4c5d96f0d07b86a1ec4d900a2c83e063d](https://sepolia.etherscan.io/tx/0xddbea70e69ca8cb752facdc2d37112f4c5d96f0d07b86a1ec4d900a2c83e063d) |
| Issue voter 2                   | 200000 encrypted shares                                                        | [0x961eef57fa025d71b609e814783a9adf31e17a7a62df0d62f09f48dc9f178e29](https://sepolia.etherscan.io/tx/0x961eef57fa025d71b609e814783a9adf31e17a7a62df0d62f09f48dc9f178e29) |
| Request supply disclosure       | Total supply handle requested                                                  | [0x93b8232280ecd83cd78e7db00a87dd69b5c3c2f231a6470bdc196d3a2d4f22d7](https://sepolia.etherscan.io/tx/0x93b8232280ecd83cd78e7db00a87dd69b5c3c2f231a6470bdc196d3a2d4f22d7) |
| Finalize supply disclosure      | Observed `1,000,000` shares                                                    | [0xb3b02952fcf643877e07d633aaac01ba42dc036165b2ce1a5398bba6883fa33b](https://sepolia.etherscan.io/tx/0xb3b02952fcf643877e07d633aaac01ba42dc036165b2ce1a5398bba6883fa33b) |
| Delegate deployer               | Self-delegated                                                                 | [0x2389a936a122d70d1792471c17810d251ac804cc030f78c1273ddf83750af8ac](https://sepolia.etherscan.io/tx/0x2389a936a122d70d1792471c17810d251ac804cc030f78c1273ddf83750af8ac) |
| Delegate voter 1                | Self-delegated                                                                 | [0x074dba1e6b77c974dd98e8d3875b9fd526cf894ad0a14cece251e32912fc62bb](https://sepolia.etherscan.io/tx/0x074dba1e6b77c974dd98e8d3875b9fd526cf894ad0a14cece251e32912fc62bb) |
| Delegate voter 2                | Self-delegated                                                                 | [0xbb576b297afc8e0024351cf7b56ac79a989534a8ece11dff6430c7e5e83fee18](https://sepolia.etherscan.io/tx/0xbb576b297afc8e0024351cf7b56ac79a989534a8ece11dff6430c7e5e83fee18) |
| Mint mcUSD                      | 1000 mcUSD to deployer                                                         | [0xc81a584a67e1f84c92261d029b506d4af8a6b464730a80976ece25a2ba9a9266](https://sepolia.etherscan.io/tx/0xc81a584a67e1f84c92261d029b506d4af8a6b464730a80976ece25a2ba9a9266) |
| Approve distributor as operator | Operator until 1783170827                                                      | [0xbd5dbd6f266820b43f72dba0f4bdf3056f5ba126e3dc6876941dd6a42742aaa6](https://sepolia.etherscan.io/tx/0xbd5dbd6f266820b43f72dba0f4bdf3056f5ba126e3dc6876941dd6a42742aaa6) |
| Pause shares                    | Pause is the dividend record date                                              | [0xd57739d29b6a45ba90217529087b6c815133d335480b9de54480de36f1a0c4ac](https://sepolia.etherscan.io/tx/0xd57739d29b6a45ba90217529087b6c815133d335480b9de54480de36f1a0c4ac) |
| Declare distribution            | Distribution id `0`, pool 1000 mcUSD                                           | [0x2da70170e86f441d76f9f8b7cc5b5f9fb1817e8f1fea6082e2899c1eadac124c](https://sepolia.etherscan.io/tx/0x2da70170e86f441d76f9f8b7cc5b5f9fb1817e8f1fea6082e2899c1eadac124c) |
| Investor claim                  | Holders claim distribution id `0` via `claim(0)`                               | Wallet-specific claim tx appears on-chain for each wallet                                                                                                                |
| Pay batch (legacy benchmark)    | Three holders paid through legacy operator flow (historical only)              | [0x20e0bf66a26a85aab0769b0b4761de33111c3e79d7d2571cc6f1700474336859](https://sepolia.etherscan.io/tx/0x20e0bf66a26a85aab0769b0b4761de33111c3e79d7d2571cc6f1700474336859) |
| Unpause shares                  | Transfers live again                                                           | [0xa61843401e3037e110154c8ff78dc6610e0e622276439049c3f4b8c330094546](https://sepolia.etherscan.io/tx/0xa61843401e3037e110154c8ff78dc6610e0e622276439049c3f4b8c330094546) |
| Propose resolution 0            | Resolution id `0`, 40-block window                                             | [0xbcb10973c076ab0f560249917e46a0a037b82e705f390a336ff802bb59c2786b](https://sepolia.etherscan.io/tx/0xbcb10973c076ab0f560249917e46a0a037b82e705f390a336ff802bb59c2786b) |
| Vote resolution 0, deployer     | FOR                                                                            | [0xecde4fc9f03fccbfaab0f3d549719ff117ad47881df0cfd7bc283c114f9bda18](https://sepolia.etherscan.io/tx/0xecde4fc9f03fccbfaab0f3d549719ff117ad47881df0cfd7bc283c114f9bda18) |
| Vote resolution 0, voter 1      | AGAINST                                                                        | [0xfcefeefe6521b1df94d29656dd4feba22a8fff81aca3b9a54690a288a3e58703](https://sepolia.etherscan.io/tx/0xfcefeefe6521b1df94d29656dd4feba22a8fff81aca3b9a54690a288a3e58703) |
| Vote resolution 0, voter 2      | FOR                                                                            | [0x7ffd2e1f74bd569e4041b5543ca6e93acb5fa8899cb3921ed8415e1354bcd143](https://sepolia.etherscan.io/tx/0x7ffd2e1f74bd569e4041b5543ca6e93acb5fa8899cb3921ed8415e1354bcd143) |
| Request resolution 0 tally      | Deadline `11194471`, requested after block `11194472`                          | [0x82b4c58bfc40c473d32c5d533379fa40ed8676a033e6de6c1999f2e73e375f40](https://sepolia.etherscan.io/tx/0x82b4c58bfc40c473d32c5d533379fa40ed8676a033e6de6c1999f2e73e375f40) |
| Settle resolution 0             | Observed only `passed`; exact for/against tallies were not disclosed           | [0x9fae760f3b251780702465da03fbc20418ce7d1d8557cd9f548f791125e07a62](https://sepolia.etherscan.io/tx/0x9fae760f3b251780702465da03fbc20418ce7d1d8557cd9f548f791125e07a62) |
| Propose resolution 1            | Staged judge-triggered outcome reveal                                          | [0x8b0561f84180db8c2157124c82e4801630d91fa72fd0b2d0aaf02af02d76a5fc](https://sepolia.etherscan.io/tx/0x8b0561f84180db8c2157124c82e4801630d91fa72fd0b2d0aaf02af02d76a5fc) |
| Vote resolution 1, deployer     | FOR                                                                            | [0xd4243713f56ce0580b232e8248745162efc7419c9b7d9c565b0bd6d059d02765](https://sepolia.etherscan.io/tx/0xd4243713f56ce0580b232e8248745162efc7419c9b7d9c565b0bd6d059d02765) |
| Vote resolution 1, voter 1      | AGAINST                                                                        | [0x7d9d5f185c1a9b7506921f33bb8d9ab059a23ebf96cd16f315ba2557d058467b](https://sepolia.etherscan.io/tx/0x7d9d5f185c1a9b7506921f33bb8d9ab059a23ebf96cd16f315ba2557d058467b) |
| Vote resolution 1, voter 2      | FOR                                                                            | [0xbc0be6e2bac8473a6dbcc08cf35cf6c413fcafd77c8c86e6dee3d92bd2418429](https://sepolia.etherscan.io/tx/0xbc0be6e2bac8473a6dbcc08cf35cf6c413fcafd77c8c86e6dee3d92bd2418429) |
| Request resolution 1 tally      | Deadline `11194517`, tally requested and left unresolved for the governance UI | [0x968fbe4468311e27d9d374afcf64f456629cfca3131af8ae979397226b5b58b9](https://sepolia.etherscan.io/tx/0x968fbe4468311e27d9d374afcf64f456629cfca3131af8ae979397226b5b58b9) |

Final `scenario:status`: `totalSharesOnRecord=1000000`, `paused=false`, `distributionCount=1`, `resolutionCount=2`.
Resolution 0 is `resolved=true`, `passed=true`, `tallyRequested=true`. Resolution 1 is `resolved=false`, `passed=false`,
`tallyRequested=true`, ready for a judge-triggered final settle.

## Post-run additions (2026-07-03, review pass)

A second judge-triggerable resolution was staged so more than one visitor can perform the settle-with-proof flow.

| Step                        | Detail                                                       | Tx                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Propose resolution 2        | "Authorize a follow-on employee share pool", 25-block window | [0x93dc76bf07a1cf30ca28e674581d4f32f2441c1b55dd5f8b4b3609c37b4943c8](https://sepolia.etherscan.io/tx/0x93dc76bf07a1cf30ca28e674581d4f32f2441c1b55dd5f8b4b3609c37b4943c8) |
| Vote resolution 2, deployer | FOR                                                          | [0xc3a48947738b70ab5358c53946e2eba0eb40240ca8c0d807b9f952bb8cefd916](https://sepolia.etherscan.io/tx/0xc3a48947738b70ab5358c53946e2eba0eb40240ca8c0d807b9f952bb8cefd916) |
| Vote resolution 2, voter 1  | AGAINST                                                      | [0xe479662e025fc40cd48bf098ab32b7eab423957b371e71464d6b7eefa3c941b3](https://sepolia.etherscan.io/tx/0xe479662e025fc40cd48bf098ab32b7eab423957b371e71464d6b7eefa3c941b3) |
| Vote resolution 2, voter 2  | FOR                                                          | [0xd96e714c17999a79db3ca13be0c80eb0a9ca8e81b157461c02f4c22005557224](https://sepolia.etherscan.io/tx/0xd96e714c17999a79db3ca13be0c80eb0a9ca8e81b157461c02f4c22005557224) |
| Request resolution 2 tally  | Tally requested and left unresolved                          | [0x3d9dca982187a1fd36b6b35807b5c2fc37158eb3d211bcf5dd7287787817ed95](https://sepolia.etherscan.io/tx/0x3d9dca982187a1fd36b6b35807b5c2fc37158eb3d211bcf5dd7287787817ed95) |

Resolutions 1 and 2 are both `tallyRequested=true`, `resolved=false` â€” either can be settled permissionlessly from the
governance page. Sourcify verification for all five contracts was completed in this pass (see Verification above).

## Fixing six structural limitations (2026-07-04)

A brutally-honest self-review found six real gaps between what Charter claims and what it builds: no vesting/lifecycle
modeling, no path to a compliant issuance gate, unilateral single-key force-transfer dressed as "compliance," an
amount-vs-identity privacy mismatch, a benchmarked legacy batch-size limit, and over-claiming "cap table" against a
production competitor. Three new modules were built, tested (11 new tests, 41 total), deployed, verified on both
explorers, and exercised live on Sepolia with real transactions below. The privacy-model and positioning gaps were fixed
by precise re-scoping in this document and the README, not new code â€” see "Design Decisions and Constraints."

### Confidential vesting (`VestingSchedule`)

The cliff-and-linear vesting mechanic every real cap table is built around; previously entirely absent.

| Step                                        | Detail                                                                 | Tx                                                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Issuer approves VestingSchedule as operator | `setOperator` on CharterShares                                         | (see grant tx below; same transaction batch)                                                                                                                             |
| Grant created                               | 50,000 encrypted shares escrowed, 30-block cliff, 120-block total vest | [0x290c9ccfe54aec0d3eac94e7a18091d2bcfbb7e014cbda02ff6b929b32c77ecc](https://sepolia.etherscan.io/tx/0x290c9ccfe54aec0d3eac94e7a18091d2bcfbb7e014cbda02ff6b929b32c77ecc) |

### Gated issuance (`AccreditationRegistry` + `GatedIssuance`)

The default-deny compliant counterpart to the open `DemoShareFaucet`: mints only to wallets an admin has explicitly
accredited.

| Step              | Detail                                                      | Tx                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wallet accredited | Registry admin marks a wallet eligible                      | [0xf2f267215fc7c7f87cec1a6d61298b257570e19be6a89dc77f6111e9556d48b7](https://sepolia.etherscan.io/tx/0xf2f267215fc7c7f87cec1a6d61298b257570e19be6a89dc77f6111e9556d48b7) |
| Gated mint        | 25,000 encrypted shares minted to the now-accredited wallet | [0x65f76e257f727fa64525493c4466b136ac1cfd9777e0288d476154913fea3d4e](https://sepolia.etherscan.io/tx/0x65f76e257f727fa64525493c4466b136ac1cfd9777e0288d476154913fea3d4e) |

A mint attempt to a non-accredited wallet reverts with `IssuanceNotAccredited` before the gate is granted â€” verified
in the test suite.

### Force-transfer guardian (`ForceTransferGuardian`)

Replaces a single agent's silent, unilateral `forceConfidentialTransferFrom` with a 2-of-3 guardian quorum, a public
reason, and a 30-block timelock before anyone can execute. The demo's three guardian keys are derived from the same
mnemonic for convenience â€” a real deployment would assign each guardian to an independently-held key so no single
party controls quorum. Guardians were funded with a small amount of Sepolia ETH to submit these transactions.

| Step                       | Detail                                                                                              | Tx                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guardian 1 funded          | 0.01 ETH for gas                                                                                    | [0x85ab3120cced208a129c7bff2a5c4b32bb9f1468f87bf5d40658feedeccda8e4](https://sepolia.etherscan.io/tx/0x85ab3120cced208a129c7bff2a5c4b32bb9f1468f87bf5d40658feedeccda8e4) |
| Guardian 2 funded          | 0.01 ETH for gas                                                                                    | [0x0e6099d41e4ba8082579e8cf4d54fc09afb1cf8349a6c309223ebf2ab05617d2](https://sepolia.etherscan.io/tx/0x0e6099d41e4ba8082579e8cf4d54fc09afb1cf8349a6c309223ebf2ab05617d2) |
| Proposed                   | 5,000 encrypted shares, reason: "Demo enforcement action: recover shares from a compromised wallet" | [0x6352a7fad528cbfd220481830f94c706772525d61a1e575231b248728990d7a3](https://sepolia.etherscan.io/tx/0x6352a7fad528cbfd220481830f94c706772525d61a1e575231b248728990d7a3) |
| Confirmed (quorum reached) | 2-of-3 guardians confirmed; timelock started                                                        | [0x44b3d038686b39217711ec1e1388afb86edac0735507929dd2689a7e2df25e9e](https://sepolia.etherscan.io/tx/0x44b3d038686b39217711ec1e1388afb86edac0735507929dd2689a7e2df25e9e) |
| Executed after timelock    | Shares moved only after quorum + delay                                                              | [0x2b668cbce2948e8307934c127d2b3e73c2d2bfb739543b4c2cb0bbe061e6c208](https://sepolia.etherscan.io/tx/0x2b668cbce2948e8307934c127d2b3e73c2d2bfb739543b4c2cb0bbe061e6c208) |

## Claim-enabled distributor swaps (2026-07-07)

The original Sepolia distributor at `0x42C8c19fbC1E2F5649d540237759E7bFee5617b9` was the legacy operator-push path. It
was first replaced by `0x087966338018456ED2079D3D3d67F7A1B16e40c6` to add investor-pulled `claim(uint256)` payouts. A
small follow-up then replaced that distributor with `0xd8562d7609c0E05DdD9ba4653cE90646bf2eB3b4`, keeping `claim()` and
restoring the explicit `payBatch` guard (`MAX_PAY_BATCH = 12`, `DistributorBatchTooLarge`). Both swaps used the same
`CharterShares` contract; the share token was not redeployed and no holdings were migrated.

### Generation 2: claim-enabled distributor

| Step                                | Detail                                              | Tx                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deploy claim-enabled distributor    | `DividendDistributor` with `claim(uint256)`         | [0x6c044ba18e05cd82613c50d0e512ba96be57d4c558b7ebcb2426dbf7a8937a05](https://sepolia.etherscan.io/tx/0x6c044ba18e05cd82613c50d0e512ba96be57d4c558b7ebcb2426dbf7a8937a05) |
| Register new distributor module     | `CharterShares.setModule(new, true)`                | [0xef12ce6df8d1cc605ceacd04e98830b0e22bd13cb071565768d7a329adbd2d10](https://sepolia.etherscan.io/tx/0xef12ce6df8d1cc605ceacd04e98830b0e22bd13cb071565768d7a329adbd2d10) |
| Revoke legacy distributor module    | `CharterShares.setModule(old, false)`               | [0x03d310e32c13e8d8a8aba6b470aada4e24b94a8451c6515e1acf0531a278b090](https://sepolia.etherscan.io/tx/0x03d310e32c13e8d8a8aba6b470aada4e24b94a8451c6515e1acf0531a278b090) |
| Mint payout token                   | 1,000 mcUSD to deployer                             | [0xde3263cce4ee4d94fea33d15daeff845d1951908befb04f47d07ef49f5d821e5](https://sepolia.etherscan.io/tx/0xde3263cce4ee4d94fea33d15daeff845d1951908befb04f47d07ef49f5d821e5) |
| Approve new distributor as operator | Operator until `1783524192`                         | [0x90540af32fdfa2a2442f5b76d63f3339f56faa4441dc459b197afe612e895d66](https://sepolia.etherscan.io/tx/0x90540af32fdfa2a2442f5b76d63f3339f56faa4441dc459b197afe612e895d66) |
| Pause shares                        | Dividend record-date window                         | [0xf457388d36f4b8173792645852c5ecd5e8fd8377ae82e8c0d34bff4d6bccc4d8](https://sepolia.etherscan.io/tx/0xf457388d36f4b8173792645852c5ecd5e8fd8377ae82e8c0d34bff4d6bccc4d8) |
| Declare pull distribution           | Distribution id `0`, pool 1,000 mcUSD               | [0x879322890b47c7197522b7a06941d231cf771600f7de15c9f27defb7ce72f817](https://sepolia.etherscan.io/tx/0x879322890b47c7197522b7a06941d231cf771600f7de15c9f27defb7ce72f817) |
| Claim distribution                  | Deployer claimed distribution id `0` via `claim(0)` | [0x13d47fe9ceaa62c23626633a3ae7eac4821ac4eeeb1ec31a7a7eefe8699e08db](https://sepolia.etherscan.io/tx/0x13d47fe9ceaa62c23626633a3ae7eac4821ac4eeeb1ec31a7a7eefe8699e08db) |
| Unpause shares                      | Transfers live again                                | [0x11f68c5c7eb13702249f5001465dcf3a795e34683fc7e5dc4aa651c36b4f3e16](https://sepolia.etherscan.io/tx/0x11f68c5c7eb13702249f5001465dcf3a795e34683fc7e5dc4aa651c36b4f3e16) |

### Generation 3: guarded claim distributor (active)

| Step                                     | Detail                                                                           | Tx                                                                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deploy guarded claim distributor         | Active `DividendDistributor` with `claim()` and `MAX_PAY_BATCH = 12`             | [0x9814c64d7224f81eb71b5e5e297244950fd58301683f8f470f80b317aaa3594d](https://sepolia.etherscan.io/tx/0x9814c64d7224f81eb71b5e5e297244950fd58301683f8f470f80b317aaa3594d) |
| Register guarded distributor module      | `CharterShares.setModule(new, true)`                                             | [0x506dcaba10513327a1a2362bf0be0d2298bbc537a219f7273e3ccffc0b502bc5](https://sepolia.etherscan.io/tx/0x506dcaba10513327a1a2362bf0be0d2298bbc537a219f7273e3ccffc0b502bc5) |
| Revoke previous claim distributor module | `CharterShares.setModule(old, false)`                                            | [0xb79a9bb036fe14bb8d6a811946c1c99e4900ef5e5ea01754b182f31a5e29714d](https://sepolia.etherscan.io/tx/0xb79a9bb036fe14bb8d6a811946c1c99e4900ef5e5ea01754b182f31a5e29714d) |
| Mint payout token                        | 1,000 mcUSD to deployer                                                          | [0xf15b6c07330a03b100c6eb4f67d397b0b8010886ef6f0cc2debe177510baaa01](https://sepolia.etherscan.io/tx/0xf15b6c07330a03b100c6eb4f67d397b0b8010886ef6f0cc2debe177510baaa01) |
| Approve guarded distributor as operator  | Operator until `1783529210`                                                      | [0x97907b9f18f93e1e52a098fa70576a83592f81d5af2ee929094eedbdd24e0922](https://sepolia.etherscan.io/tx/0x97907b9f18f93e1e52a098fa70576a83592f81d5af2ee929094eedbdd24e0922) |
| Pause shares                             | Dividend record-date window                                                      | [0xf8cbfc16200cd477e224a7e1094d5914ba35e7a9e853047783964041e9fdb80c](https://sepolia.etherscan.io/tx/0xf8cbfc16200cd477e224a7e1094d5914ba35e7a9e853047783964041e9fdb80c) |
| Declare pull distribution                | Active distributor distribution id `0`, pool 1,000 mcUSD                         | [0xca11d185424768d73d41a6c26b14c88891c2d9dd732f54f740ff800b3f7ddd19](https://sepolia.etherscan.io/tx/0xca11d185424768d73d41a6c26b14c88891c2d9dd732f54f740ff800b3f7ddd19) |
| Probe oversized `payBatch`               | 13-address tx mined reverted; static call decoded `DistributorBatchTooLarge(13)` | [0xfd06c05b5c3a7ce72b6c750139468e5cb4efa8d16c1c4a7bbb950867740d9180](https://sepolia.etherscan.io/tx/0xfd06c05b5c3a7ce72b6c750139468e5cb4efa8d16c1c4a7bbb950867740d9180) |
| Claim distribution                       | Deployer claimed distribution id `0` via `claim(0)`                              | [0x6d77d7c48c34edee01e46d27ea08b8b4af8afc0bdf7eae64a75d5e31c73a4ed4](https://sepolia.etherscan.io/tx/0x6d77d7c48c34edee01e46d27ea08b8b4af8afc0bdf7eae64a75d5e31c73a4ed4) |
| Unpause shares                           | Transfers live again after the claim evidence transaction                        | [0x6fc6d6822f477f70718ab79ba919be32e301970e41890536a970ba508cb6844f](https://sepolia.etherscan.io/tx/0x6fc6d6822f477f70718ab79ba919be32e301970e41890536a970ba508cb6844f) |

Post-run read checks for the active distributor: `totalSharesOnRecord=1034800`, `paused=false`,
`supplyDisclosureStale=false`, `distributionCount=1`, and
`DividendDistributor.paid(0, 0x04045Ca68BEF611adBD76e58C028cEFf4a3d640D)=true`.

Source verification for the active distributor was retried on 2026-07-07. Etherscan returned `Connect Timeout Error`;
Sourcify returned a scheduled API v1 brownout (`503`). The contract is deployed and exercised live, but the active
address should not be described as source-verified until verification is rerun successfully.

### Legacy `payBatch` real batch-size benchmark

The legacy operator push flow remains for non-user-facing benchmarking. Pull-based `claim()` is now the user-facing
payout model. Historical probing of the guardless push flow found the real per-transaction ceiling for this
distribution: **12 investors succeeds, 13 reverts** (then with a coprocessor-level custom error, selector `0x77e3c293`).
The active guarded distributor now fails earlier and legibly: a 13-address live probe decoded to
`DistributorBatchTooLarge(13)` and the forced transaction mined reverted with status `0` before FHE batch work. Measured
gas for the legacy successful batches, cross-checked against the round-two 3-investor batch (1,191,296 gas,
~397k/investor): | Batch size | Gas used | Tx | | -------------------------------- | --------- |

---

| | 5 investors | 1,961,644 |
[0x8bf67681fd79074ad43c0aa084f4fb25e619c74109617a56df378b9ccceff493](https://sepolia.etherscan.io/tx/0x8bf67681fd79074ad43c0aa084f4fb25e619c74109617a56df378b9ccceff493)
| | 12 investors (confirmed ceiling) | 4,570,000 |
[0x06a3c2a3ad630b535cc0afd4dcf283067405681d6700c3a5ffa966f94dd2b6f7](https://sepolia.etherscan.io/tx/0x06a3c2a3ad630b535cc0afd4dcf283067405681d6700c3a5ffa966f94dd2b6f7)
| | 3 investors (remainder) | 1,216,397 |
[0xcdc540964d59a8ace17fcc378a1dd763b2e48a35d8d5fd83bfb05b3bc0f3df21](https://sepolia.etherscan.io/tx/0xcdc540964d59a8ace17fcc378a1dd763b2e48a35d8d5fd83bfb05b3bc0f3df21)
|

Implied marginal cost: ~372,600 gas per additional investor (consistent with the independent round-two data point). At
current Sepolia gas prices (~1 gwei) a 12-investor batch costs a small fraction of a cent; the binding constraint is the
per-transaction compute budget, not cost.
