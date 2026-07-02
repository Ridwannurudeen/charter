# Charter — Build Plan (Codex)

Read `AGENTS.md` first for hard rules. This file: what remains, in priority order, with every
technical fact you need already verified against installed sources (2026-07-02).

## What Charter is

Private-company equity as ERC-7984 confidential tokens on Ethereum Sepolia ("Carta on FHE"):

- **CharterShares** — share registry. Encrypted per-investor holdings; agent mint/burn; transfer
  restrictions/freeze/pause/force-transfer (OZ `ERC7984Rwa`); checkpointed encrypted voting power
  (`ERC7984Votes`, requires self-delegation to activate); per-holder auditor observers
  (`ERC7984ObserverAccess`); **total-supply disclosure**: `requestSupplyDisclosure()` →
  relayer `publicDecrypt` off-chain → `finalizeSupplyDisclosure(clearSupply, proof)` verifies the
  KMS proof on-chain via `FHE.checkSignatures` and stores plaintext `totalSharesOnRecord`.
- **DividendDistributor** — issuer declares a **public** pool in an ERC-7984 payment token;
  per-investor payout computed on-chain as `encBalance × pool / totalSharesOnRecord`
  (scalar FHE mul/div). **Requires `shares.paused()`** — the pause is the record date.
  Batches of ~15 investors per tx (HCU budget).
- **CharterResolutions** — shareholder votes: encrypted bool direction × encrypted snapshot weight
  (`getPastVotes`); only aggregate tallies revealed after deadline via `publicDecrypt` + `settle(...)`
  with on-chain proof check.
- **MockConfidentialUSD** — open-mint mcUSD (6 decimals) demo payment token. Shares have 0 decimals.

Sales pitch (README/video must land this): *verifiable totals, hidden individuals* — the aggregate
is public and provable, every position is encrypted; plus auditor view keys = privacy WITH
compliance. Composable with the Zama ecosystem (ERC-7984 rails, TokenOps-adjacent).

## State right now

- Contracts + 20/20 tests green (`npx hardhat test`). Contracts are FROZEN.
- Frontend scaffolded and all pages written (landing, /issuer, /investor, /governance) — but the
  first full `npm run build` had not yet been confirmed green at handoff. **Your first task: make
  the build green without weakening types** (no `any`, no `@ts-ignore` unless truly forced).
- Sepolia deploy NOT done (burner `0x04045Ca68BEF611adBD76e58C028cEFf4a3d640D` awaits funding).
  Reviewer owns deployment. Until then `web/.env.local` addresses are placeholders — build
  everything address-agnostic via `NEXT_PUBLIC_*` env.

## Work items, in order

### P1 — Frontend build green + correctness pass  ✅ DONE (baseline established)
- `cd web && npm run build`, `npx eslint .`, `npx tsc --noEmit` all GREEN as of handoff.
  All 5 routes prerender to static `out/<route>/index.html`.
- **GOTCHA — do not undo:** Next 16's default **Turbopack build HANGS** forever at "Creating an
  optimized production build" with this dependency graph (relayer-sdk WASM). The build script is
  pinned to `next build --webpack` in `web/package.json` — keep it. Webpack build ≈ 35-70s, warns
  about a benign "Circular dependency between chunks" — ignore that warning.
- Other baseline settings already applied: `tsconfig` target ES2020 (BigInt literals);
  `next.config.ts` has `output: "export"`, `trailingSlash: true`, `images.unoptimized`,
  `turbopack.root`. The React 19 `react-hooks/set-state-in-effect` rule is scoped-disabled on the
  three fetch-on-mount effects (legitimate — loads set state only after awaited RPC).
- If you add code: re-verify every contract call against the ABIs in `web/lib/contracts.ts`, and
  keep all three checks green before committing.

### P2 — Auditor view page (`/auditor`) — MISSING, build it
The investor portal lets holders appoint an observer; there is **no page where the observer
decrypts what they oversee**. Build `/auditor`:
- Input: account address to inspect. Read `shares.observer(account)`; if it equals the connected
  wallet, show the account's encrypted share balance handle with an `EncryptedValue` decrypt flow
  (observer has standing ACL, so `userDecrypt` works for them).
- Also decrypt the account's mcUSD balance the same way (observers on mcUSD are separate — only
  show shares unless the account appointed the same observer on mcUSD; check `mcUSD.observer`?
  **No — MockConfidentialUSD does not extend ObserverAccess. Shares only.** Do not invent calls.)
- Keep a small local list (localStorage) of accounts the auditor has inspected.
- Add the tab to `AppShell` TABS.

### P3 — UX polish pass (judged criterion: "UX and frontend quality")
- Loading skeletons for handle fetches; pending-tx states already exist via Button busy state.
- Toast/callout consistency; empty states with guidance on every page.
- Mobile: verify at 375px; tab overflow behavior; touch targets ≥44px.
- A "How this works" explainer strip on each app page (1-2 lines linking the flow to FHE:
  "amounts encrypted client-side → computed on ciphertext → only you can decrypt").
