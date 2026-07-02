# Charter — Execution Handoff (Codex)

Read `AGENTS.md` first (hard rules). This document is the **complete, ordered scope** of what you
build. Work top to bottom; do not skip items; do not add scope. Every technical claim below was
verified against installed sources on 2026-07-02 — trust it over training data. When done with an
item, tick its checklist in your commit message body. **All work will be reviewed commit-by-commit;
anything outside scope or violating a gate gets reverted.**

Deadline context: Zama Developer Program S3 Builder Track, **July 7, 2026, 23:59 AoE**.
Judged on: working Sepolia demo, frontend quality/UX, docs, video, X thread. We are going for 1st.

---

## 0. Ground truth (state at handoff — verify, don't assume)

- Branch: `feat/charter-core` @ `1b26f6e` + this handoff commit. A hook **blocks commits to
  `master`** — stay on `feat/charter-core` or child branches merged back into it.
- Contracts `contracts/{CharterShares,DividendDistributor,CharterResolutions,MockConfidentialUSD}.sol`
  — **FROZEN. Do not edit.** 20/20 tests green: `npx hardhat test` (~30s).
- Frontend `web/` — GREEN baseline: `npm run build` (webpack, ~35-70s), `npx eslint .`,
  `npx tsc --noEmit` all pass; routes `/`, `/issuer`, `/investor`, `/governance` prerender to
  `out/<route>/index.html` (static export, `trailingSlash: true`).
- **GOTCHA (do not undo):** Next 16's default Turbopack build **hangs forever** on the
  relayer-sdk WASM graph. `web/package.json` pins `"build": "next build --webpack"`. Keep it.
  Webpack's "Circular dependency between chunks" warning is benign — ignore.
- tsconfig target is ES2020 (BigInt literals). React 19's `react-hooks/set-state-in-effect` rule
  is scoped-disabled on the three fetch-on-mount effects — copy that exact pattern for new pages.
- Sepolia is NOT deployed yet (reviewer owns deployment; burner awaits funding). All frontend
  work must run address-agnostic off `NEXT_PUBLIC_*` env (see `web/lib/contracts.ts`); with zero
  addresses the pages show their error callouts — that's expected until deploy.
- Environment: Windows + Git Bash. A **formatter hook rewrites files on save** (if an edit fails
  to apply, re-read the file). A **secret-scanner hook blocks `0x`+64-hex literals** — build the
  zero handle as `("0x" + "0".repeat(64))` (see `ZERO_HANDLE`). **Never** put keys/mnemonics in
  files. **No AI attribution** in code, commits, or docs. No emoji icons — inline SVG only.

### Verified API surface you'll need (do not re-derive)

**Frontend SDK (`web/lib/fhevm.ts` — REUSE these helpers, never import the SDK directly):**
- `encryptU64(eip1193, contractAddr, userAddr, bigint)` → `{ handle, inputProof }` (hex strings)
- `encryptBool(...)` same shape
- `userDecrypt(eip1193, signer, userAddr, pairs: {handle, contractAddress}[])` →
  `Record<handle, bigint|boolean|string>` — EIP-712 session cached in sessionStorage (1 day)
- `publicDecrypt(eip1193, handles: string[])` → `{ clearValues: Record<handle, ...>, decryptionProof }`
  — proof gets relayed on-chain (`finalizeSupplyDisclosure` / `settle`); **handle order matters**
- All decryption is an async relayer round-trip (seconds on Sepolia) — always show busy state.

**Contracts (ABIs in `web/lib/contracts.ts` — every call verified against Solidity source):**
- `shares.observer(account) → address` (zero = none); observer gets standing ACL on that
  account's SHARE balance handle → `userDecrypt` works for the observer on shares handles.
- **`MockConfidentialUSD` has NO observer mechanism** (verified: zero matches for
  observer/ObserverAccess in the source). The auditor page is **shares-only**. Do not invent calls.
- `confidentialBalanceOf(addr) → bytes32` handle; `ZERO_HANDLE` (0x0…0) = uninitialized.
- Roles: `shares.isAdmin(addr)`, `shares.isAgent(addr)`. Voting needs prior self-delegation.
- `payBatch` requires `shares.paused()` (pause = record date). Distribution declare pulls mcUSD
  via `mcUSD.setOperator(distributor, until /* uint48 unix ts */)`.

**Hardhat mock/testnet FHE API (for the scenario task, verified in `test/Charter.ts`):**
- `fhevm.createEncryptedInput(contractAddr, senderAddr).add64(n).encrypt()` →
  `{ handles: Uint8Array[], inputProof: Uint8Array }`; `.addBool(b)` likewise.
