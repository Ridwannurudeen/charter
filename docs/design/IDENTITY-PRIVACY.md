# Identity Privacy for Charter

Status: design specification for an experimental Phase 1 prototype. Nothing in this document is deployed, audited, or
part of `@gudman/charter-core`.

## Decision

Charter should prototype ERC-5564 scheme 1 stealth issuance as an optional adapter. The adapter would mint encrypted
shares to a correctly derived, one-time address and announce that address through the ERC-5564 announcer interface in
the same transaction.

This is the thinnest option that can improve identity unlinkability without replacing ERC-7984. It is not identity
privacy by itself. The one-time holder address remains public, the issuer still knows the investor, and operational
mistakes can reconnect the address to that investor.

The design follows the final standards:

- [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) defines scheme 1 stealth-address derivation, recipient scanning,
  private-key derivation, view tags, and the canonical announcer interface.
- [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538) defines a canonical singleton registry for stealth meta-addresses.
  Charter should use that interface where it is available, not deploy a Charter-specific replacement.

Before any non-local use, the integrator must verify that the standard registry and announcer contracts exist with the
expected bytecode on the target chain. Local tests use a mock announcer; this design does not claim that the canonical
contracts exist on a local Hardhat network or every FHEVM network.

## Current privacy boundary

ERC-7984 encrypts quantities, not accounts. The installed implementation stores balances and operator approvals under
ordinary `address` keys. Its `ConfidentialTransfer` event exposes indexed `from` and `to` addresses while emitting the
amount as an encrypted handle. Charter modules also expose address-level participation: accreditation, issuance,
observer selection, proposals, votes, claims, tenders, vesting grants, and enforcement endpoints.

The current guarantee is therefore:

- share balances, transfer quantities, vote weights, and individual payouts can remain encrypted;
- holder addresses, transaction timing, participation, and address relationships are public;
- the issuer and its off-chain identity or KYC provider know which legal person controls each approved wallet.

An optional module cannot make the ERC-7984 address key or its transfer endpoints secret. It can only change which
address is used. A fresh stealth address can make that public address difficult for a passive observer to associate with
the recipient's canonical identity.

## Options considered

| Option                                                 | What it improves                                                                                                     | What it does not improve                                                                                                   | Verdict                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| ERC-5564 scheme 1 stealth addresses                    | Replaces a reused, identity-linked recipient address with a one-time address whose key only the recipient can derive | The one-time address, timing, transaction count, issuer, and future activity remain public; the issuer knows the recipient | Recommended for the experimental prototype                                              |
| Commitment-based holder registry                       | Can hide identity attributes behind a salted commitment and support future anonymous-credential work                 | ERC-7984 still records a public holder address; a bare commitment proves neither eligibility nor uniqueness                | Do not prototype without a ZK membership proof, nullifier design, and credential issuer |
| Off-chain holder directory with an on-chain commitment | Commits to a directory version for integrity and later audit without publishing its contents                         | Adds no unlinkability to public ERC-7984 holder addresses; the operator still holds the complete directory                 | Useful compliance evidence, not an identity-privacy prototype                           |

A commitment-only contract would be privacy theater. To make commitment-based registration meaningful, a holder would
need to prove in zero knowledge that they possess an authorized credential, bind that proof to a one-time address, and
use a nullifier to prevent duplicate registration without revealing the underlying identity. Charter has no such
circuit, verifier, credential format, or recovery model today.

An off-chain directory is still necessary for legal ownership and KYC. Publishing a Merkle root of that directory can
make later alteration detectable, but it does not change what chain observers see. It should be evaluated separately as
an auditability feature.

## Selected data flow

The selected flow uses the standard stealth-address components and a minimal Charter adapter:

1. The investor creates separate scheme 1 spending and viewing keys and publishes the resulting stealth meta-address. If
   the target chain supports the canonical ERC-6538 registry, the investor may register it there.
2. The issuer completes identity, KYC, accreditation, and legal checks off-chain. Those checks are not delegated to the
   stealth protocol.
3. The issuer client retrieves the investor's meta-address and generates a fresh ephemeral key, shared secret, one-time
   stealth address, ephemeral public key, and view tag according to ERC-5564 scheme 1.
4. The issuer encrypts the share amount for the experimental adapter. The encrypted input is bound to the adapter and
   the issuer because the adapter converts it with `FHE.fromExternal`.