- Add a demo-scenario banner when contracts are unconfigured (addresses zero): point to README.

### P4 — README.md (repo root)
Structure: hero paragraph → architecture diagram (ASCII fine) → the four contracts with the FHE
flows spelled out (disclosure proof loop, pause-as-record-date, hidden-weight voting, observer
keys) → local dev (hardhat test walkthrough) → Sepolia addresses table (placeholders to fill
post-deploy) → design decisions & constraints (HCU batching ~15/tx, `pool × totalShares ≤ 2^64`,
scalar-divisor-only division, self-delegation before snapshot) → security notes (audited OZ base,
module registry with transient ACL grants) → positioning vs TokenOps (composable layer below
distribution tooling, not a competitor). Honest, precise, no marketing fluff in technical sections.

### P5 — Submission collateral (drafts only; user records/publishes)
- `docs/DEMO-SCRIPT.md`: 3-minute real-person video script — 20s problem (cap tables leak),
  100s live walkthrough (issue → disclose w/ proof → pause+distribute → decrypt payout → vote →
  settle), 30s architecture, 30s why-Zama/composability. Timestamped beats.
- `docs/X-THREAD.md`: 8-tweet thread draft, tags @zama, #ZamaDeveloperProgram, no hype-spam.

## Verified technical facts (do NOT re-derive; trust these)

**Toolchain:** solc 0.8.27/cancun; `@fhevm/solidity` 0.11.1; `@openzeppelin/confidential-contracts`
0.5.1 (imports are root-level: `@openzeppelin/confidential-contracts/token/ERC7984/...` — no
`contracts/` segment); `@fhevm/hardhat-plugin` 0.4.2; web: Next 16.2.10, React 19, ethers 6.17,
`@zama-fhe/relayer-sdk` 0.4.4.

**Relayer SDK (web, verified in `web/node_modules/@zama-fhe/relayer-sdk/lib/web.d.ts`):**
- Load pattern (already implemented in `web/lib/fhevm.ts` — reuse, don't duplicate):
  `const sdk = await import("@zama-fhe/relayer-sdk/web"); await sdk.initSDK();`
  `createInstance({ ...sdk.SepoliaConfig, network: eip1193Provider })`.
- `createEncryptedInput(contract, user)` → `.add64(v)` / `.addBool(v)` → `await .encrypt()` →
  `{ handles: Uint8Array[], inputProof: Uint8Array }` (hex-encode before passing to ethers).
- `userDecrypt(pairs, privKey, pubKey, signature, contracts, user, startTs, durationDays)`;
  EIP-712 via `generateKeypair()` + `createEIP712(pubKey, contracts, startTs, durationDays)`;
  strip the `EIP712Domain` key from `types` before `signer.signTypedData`.
- `publicDecrypt(handles)` → `{ clearValues: Record<handle, bigint|boolean|string>, decryptionProof }`
  — `clearValues` is keyed by handle; proof is relayed on-chain to
  `finalizeSupplyDisclosure`/`settle`, where `FHE.checkSignatures` verifies it. Handle ORDER matters
  for multi-handle proofs (settle passes `[forVotes, againstVotes]` in that order).
- Decryption is an async relayer round-trip (seconds on Sepolia) — always show pending UI.

**Contract gotchas:**
- `confidentialBalanceOf`/`confidentialTotalSupply` return `bytes32` handles; the zero handle
  (`0x0…0`, 64 zeros) means "never initialized" — treat as no value.
- ERC-7984 overloads: the ABI strings in `web/lib/contracts.ts` already pick the right overloads
  (`confidentialMint(address,bytes32,bytes)` etc.). Don't add overloaded siblings — ethers v6
  resolves ambiguous overloads badly.
- Voting requires prior self-delegation (`shares.delegate(self)`) BEFORE the resolution snapshot.
- `payBatch` reverts unless shares are paused. Distribution declare pulls mcUSD via operator
  approval (`mcUSD.setOperator(distributor, until)` — uint48 unix timestamp).
- Roles: `isAdmin(addr)` / `isAgent(addr)` on shares (AccessControl underneath).

**Environment quirks:**
- Windows + Git Bash. Formatter hook rewrites saved files (prettier-style). Secret-scanner hook
  blocks `0x`+64hex string literals. Commit hook blocks `master` commits.
- `npx hardhat test` ≈ 30s. `web` build uses Turbopack.

## Division of labor

- **Codex (you):** P1–P5 above, on `feat/charter-core` (or child branches).
- **Reviewer:** reviews every commit, owns Sepolia deploy + Etherscan verify + live e2e,
  VPS deploy to charter.gudman.xyz, final research recheck before submission.
- **User:** funds the burner, records the video, publishes the thread, submits (approval-gated).
