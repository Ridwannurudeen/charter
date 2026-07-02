# Charter demo script

## 3-minute recording plan

**0:00-0:20 - Problem**

Private-company cap tables cannot move on-chain if every investor balance, transfer, dividend, and vote becomes public.
Charter keeps the registry enforceable while encrypting individuals: verifiable totals, hidden individuals.

**0:20-0:45 - Issuance**

Open the issuer console. Mint 500,000 encrypted shares to investor 1 and 300,000 to investor 2. Show one transaction on
Etherscan and point out that the amount is an encrypted handle, not a clear balance.

**0:45-1:05 - Supply disclosure**

Run the disclosure flow. The relayer publicly decrypts only the total-supply handle, and `finalizeSupplyDisclosure`
verifies the KMS proof on-chain. Expected total: 800,000 shares.

**1:05-1:25 - Distribution**

Fund 10,000 mcUSD, declare a distribution, pause the share token as the record date, and pay both investors. The pool
and distribution id are public; each payout is encrypted.

**1:25-1:45 - Investor reveal**

Switch to the investor browser profile. Decrypt the share stake and mcUSD payout. Linger here: this is the product
moment. The investor sees their own economics; nobody else gets the register.

**1:45-2:00 - Auditor view**

Open `/auditor` in the auditor profile. Inspect the holder who appointed this wallet as observer, then decrypt only that
holder's share balance.

**2:00-2:30 - Architecture**

Show the README diagram. Explain the two disclosure paths: EIP-712 user decryptions for holder/observer views, and
public decryptions that return a KMS proof verified by `FHE.checkSignatures`.

**2:30-3:00 - Governance and close**

Show a resolution where investor 1 votes for and investor 2 votes against. Settle the tally after the short voting
window: expected result is 500,000 FOR, 300,000 AGAINST, passed. Close with why Zama matters: the chain computes on
ciphertext, so cap-table workflows can become programmable without exposing the cap table.

## Recording checklist

- Wallets funded: deployer, investor 1, investor 2, auditor.
- Two browser profiles ready: issuer/deployer and investor.
- Auditor appointed before recording, or the appointment transaction queued as a visible step.
- Resolution pre-created with a short block window if settlement must happen inside the recording.
- README diagram open in a separate tab.
- Etherscan tabs ready for issuance, disclosure finalization, payout, and settlement tx hashes.
- Screen capture at 720p or higher with real voice narration.