5. The issuer calls the adapter with the one-time address, encrypted amount and proof, ephemeral public key, and view
   tag.
6. The adapter verifies that it is still an active Charter module and that the caller is a Charter admin or agent. The
   adapter itself must also hold the share token's agent role so `confidentialMint` succeeds.
7. The adapter converts the encrypted input, gives `CharterShares` transient access, mints to the one-time address, and
   calls the ERC-5564 announcer in the same transaction. If the announcement reverts, the mint reverts with it.
8. The investor scans announcement events with the viewing key, recognizes the one-time address, derives its private
   key, and can sign the normal Charter user-decryption request for that address.

The adapter never accepts, stores, or emits the investor's canonical wallet or legal identity. It also cannot verify
that the supplied one-time address was derived correctly: doing so requires secret material held by the issuer and
recipient. Correct scheme 1 derivation is a client responsibility and must be covered by independent sender- and
recipient-side derivation tests.

## Minimal atomic adapter

The experimental contract should live outside `@gudman/charter-core`, under `contracts/experimental/`. Its intended
surface is:

```solidity
interface IERC5564Announcer {
  function announce(
    uint256 schemeId,
    address stealthAddress,
    bytes memory ephemeralPubKey,
    bytes memory metadata
  ) external;
}

function issue(
  address stealthAddress,
  externalEuint64 encryptedAmount,
  bytes calldata inputProof,
  bytes calldata ephemeralPubKey,
  bytes1 viewTag
) external;
```

The adapter should use these fixed rules:

- scheme ID is `1`;
- `stealthAddress` must be nonzero;
- the caller must be a Charter admin or agent;
- `SHARES.isModule(address(this))` must be true;
- the adapter must be separately granted the Charter agent role;
- the mint and announcement must be atomic;
- no canonical identity, canonical wallet, stealth meta-address, or clear share amount is stored;
- the announcer address is supplied for the target network and verified before deployment; a mock is used locally.

### Announcement metadata

ERC-5564 requires the first metadata byte to be the view tag. For this adapter, metadata is exactly:

```text
viewTag (1 byte) || issue selector (4 bytes) || CharterShares address (20 bytes)
```

The metadata is therefore 25 bytes. It deliberately stops before the optional fungible-token amount field described by
ERC-5564. Encoding the clear share amount in that field would undo ERC-7984 amount privacy. The encrypted amount handle
remains available through the normal ERC-7984 mint event; it is not copied into announcement metadata.

The announcer's `caller` field will identify the experimental adapter, not the issuer's canonical identity. The issuer
transaction sender is still visible in the transaction itself.

## Threat model

### Intended protection

The design targets a passive public-chain observer who knows an investor's ordinary wallet or real-world identity but
does not possess the investor's viewing key, the issuer's ephemeral private key, or the issuer's confidential directory.
Against that observer, a correctly generated and never-reused stealth address can obscure which public holder address
belongs to the investor.

### Parties that still know or can learn the mapping

- The issuer knows the recipient because it selects the meta-address and creates the stealth address.
- The issuer's KYC provider, legal administrator, or transfer agent may know the same association through the off-chain
  holder directory.
- The investor knows and controls each derived one-time address.
- A party that obtains the investor's viewing key can identify their stealth announcements.
- A party that compromises the spending key can control the corresponding shares.
- Network, wallet, RPC, browser, or application telemetry may reveal which meta-address the issuer queried or which
  announcements the investor scanned.

This is pseudonymous address unlinkability, not anonymity against the issuer, endpoint compromise, traffic analysis, or
legal process.

## Public and hidden data

| Data                                                                                                              | Visibility                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Share amount and resulting balance                                                                                | Encrypted under the existing ERC-7984/FHEVM model                                                               |
| One-time stealth holder address                                                                                   | Public in the mint event and token state                                                                        |
| Ephemeral public key and view tag                                                                                 | Public in the ERC-5564 announcement                                                                             |
| ERC-6538 registrant and stealth meta-address, when that registry is used                                          | Public in the registry; this does not by itself reveal which derived one-time address belongs to the registrant |
| Canonical investor wallet or legal identity                                                                       | Not accepted or emitted by the adapter; retained off-chain by the issuer as required                            |
| Issuer transaction and adapter address                                                                            | Public                                                                                                          |
| Issuance timing and number of recipients                                                                          | Public                                                                                                          |
| Total supply after Charter disclosure                                                                             | Public by Charter's existing design                                                                             |
| Accreditation of a one-time address, if the existing registry is also used                                        | Public for that address, without an on-chain canonical-identity link                                            |
| Later votes, claims, tenders, observer changes, operator approvals, and enforcement involving the stealth address | Public at the address level                                                                                     |

