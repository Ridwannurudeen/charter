import {
  BadgeCheck,
  Banknote,
  BookOpen,
  Eye,
  FileCheck,
  GitBranch,
  Landmark,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Vote,
} from "lucide-react";
import Link from "next/link";

import { Logo, ThemeToggle } from "@/components/AppShell";

const FEATURES = [
  {
    title: "Encrypted ownership",
    body: "Every holding is an encrypted ERC-7984 balance. Investors decrypt only their own stake.",
    public: "holder identity",
    private: "share amount",
    icon: LockKeyhole,
    wide: true,
  },
  {
    title: "Verifiable totals",
    body: "Total issued shares are disclosed through the Zama decryption oracle with a KMS proof verified on-chain.",
    public: "aggregate supply",
    private: "individual balances",
    icon: BadgeCheck,
  },
  {
    title: "Confidential dividends",
    body: "Declare a public pool; each investor's pro-rata payout is computed on their encrypted balance.",
    public: "pool size",
    private: "holder payout",
    icon: Banknote,
  },
  {
    title: "Hidden-weight voting",
    body: "Shareholder resolutions reveal only pass or fail. Vote direction and vote weight stay encrypted.",
    public: "final outcome",
    private: "choice and weight",
    icon: Vote,
  },
  {
    title: "Auditor keys",
    body: "Holders can appoint observers with standing decryption access to their positions.",
    public: "observer relation",
    private: "portfolio amount",
    icon: Eye,
  },
  {
    title: "Compliance controls",
    body: "Agent-controlled issuance, transfer restrictions, freezes, pauses, and force transfers for enforcement.",
    public: "policy action",
    private: "encrypted registry",
    icon: ShieldCheck,
  },
  {
    title: "Confidential buyback",
    body: "Tender an encrypted quantity into a public issuer repurchase offer; disclose only aggregate demand at close.",
    public: "price and cap",
    private: "tender quantity",
    icon: Scale,
    wide: true,
  },
];

const LIFECYCLE = [
  ["01", "Issue", "Mint encrypted share allocations to investor wallets."],
  ["02", "Disclose", "Publish the aggregate supply with a KMS proof."],
  ["03", "Distribute", "Run pro-rata dividends over encrypted balances."],
  ["04", "Govern", "Settle resolutions with only pass/fail revealed."],
  ["05", "Buy back", "Tender encrypted quantities into issuer offers."],
];

