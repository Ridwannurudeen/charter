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
| Pay batch                       | Three holders paid                                                             | [0x20e0bf66a26a85aab0769b0b4761de33111c3e79d7d2571cc6f1700474336859](https://sepolia.etherscan.io/tx/0x20e0bf66a26a85aab0769b0b4761de33111c3e79d7d2571cc6f1700474336859) |
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

Resolutions 1 and 2 are both `tallyRequested=true`, `resolved=false` — either can be settled permissionlessly from the
governance page. Sourcify verification for all five contracts was completed in this pass (see Verification above).
