# Charter — Agent Working Conventions

Confidential cap-table dApp for the **Zama Developer Program Season 3 Builder Track**.
Deadline: **July 7, 2026, 23:59 AoE**. Target: 1st place. Read `HANDOFF.md` for the full,
ordered execution scope — work it top to bottom, nothing skipped, nothing added.

## Hard rules

1. **Branch discipline.** Never commit to `master` — a pre-commit hook blocks it. Work on `feat/*` branches (current: `feat/charter-core`). One focused commit per unit of work.
2. **Verify before you code.** Every SDK/library claim in `HANDOFF.md` was verified against installed sources. If you need an API not listed there, read it from `node_modules` first — do not trust training data. The FHEVM/relayer-sdk APIs changed heavily in 2026.
3. **Tests are the gate.** `npx hardhat test` must stay 20/20 green. Frontend: `npm run build` in `web/` must pass. Run both before every commit that touches the respective area.
4. **Do not modify the contracts** (`contracts/*.sol`) or tests without flagging it as a question first — they are final, audited-pattern code, and the Sepolia deployment will match them.
5. **No secrets in code.** A hook blocks `0x`+64-hex literals (pattern-matches private keys). For the zero handle use `("0x" + "0".repeat(64))`. Deployer mnemonic lives in hardhat vars, never in files.
6. **No AI attribution anywhere.** No Claude/Codex/Anthropic/OpenAI mentions in code, commits, or docs.
7. **A formatter hook rewrites files after every save.** If an edit fails to apply, re-read the file first.

## Layout

- `contracts/` — 4 Solidity contracts (done, frozen). `test/Charter.ts` — 20 tests (done).
- `deploy/deploy.ts` — hardhat-deploy script (done, frozen). You RUN the Sepolia deployment per HANDOFF §7 (funded deployer in hardhat vars) — but never edit the script itself.
- `web/` — Next.js 16 App Router + Tailwind v4, **static export** (`output: 'export'`). Your main workspace.
  - `web/lib/contracts.ts` — addresses (NEXT_PUBLIC_* env) + human-readable ABIs (verified against contracts).
  - `web/lib/fhevm.ts` — relayer-sdk singleton: encrypt inputs, EIP-712 userDecrypt, publicDecrypt. Client-only (WASM) — keep all SDK imports dynamic.
  - `web/lib/wallet.tsx` — wallet context (MetaMask, Sepolia guard, role detection, Contract instances).
  - `web/components/` — ui.tsx primitives, EncryptedValue.tsx (decrypt-reveal), AppShell.tsx (nav/gate).
  - `web/app/` — `/` landing, `/issuer`, `/investor`, `/governance` pages.

## Design system (do not drift)

Dark institutional fintech. Tokens in `web/app/globals.css` (Tailwind v4 `@theme`): background `#090e1a`, surface `#0f1626`, primary amber `#f5b40b` (Zama-adjacent), Geist Sans/Mono. Monospace + `tabular-nums` for all numbers. Encrypted values render as shimmering ciphertext (`.cipher`) until decrypted (`.reveal-in`). No emojis as icons — inline SVG only. No purple/pink AI gradients. WCAG AA contrast. `cursor-pointer` + visible focus states on all interactive elements. Respect `prefers-reduced-motion`.
