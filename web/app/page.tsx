import {
  ArrowRight,
  Banknote,
  BookOpen,
  CheckCircle2,
  FileCheck,
  GitBranch,
  Landmark,
  LockKeyhole,
  Route,
  ShieldCheck,
  Vote,
} from "lucide-react";
import Link from "next/link";

import { Logo, ThemeToggle } from "@/components/AppShell";

const PROOF = [
  ["active distributor", "0xd856...B3b4", "guarded claim path"],
  ["test suite", "70 passing", "FHEVM mock coverage"],
  ["claim proof", "0x6d77...4ed4", "Sepolia transaction"],
  ["batch guard", "13 -> named revert", "DistributorBatchTooLarge"],
] as const;

const STEPS = [
  ["01", "Issue", "Mint encrypted ERC-7984 share allocations to investor wallets."],
  ["02", "Disclose", "Publish aggregate supply with a KMS proof, not holder balances."],
  ["03", "Distribute", "Declare a public pool; holders pull private pro-rata payouts."],
  ["04", "Govern", "Cast encrypted votes and reveal only the pass/fail outcome."],
  ["05", "Extend", "Plug vesting, buybacks, gated issuance, and enforcement into one ledger."],
] as const;

const MODULES = [
  ["DividendDistributor", "claim-based confidential payouts", Banknote],
  ["CharterResolutionsV3", "shareholder proposals and hidden-weight voting", Vote],
  ["ConfidentialTenderOffer", "private-size issuer buybacks", GitBranch],
  ["VestingSchedule", "cliff-and-linear encrypted grants", Route],
  ["GatedIssuance", "default-deny accredited issuance", ShieldCheck],
  ["ForceTransferGuardian", "quorum and timelocked enforcement", Landmark],
] as const;