- `fhevm.userDecryptEuint(FhevmType.euint64, handle, contractAddr, signer)` → bigint.
- `fhevm.publicDecrypt([handle, ...])` → `{ clearValues, decryptionProof }`.
- Overloaded functions need bracket syntax from ethers:
  `shares["confidentialMint(address,bytes32,bytes)"](to, handle, proof)`.

---

## 1. `/auditor` page — NEW (the missing third surface)

**Why:** investors can appoint an observer in the Investor Portal, but the observer has no page to
exercise that access. Judges will look for the compliance story to close end-to-end.

Build `web/app/auditor/page.tsx`, following the exact structure of the existing pages
(`"use client"`, `AppShell` → `ConnectGate` → content component, `Card`/`Field`/`Input`/`Button`/
`Callout` primitives, `run(label, fn)` error/notice pattern).

Requirements:
1. Header block: title "Auditor view", one-line explainer ("Holders appoint you as observer;
   you decrypt exactly what they granted — their share positions. Nothing else, nobody else.").
2. An "Inspect account" form: address input → on submit:
   - `shares.observer(account)` — if ≠ connected wallet, show a clear callout ("This account has
     not appointed you as observer") and do NOT attempt decryption.
   - If it matches: render the account's share balance via `<EncryptedValue handle={...}
     contractAddress={ADDRESSES.shares} suffix="shares" label="Decrypt as observer" />`
     (the existing component works unchanged — observer ACL makes `userDecrypt` succeed).
3. A "Portfolio" list persisted in `localStorage` (key `charter.auditor.accounts`): every
   successfully-verified account gets added (dedup, checksummed via ethers `getAddress`);
   each row shows short address + observer-verified badge + its `EncryptedValue`; a remove (×)
   button per row. Guard all `localStorage` access for SSR safety (client component, but read
   inside `useEffect`/handlers, not at module scope).
4. Empty state: guidance text telling the auditor how holders appoint them (Investor Portal →
   Auditor access).
5. Add `{ href: "/auditor", label: "Auditor" }` to `TABS` in `web/components/AppShell.tsx`
   (appears in both desktop and mobile nav automatically).
6. Landing page: add a fourth step or mention of the auditor surface ONLY if it fits the existing
   grid cleanly; otherwise leave the landing alone.

Acceptance: build+lint+tsc green; `/auditor/index.html` present in `out/`; page behaves sanely
with zero addresses (error callout, no crash); no new deps.

## 2. Deploy glue — addresses → frontend env (so deploy day is one command)

`deploy/deploy.ts` only console-logs addresses. Close the gap:

1. Write `scripts/export-addresses.ts` (repo root `scripts/`, plain ts-node compatible — the
   hardhat toolchain already ships `ts-node`): reads `deployments/sepolia/*.json`
   (hardhat-deploy artifact format: `{ address: "0x..." }` per contract JSON: `CharterShares.json`,
   `MockConfidentialUSD.json`, `DividendDistributor.json`, `CharterResolutions.json`) and writes
   `web/.env.local`:
   ```
   NEXT_PUBLIC_SHARES_ADDRESS=0x…
   NEXT_PUBLIC_MCUSD_ADDRESS=0x…
   NEXT_PUBLIC_DISTRIBUTOR_ADDRESS=0x…
   NEXT_PUBLIC_RESOLUTIONS_ADDRESS=0x…
   ```
   Fail loudly (nonzero exit, clear message) if any artifact is missing. Add npm script
   `"export:addresses": "ts-node scripts/export-addresses.ts"` to the ROOT package.json.
   Note: `web/.env.local` is gitignored (`web/.gitignore`) — correct; never commit it.
2. Do NOT run deployments yourself. Reviewer runs: fund → `npm run deploy:sepolia` →
   `npm run export:addresses` → web rebuild.

Acceptance: script runs against a fake `deployments/sepolia/` fixture you create temporarily and
delete before committing (verify both success and missing-artifact paths by hand; no test files).

## 3. Demo scenario task — one command per lifecycle step (for the live demo + video)

Create `tasks/scenario.ts` (registered in `hardhat.config.ts` via `import "./tasks/scenario";`
next to the existing `./tasks/accounts` import). Hardhat tasks, all with `--network sepolia`
compatibility AND mock-network compatibility (same `fhevm` API — verified above). Use
`hre.deployments.get("CharterShares")` etc. for addresses, `hre.ethers.getSigners()` for the
deployer (it is admin+agent per deploy script).

Tasks (names exact):
- `scenario:issue --to 0x… --amount 500000` — encrypted mint to an investor.
- `scenario:disclose` — request supply disclosure, `fhevm.publicDecrypt` the total-supply handle,
  `finalizeSupplyDisclosure(clear, proof)`, print the disclosed total.
- `scenario:fund --amount 10000` — mcUSD `mint(deployer, amount*1e6)` + `setOperator(distributor,
  now+86400)`.
- `scenario:declare --pool 10000` — `distributor.declare(mcUSD, pool*1e6)`, print distribution id.
- `scenario:pay --id 0 --investors 0x…,0x…` — `shares.pause()` if not paused → `payBatch` →
  `shares.unpause()`. Print per-step tx hashes.
- `scenario:propose --text "…" --blocks 300` — propose, print resolution id.
- `scenario:vote --id 0 --support true` — encrypted bool vote from the deployer signer (or
  `--signer N` index param to vote from other configured accounts).
- `scenario:settle --id 0` — requestTally if needed → publicDecrypt both tally handles **in
  [forVotes, againstVotes] order** → `settle`, print outcome.
- `scenario:status` — read-only dashboard: totalSharesOnRecord, paused, distributionCount,
  resolutionCount + per-resolution state. No decryption.

Every task: try/catch with a clean one-line error (no stack spam), print tx hashes. Keep each task
under ~40 lines; share a small helper for getting contracts. **Test each task on the local mock**
(`npx hardhat scenario:issue --network hardhat …` after `hardhat deploy` — hardhat-deploy runs on
the in-process network with `--network hardhat` via the fixture; if wiring the mock proves flaky,
verifying the full chain through `npx hardhat test` + careful code review is acceptable, but say
so explicitly in the commit message).

Acceptance: `npx hardhat test` still 20/20; `npx hardhat --help` lists all scenario tasks;
lint clean (`npm run lint` at root covers tasks/).

## 4. UX polish pass (judged criterion — be surgical, not decorative)

Touch ONLY `web/`. Design tokens are law (`AGENTS.md`). Items:

1. **Unconfigured-contracts banner:** when `ADDRESSES.shares` is the zero address, show one
   dismissable banner (not four error callouts) at the top of each app page: "Contracts not yet
   deployed — this is a UI preview. See README for the live deployment." Implement once (e.g.
   small component in `components/`), reuse on all four app pages.
2. **Loading skeletons:** while handles/rows are being fetched (`refresh()` in flight), show
   skeleton rows (pulse-animated `bg-raised` blocks — add a `.skeleton` utility in globals.css
   respecting `prefers-reduced-motion`) instead of empty content. Issuer distribution history,
   governance resolution list, investor card values.
3. **Explainer strips:** one-line FHE explainer under each page title (investor page already has
   one — match its tone): issuer ("Allocations are encrypted in your browser; the chain computes
   on ciphertext"), governance ("Your vote and its weight stay encrypted; only totals are ever
   revealed"), auditor (per §1).
4. **Mobile check at 375px:** no horizontal scroll on any page; the header wallet chip truncates
   (it already uses `shortAddress`); Stat row on issuer wraps (`flex-wrap`). Fix what's broken,
   list what you fixed in the commit message.
5. **Copy-to-clipboard** on the connected-address chip in `AppShell` (small SVG button, 44px hit
   area, brief "Copied" state).
6. **Landing GitHub link:** `web/app/page.tsx` — there is NO GitHub link currently in the landing
   header (verify). Add one pointing to `https://github.com/gudmanii/charter` styled like a ghost
   nav item ONLY IF the repo is public by then; otherwise skip and note it in `docs/LAUNCH-CHECKLIST.md`
   (create it — a 10-line list of "things to flip at submission time": repo public, GitHub link,
   README addresses table, X thread URL in submission form).
7. **Page metadata:** per-route `<title>` via layout/`metadata` export where the pattern allows
   (client pages can't export `metadata` — if a clean per-route title needs a layout file per
   route, add minimal `layout.tsx` files; otherwise leave the single root title. Do not convert
   pages to server components for this.)

Acceptance: build+lint+tsc green; screenshots not required (reviewer will drive the UI).

## 5. Root `README.md` — full rewrite (currently the stock template file)

Replace `README.md` (root) entirely. Also replace `web/README.md` stock content with 5 lines
pointing at the root README + `cd web && npm i && npm run dev`.

Root README structure (institutional tone, zero hype in technical sections):
1. **Hero:** one paragraph — what Charter is, the one-liner: "verifiable totals, hidden
   individuals". Badge-free.
2. **Why (the problem):** cap tables on public chains leak everything; TradFi cap tables are
   enforceable but opaque silos. 4-6 sentences max.
3. **Architecture:** ASCII diagram of the four contracts + relayer/KMS proof loop + frontend
   surfaces. Show the two decryption paths (EIP-712 user decryption vs public disclosure with
   on-chain `FHE.checkSignatures`).
4. **The four flows, precisely:** issuance (encrypted mint), supply disclosure (request →
   relayer publicDecrypt → finalize with proof), distributions (pause-as-record-date, batch ~15,
   `encBalance × pool / totalSharesOnRecord`, scalar-divisor-only division), resolutions
   (self-delegate → snapshot → encrypted ebool × getPastVotes weight → settle with proof),
   observer/auditor access.
5. **Design decisions & constraints (honesty section):** HCU budget → batching; `pool ×
   totalShares ≤ 2^64` guard; shares are 0-decimals whole units; total shares deliberately public
   (matches real cap tables — count public, distribution private); pause-as-record-date tradeoff
   and the checkpoint-based alternative as future work; trusted-module registry with transient
   ACL grants.
6. **Security posture:** built on OpenZeppelin `confidential-contracts` v0.5.1 (audited) —
   `ERC7984Rwa` + `ERC7984Votes` + `ERC7984ObserverAccess`; what we wrote on top vs inherited.
7. **Getting started:** clone → `npm i` → `npx hardhat test` (20 tests) → `cd web && npm i &&
   npm run dev`. Scenario tasks table (from §3).
8. **Deployed contracts (Sepolia):** markdown table with `_(pending deployment)_` placeholders
   the reviewer fills: contract / address / Etherscan link.
9. **Ecosystem positioning:** ERC-7984-native → composes with Zama's confidential-token rails;
   TokenOps-adjacent (registry layer below distribution tooling, not a competitor). 3-4 sentences.
10. **Program footer:** built for Zama Developer Program Season 3 (Builder Track), link
    https://www.zama.org/programs/developer-program.

Acceptance: accurate to the code (every function name/flow you mention must exist — grep before
writing), no placeholder text except the addresses table, renders clean on GitHub.

## 6. Submission collateral drafts (`docs/`)

1. `docs/DEMO-SCRIPT.md` — 3-minute REAL-PERSON video script (the human presents; AI voice/video
   is disqualified — script is for the human to read). Timestamped beats:
   - 0:00-0:20 problem (cap tables leak; private equity can't go on-chain without privacy)
   - 0:20-2:00 live walkthrough: issuer mints (show encrypted handle on Etherscan) → disclose
     supply with proof → declare + pay distribution under pause → investor decrypts stake+payout
     (the reveal moment — linger on it) → auditor page decrypt → propose/vote/settle resolution
   - 2:00-2:30 architecture slide (README diagram)
   - 2:30-3:00 why Zama/composability + program close
   Include a "recording checklist" (wallets pre-funded, two browser profiles: issuer+investor,
   auditor appointed beforehand, resolution pre-created so settle is demoable in-window).
2. `docs/X-THREAD.md` — 8-tweet draft. Tweet 1 hooks with the one-liner + site link;
   middle tweets: one flow each with a concrete detail (e.g. the pause-as-record-date trick,
   the KMS proof verified on-chain); tweet 7 stack credits (@zama, OpenZeppelin confidential
   contracts, ERC-7984); tweet 8 links: site, repo, video, #ZamaDeveloperProgram tag. No
   hashtag spam beyond the required one, no rocket-ship hype tone.
3. `docs/LAUNCH-CHECKLIST.md` (per §4.6).

## 7. Final gate before you declare done

Run and paste results into the final commit message body:
- `npx hardhat test` → 20 passing
- `npx hardhat --help | grep scenario` → 9 tasks
- `cd web && npx tsc --noEmit && npx eslint .` → clean
- `cd web && npm run build` → exit 0, `out/` contains `index.html` for all 5 routes (`/`,
  `/issuer`, `/investor`, `/governance`, `/auditor`)
- `git log --oneline master..HEAD` — every commit message describes real, reviewable work

## Out of scope — do NOT touch
- `contracts/*.sol`, `test/Charter.ts`, `deploy/deploy.ts` (frozen; flag questions instead)
- Actual Sepolia deployment, Etherscan verification, VPS/nginx (reviewer-owned)
- Recording video, posting the thread, submitting (user-owned, approval-gated)
- No new frontend dependencies without flagging first; no UI framework/library additions
- `web/CLAUDE.md`, `web/AGENTS.md` (scaffold notices — leave as-is)