const LINEAGE = [
  { version: "v1", label: "Encrypted equity", Icon: Landmark },
  { version: "v2", label: "Dividends + governance", Icon: Vote },
  { version: "v3", label: "Confidential buybacks", Icon: GitBranch },
];

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" prefetch={false} className="flex items-center gap-3" aria-label="Charter home">
          <Logo />
          <span className="font-display text-xl font-semibold tracking-[-0.03em]">Charter</span>
        </Link>
        <nav className="flex items-center gap-2">
          <a
            href="https://github.com/Ridwannurudeen/charter"
            target="_blank"
            rel="noreferrer"
            className="hidden h-11 items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-4 text-sm text-muted transition-colors duration-150 hover:border-cipher hover:text-cipher sm:inline-flex"
          >
            <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            GitHub
          </a>
          <ThemeToggle />
          <Link
            href="/investor"
            prefetch={false}
            className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary shadow-[0_14px_40px_-24px_var(--primary)] transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary-bright"
          >
            Launch app
          </Link>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden">
        <section className="mx-auto grid w-full max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pb-24">
          <div>
            <p className="eyebrow mb-5 text-cipher">Confidential ledger - Ethereum Sepolia</p>
            <h1 className="max-w-5xl font-display text-[clamp(3.3rem,8vw,6.6rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-foreground">
              Equity that can prove itself without exposing itself.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">
              Charter puts private-company equity on Ethereum as confidential ERC-7984 tokens. Ownership is enforceable,
              dividends and governance run on-chain, and every position amount stays encrypted.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/investor"
                prefetch={false}
                className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-sm font-semibold text-on-primary shadow-[0_18px_48px_-26px_var(--primary)] transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary-bright"
              >
                Try the live demo
              </Link>
              <a
                href="https://github.com/Ridwannurudeen/charter"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-6 text-sm text-foreground transition-colors duration-150 hover:border-cipher hover:text-cipher"
              >
                <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Read the repo
              </a>
            </div>
          </div>

          <div className="hero-redact-loop rounded-xl border border-line-strong bg-surface-2 p-4 shadow-[var(--shadow-3)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="eyebrow text-faint">Charter Demo Corp</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em]">Common share ledger</h2>
              </div>
              <span className="rounded-full border border-cipher/35 bg-cipher/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-cipher">
                Encrypted
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-line bg-background/45">
              {[
                ["0x8a21...19B4", "500,000"],
                ["0x39c0...E7a2", "300,000"],
                ["0xF116...4c77", "200,000"],
              ].map(([holder, shares]) => (
                <div
                  key={holder}
                  className="grid grid-cols-[1fr_10rem] items-center gap-4 border-b border-line px-4 py-4 last:border-b-0"
                >
                  <div>
                    <p className="font-mono text-sm text-foreground">{holder}</p>
                    <p className="mt-1 text-xs text-muted">CDC-S common shares</p>
                  </div>
                  <div className="relative text-right font-mono text-lg font-semibold tabular">
                    <span className="cipher absolute inset-y-0 right-0 w-32" aria-hidden="true">
                      redacted
                    </span>
                    <span className="redact-value relative">{shares}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["public", "holder registry"],
                ["private", "position amounts"],
                ["proved", "aggregate supply"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-surface px-3 py-3">
                  <p className="eyebrow text-faint">{label}</p>
                  <p className="mt-1 text-sm text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface/55">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            {["Live on Ethereum Sepolia", "Public source", "Built on Zama FHE", "Static judge demo"].map((item) => (
              <span key={item} className="eyebrow text-faint">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div className="pr-4">
            <p className="eyebrow text-cipher">Problem</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-[-0.04em]">
              Public chains leak. Private silos cannot compose.
            </h2>
          </div>
          <div className="grid gap-4 text-base leading-relaxed text-muted">
            <p>
              A traditional cap table gives companies confidentiality but little programmability. A public token gives
              programmability but leaks ownership concentration and shareholder intent.
            </p>
            <p>
              Charter keeps the registry on public infrastructure while turning sensitive quantities into encrypted
              state. The chain can enforce, compute, and verify without publishing another holder&apos;s stake.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-cipher">Lifecycle</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">
                One ledger, five workflows.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              Each module uses the same confidential share balance as the input for issuance, supply disclosure,
              dividends, voting, and buybacks.
            </p>
          </div>
          <ol className="grid gap-4 lg:grid-cols-5">
            {LIFECYCLE.map(([n, title, body]) => (
              <li
                key={n}
                className="relative rounded-lg border border-line bg-surface px-5 py-6 shadow-[var(--shadow-1)]"
              >
                <span className="font-mono text-sm text-cipher">{n}</span>
                <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-line bg-surface/55">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
            <div className="mb-8 max-w-2xl">
              <p className="eyebrow text-cipher">Private / public boundary</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">
                Confidential where it matters. Verifiable where it counts.
              </h2>
            </div>
            <div className="grid auto-rows-fr gap-4 lg:grid-cols-4">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className={`rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-1)] ${
                      feature.wide ? "lg:col-span-2" : ""
                    }`}
                  >
                    <Icon className="h-5 w-5 text-cipher" strokeWidth={1.75} aria-hidden="true" />
                    <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em]">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{feature.body}</p>
                    <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-line bg-background/45 p-3">
                        <p className="eyebrow text-faint">Public</p>
                        <p className="mt-1 text-foreground">{feature.public}</p>
                      </div>
                      <div className="rounded-md border border-cipher/25 bg-cipher/5 p-3">
                        <p className="eyebrow text-cipher">Private</p>
                        <p className="mt-1 text-foreground">{feature.private}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
          <div className="rounded-xl border border-line-strong bg-surface-2 p-6 shadow-[var(--shadow-2)] sm:p-8 lg:p-10">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
              <div>
                <p className="eyebrow text-cipher">Composable privacy</p>
                <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-[-0.04em]">
                  The same confidential balance powers every module.
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {LINEAGE.map(({ version, label, Icon }) => (
                  <div key={version} className="rounded-lg border border-line bg-background/45 p-5">
                    <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
                    <p className="eyebrow mt-5 text-faint">{version}</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
          <div className="grid gap-6 rounded-xl border border-line-strong bg-surface-2 p-6 shadow-[var(--shadow-2)] sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="eyebrow text-cipher">Live demo</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Start as a shareholder.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                Claim demo shares, decrypt your position, cast an encrypted vote, and settle the outcome with a public
                proof.
              </p>
            </div>
            <Link
              href="/investor"
              prefetch={false}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-on-primary transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary-bright"
            >
              <FileCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Open investor portal
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-faint sm:px-6">
          <span>Charter - confidential equity on Ethereum Sepolia</span>
          <a
            href="https://github.com/Ridwannurudeen/charter"
            target="_blank"
            rel="noreferrer"
            className="text-muted underline-offset-2 hover:text-cipher hover:underline"
          >
            GitHub
          </a>
          <span>
            Powered by the{" "}
            <a
              href="https://www.zama.org"
              target="_blank"
              rel="noreferrer"
              className="text-muted underline-offset-2 hover:text-cipher hover:underline"
            >
              Zama Protocol
            </a>{" "}
            (FHE)
          </span>
        </div>
      </footer>
    </div>
  );
}