const ROLES = [
  ["/investor", "Investor", "Decrypt your position, claim payouts, vote privately."],
  ["/issuer", "Issuer", "Issue shares, disclose supply, declare record-date distributions."],
  ["/governance", "Governance", "Open proposals, vote, and settle outcomes with proofs."],
  ["/auditor", "Auditor", "Inspect only balances a holder explicitly grants to you."],
] as const;

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-hidden">
      <header className="sticky top-0 z-50 border-b border-line bg-background/86 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" prefetch={false} className="flex items-center gap-3" aria-label="Charter home">
            <Logo />
            <span className="font-display text-xl font-semibold tracking-[-0.04em]">Charter</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted lg:flex" aria-label="Public">
            <a className="transition-colors hover:text-foreground" href="#product">
              Product
            </a>
            <a className="transition-colors hover:text-foreground" href="#proof">
              Proof
            </a>
            <a className="transition-colors hover:text-foreground" href="#modules">
              Modules
            </a>
            <a className="transition-colors hover:text-foreground" href="#roles">
              Roles
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Ridwannurudeen/charter"
              target="_blank"
              rel="noreferrer"
              className="hidden h-10 items-center gap-2 rounded-md border border-line bg-surface-2 px-3 text-sm text-muted transition-colors hover:border-cipher hover:text-cipher sm:inline-flex"
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Docs
            </a>
            <ThemeToggle />
            <Link
              href="/app"
              prefetch={false}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary-bright"
            >
              Launch app
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section id="product" className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:pb-28">
          <div>
            <p className="eyebrow text-cipher">Confidential equity registry - Ethereum Sepolia</p>
            <h1 className="mt-5 max-w-5xl font-display text-[clamp(3.8rem,9vw,7.8rem)] font-semibold leading-[0.86] tracking-[-0.07em] text-foreground">
              The ledger can prove the company without exposing the cap table.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">
              Charter is the confidential equity-registry primitive beneath a real cap-table product: encrypted
              ERC-7984 shares, proof-backed aggregate disclosure, private dividends, hidden-weight governance, and
              swappable modules on one live share token.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/app"
                prefetch={false}
                className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-on-primary shadow-[0_22px_58px_-30px_var(--primary)] transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary-bright"
              >
                Launch live demo
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <a
                href="https://github.com/Ridwannurudeen/charter/blob/main/docs/E2E-RUN.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-6 text-sm font-semibold text-foreground transition-colors hover:border-cipher hover:text-cipher"
              >
                Read proof run
                <FileCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_50%_20%,color-mix(in_srgb,var(--cipher)_22%,transparent),transparent_62%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-xl border border-line-strong bg-surface-2 shadow-[var(--shadow-3)]">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div>
                  <p className="eyebrow text-faint">Charter Demo Corp</p>
                  <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">
                    Confidential share ledger
                  </h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-cipher/35 bg-cipher/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-cipher">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cipher opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cipher" />
                  </span>
                  live
                </span>
              </div>
              <div className="grid gap-px bg-line">
                {[
                  ["0x0404...640D", "issuer", "500,000"],
                  ["0x5104...1e6C", "holder", "300,000"],
                  ["0x697B...B7Dc", "holder", "200,000"],
                ].map(([holder, role, shares], index) => (
                  <div key={holder} className="grid grid-cols-[1fr_9rem] items-center gap-4 bg-surface-2 px-5 py-5">
                    <div>
                      <p className="font-mono text-sm text-foreground">{holder}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-faint">{role}</p>
                    </div>
                    <div className="relative text-right">
                      <span className="cipher ml-auto h-6 w-32 justify-end font-mono text-sm" aria-label="encrypted shares">
                        encrypted
                      </span>
                      <span
                        className="redact-value absolute inset-0 flex items-center justify-end font-mono text-xl font-semibold tabular text-foreground"
                        style={{ animationDelay: `${index * 260}ms` }}
                      >
                        {shares}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-px bg-line sm:grid-cols-3">
                {[
                  ["public", "holder addresses"],
                  ["private", "share amounts"],
                  ["proven", "1,034,800 total"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-background/45 px-5 py-4">
                    <p className="eyebrow text-faint">{label}</p>
                    <p className="mt-2 text-sm text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="proof" className="border-y border-line bg-ink-panel">
          <div className="mx-auto grid w-full max-w-7xl gap-px bg-line px-4 py-12 sm:px-6 lg:grid-cols-4">
            {PROOF.map(([label, value, detail]) => (
              <div key={label} className="bg-background px-5 py-6">
                <p className="eyebrow text-faint">{label}</p>
                <p className="mt-3 font-mono text-2xl font-semibold tracking-[-0.04em] text-foreground tabular">
                  {value}
                </p>
                <p className="mt-2 text-sm text-muted">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow text-cipher">Why this exists</p>
            <h2 className="mt-4 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.055em]">
              Public tokens leak. Private ledgers do not compose.
            </h2>
          </div>
          <div className="grid gap-5 text-base leading-relaxed text-muted">
            <p>
              A private-company cap table needs confidentiality, but it also needs enforceable payouts, voting,
              lifecycle state, and auditability. Public ERC-20-style ownership leaks the economics of every holder.
            </p>
            <p>
              Charter keeps the registry on Ethereum while encrypting quantities. The public chain sees addresses,
              timing, and proof-backed aggregate state. It does not see individual holdings, payouts, tender sizes, or
              vote weights.
            </p>
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <Boundary label="Public" value="identity, timing, aggregate proof" />
              <Boundary label="Private" value="amounts, payouts, vote weight" accent />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-cipher">Workflow</p>
              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.055em]">
                One ledger. Five proof paths.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              The app should not feel like eight unrelated demos. Every workflow is a module around the same encrypted
              `CharterShares` balance.
            </p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-5">
            {STEPS.map(([number, title, body]) => (
              <li key={number} className="min-h-64 bg-surface-2 p-6">
                <span className="font-mono text-sm text-cipher">{number}</span>
                <h3 className="mt-12 font-display text-3xl font-semibold tracking-[-0.045em]">{title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="modules" className="border-y border-line bg-surface/55">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow text-cipher">Module architecture</p>
              <h2 className="mt-4 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.055em]">
                The share token stays still. The registry evolves around it.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted">
                The live deployment has already rotated governance modules and dividend distributors without migrating
                holdings. That is the composability story: behavior changes beneath one confidential ledger.
              </p>
            </div>
            <div className="rounded-xl border border-line-strong bg-background p-4 shadow-[var(--shadow-2)]">
              <div className="rounded-lg border border-cipher/35 bg-cipher/10 p-6 text-center">
                <LockKeyhole className="mx-auto h-6 w-6 text-cipher" strokeWidth={1.75} aria-hidden="true" />
                <p className="eyebrow mt-4 text-cipher">Core ledger</p>
                <h3 className="mt-2 font-display text-3xl font-semibold tracking-[-0.045em]">CharterShares</h3>
                <p className="mt-3 text-sm text-muted">Encrypted ERC-7984 ownership and module ACL.</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {MODULES.map(([name, body, Icon]) => (
                  <div key={name} className="rounded-lg border border-line bg-surface-2 p-4">
                    <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
                    <p className="mt-4 font-mono text-sm text-foreground">{name}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid gap-6 rounded-xl border border-line-strong bg-surface-2 p-6 shadow-[var(--shadow-2)] lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
            <div>
              <p className="eyebrow text-cipher">Scope discipline</p>
              <h2 className="mt-4 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.055em]">
                Honest boundaries make the product stronger.
              </h2>
            </div>
            <div className="grid gap-3">
              {[
                "Charter hides quantities, not identities.",
                "It is a confidential equity-registry primitive, not a full Carta replacement.",
                "The demo uses Sepolia and mock mcUSD; it is not a securities offering.",
                "The active distributor is deployed and exercised live; source verification is still pending due explorer outages.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-line bg-background/45 p-4 text-sm text-muted">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cipher" strokeWidth={1.75} aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="roles" className="mx-auto w-full max-w-7xl px-4 pb-28 sm:px-6">
          <div className="mb-8">
            <p className="eyebrow text-cipher">Enter by role</p>
            <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.055em]">
              Launch the app after the story is clear.
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {ROLES.map(([href, title, body]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="group min-h-56 rounded-xl border border-line bg-surface-2 p-6 shadow-[var(--shadow-1)] transition-[border-color,transform] duration-200 hover:-translate-y-1 hover:border-cipher"
              >
                <p className="eyebrow text-faint">workspace</p>
                <h3 className="mt-10 font-display text-3xl font-semibold tracking-[-0.045em]">{title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted">{body}</p>
                <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cipher">
                  Open route
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-7">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-faint sm:px-6">
          <span>Charter - confidential equity-registry primitive on Ethereum Sepolia</span>
          <span className="font-mono">amount privacy, not identity privacy</span>
          <a href="https://github.com/Ridwannurudeen/charter" target="_blank" rel="noreferrer" className="text-muted hover:text-cipher">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function Boundary({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? "border-cipher/30 bg-cipher/5" : "border-line bg-surface-2"}`}>
      <p className={`eyebrow ${accent ? "text-cipher" : "text-faint"}`}>{label}</p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}
