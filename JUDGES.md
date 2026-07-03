# Charter — Judge Quickstart

**Live app:** https://charter.gudman.xyz  ·  **Network:** Ethereum Sepolia  ·  **Repo:** https://github.com/Ridwannurudeen/charter

Charter is a **confidential equity cap table** — encrypted shareholdings, confidential pro-rata
dividends, and hidden-weight shareholder voting on the Zama Protocol (FHEVM). Everything below is
self-serve: you can experience the core "decrypt-your-own-position" moment and a live governance
settle with your own wallet, without us seeding anything for you.

## What you need
- A browser wallet (MetaMask) on **Ethereum Sepolia**.
- A little Sepolia ETH for gas ([faucet](https://sepoliafaucet.com/)). The app auto-switches your
  wallet to Sepolia on connect.

## The 4-step self-serve demo (~3 minutes)

1. **Become a shareholder.** Open the [Investor portal](https://charter.gudman.xyz/investor),
   connect, and click **Claim demo shares** — the on-chain `DemoShareFaucet` mints you 1,000
   encrypted CDC-S shares (one claim per wallet).
2. **Decrypt your own position — the core moment.** Click **Decrypt my stake**. One EIP-712
   signature authorizes a 1-day private decryption session; the ciphertext is decrypted **in your
   browser** (the relayer only ever sees ciphertext). You see `1,000 shares`; nobody else can.
3. **Activate voting power**, then go to [Governance](https://charter.gudman.xyz/governance) and
   cast an **encrypted vote** on the open resolution. Neither your choice nor your weight is
   revealed — only the pass/fail outcome is ever disclosed. A fresh resolution is proposed
   automatically on a rolling schedule, so there is always an open one to vote on.
4. **Settle a resolution with proof.** Any past-deadline resolution has a permissionless
   **Settle with proof** button: it runs a public KMS decryption of the *outcome only* and verifies
   the proof on-chain (`FHE.checkSignatures`). Watch the `PublicDecryptionVerified` event land on
   Etherscan — the exact tallies are never published.

Bonus: use the **mcUSD faucet** on the Investor page to get a confidential-stablecoin balance, then
**Decrypt my payouts** to see a dividend you received, decryptable only by you.

## What is public vs. private (by design)
- **Public & verifiable:** total issued shares (disclosed with a KMS proof), dividend pool amounts,
  resolution pass/fail outcomes, and *which* addresses participate.
- **Encrypted / private:** every individual share balance, every dividend payout, and every vote's
  direction and weight. Only exact vote tallies are **never** disclosed — governance reveals the
  outcome, not the numbers.

Full trust model and constraints are in the README's "Design Decisions And Constraints."

## Deployed & verified on Sepolia (source-verified on Etherscan + Sourcify)

| Contract | Address |
| --- | --- |
| CharterShares (registry) | [`0xc5Af9E2b3A110D20D914c5771beb5DFBA5F6d61A`](https://sepolia.etherscan.io/address/0xc5Af9E2b3A110D20D914c5771beb5DFBA5F6d61A#code) |
| DividendDistributor | [`0x42C8c19fbC1E2F5649d540237759E7bFee5617b9`](https://sepolia.etherscan.io/address/0x42C8c19fbC1E2F5649d540237759E7bFee5617b9#code) |
| CharterResolutions (governance) | see README (module registry may point at a newer version) |
| MockConfidentialUSD | [`0xb6B08dC3014D944231E01Ad5a0292Efeea859112`](https://sepolia.etherscan.io/address/0xb6B08dC3014D944231E01Ad5a0292Efeea859112#code) |
| DemoShareFaucet | [`0x9AF5A8e7d036E4347D0458748D9bC27131D0710C`](https://sepolia.etherscan.io/address/0x9AF5A8e7d036E4347D0458748D9bC27131D0710C#code) |

Run the contract suite locally: `npm i && npx hardhat test`. Full on-chain lifecycle with every tx
hash is in `docs/E2E-RUN.md`.