## Unlinkability failure modes

The privacy gain disappears or weakens when:

- the same stealth address is used for multiple issuances or unrelated applications;
- shares are consolidated into a known wallet or transferred through an identifiable route;
- a known wallet funds the stealth address with gas;
- the stealth address receives distinctive amounts or participates at a uniquely identifying time;
- the investor self-delegates, votes, claims, tenders, appoints an observer, or grants an operator in a pattern that can
  be correlated with off-chain behavior;
- the issuer publishes or leaks its identity-to-stealth-address directory;
- registration, wallet, RPC, or application telemetry connects a derived address to the public ERC-6538 registrant;
- the viewing key, spending key, ephemeral private key, browser storage, or wallet telemetry is compromised;
- one-time addresses are deterministically generated with reused or weak entropy.

ERC-5564 explicitly identifies funding as a privacy risk. A usable product needs unlinked gas sponsorship, a paymaster,
or another funding path that does not originate from the investor's known wallet. That system is outside this prototype.

## UX and operational costs

- Investors manage spending and viewing keys in addition to their ordinary wallet keys.
- Wallets must scan announcements and derive one-time accounts before balances appear in the Charter UI.
- Every one-time address needs a safe gas strategy for transfers, votes, claims, and other transactions.
- Observer appointments, operator approvals, voting delegation, and recovery policy are per address unless a separate
  account-abstraction layer coordinates them.
- The issuer must keep a confidential, recoverable directory linking legal owners, meta-addresses, and issued stealth
  addresses. Losing that directory does not destroy shares, but it can break legal reporting and support.
- Key rotation and lost-key recovery require explicit procedures. `recoverAddress` remains an issuer-agent power and
  therefore does not provide privacy from the issuer.
- Compliance teams must decide whether each one-time address is separately accredited. Reusing the existing public
  `AccreditationRegistry` is possible, but it exposes the accreditation status of that one-time address.

## Prototype verification

The minimal local prototype should demonstrate only the claimed boundary:

1. Generate a scheme 1 address from isolated spending, viewing, and ephemeral test keys and independently derive the
   same address from the recipient side.
2. Register the adapter as both an active Charter module and a Charter agent.
3. Mint an encrypted allocation and assert that the derived stealth signer can decrypt its balance while the base
   spending-key signer alone cannot.
4. Assert that the mock announcer receives scheme ID `1`, the derived address, the ephemeral public key, and exactly 25
   metadata bytes whose first byte is the view tag.
5. Assert that metadata contains no clear or encrypted share amount.
6. Assert that a non-issuer caller, an inactive module, or a module without the agent role cannot issue.
7. Make the mock announcer revert and assert that the mint is rolled back.
8. Assert that the adapter exposes no storage field or event for a canonical identity or canonical wallet.

The local mock validates call shape and atomicity only. It does not establish that a canonical announcer is deployed on
the local chain, and it does not prove anonymity.

## Non-goals

This design does not:

- hide the one-time holder address, transaction graph, timing, participation count, or total disclosed supply;
- hide the investor from the issuer, KYC provider, legal administrator, wallet provider, or a compromised endpoint;
- provide anonymous accreditation, a zero-knowledge credential, Sybil resistance, or proof of unique legal ownership;
- validate stealth-address derivation on-chain;
- implement wallet scanning, key custody, gas sponsorship, recovery, or account abstraction;
- make existing Charter holders private retroactively;
- change ERC-7984 events, balances, operators, observers, voting, or RWA controls;
- replace the legal holder directory or claim that an on-chain address proves ownership under securities law;
- belong in `@gudman/charter-core` or imply production readiness.

The prototype is successful if it proves that a correctly derived one-time address can receive and decrypt encrypted
Charter shares through an atomic standard announcement flow. It is not successful merely because a random new address
received tokens. Production identity privacy would require the wallet, funding, directory, recovery, and compliance work
described above, followed by an independent security and privacy review.
