# Charter Demo Script

## 3-Minute Recording Plan

**0:00-0:20 - Problem**

Private-company cap tables leak too much on public chains: balances, payout sizes, and voting weight become public
market data. Charter keeps the registry enforceable while encrypting quantities: public totals and outcomes, private
individual economics.

**0:20-0:40 - Self-Serve Judge Setup**

Open the Investor Portal with a fresh Sepolia wallet. Claim demo shares from `DemoShareFaucet`, then claim 10,000 test
mcUSD. Decrypt the share balance in-browser. This is the cold-judge path: no issuer intervention is required for the
first reveal moment.

**0:40-1:00 - Issuance**

Open the issuer console. Mint encrypted shares to at least three investors. Show one transaction on Etherscan and point
out that the amount is an encrypted handle and proof, not a clear balance.

**1:00-1:20 - Supply Disclosure**

Run the disclosure flow. The relayer publicly decrypts only the total-supply handle, and `finalizeSupplyDisclosure`
verifies the KMS proof on-chain. Explain that total shares are public by design while holder-level balances remain
encrypted.

**1:20-1:45 - Distribution**

Pause transfers first; that pause is the record date. Fund the mcUSD pool, declare the distribution, then switch to an
investor browser and call `claim(distributionId)`. The pool is public; each payout remains encrypted and
recipient-decryptable.

**1:45-2:05 - Investor Reveal**

Switch to an investor browser profile. Decrypt the share stake and mcUSD payout. Linger here: the investor sees their
own economics while everyone else sees ciphertext.

**2:05-2:20 - Auditor View**

Open `/auditor` in the auditor profile. Inspect a holder who appointed this wallet as observer, then decrypt only that
holder's share balance. State the boundary: observer removal stops future access, but already shared values remain
decryptable by the former observer.

**2:20-2:45 - Governance**

Show a resolution with at least three voters. Settle after the short voting window. The UI reveals only Passed or
Rejected; exact for/against totals are never disclosed, and hidden-weight voting protects individual positions.

**2:45-3:00 - Architecture And Close**

Show the README diagram. Explain the two disclosure paths: EIP-712 user decryptions for holder/observer views, and
public decryptions that return a KMS proof verified by `FHE.checkSignatures`. Close on the composability story: Charter
is an ERC-7984 equity-registry primitive for dividends, governance, and audit modules.

## Recording Checklist

- Wallets funded: deployer, at least three investors, auditor.
- Two browser profiles ready: issuer/deployer and investor; auditor profile optional if time is tight.
- Demo share faucet and mcUSD faucet tested before recording.
- Auditor appointed before recording, or the appointment transaction queued as a visible step.
- Resolution pre-created with `requestTally` done if settlement must happen inside the recording.
- README diagram open in a separate tab.
- Etherscan tabs ready for issuance, disclosure finalization, payout, and settlement tx hashes.
- Screen capture at 720p or higher with real voice narration.
