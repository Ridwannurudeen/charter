import Link from "next/link";

import { Logo } from "@/components/AppShell";

const FEATURES = [
  {
    title: "Encrypted ownership",
    body: "Every holding is an encrypted ERC-7984 balance. Investors decrypt only their own stake. Competitors and the public see nothing. Transfer counterparties learn only the amount of their own transfer.",
  },
  {
    title: "Verifiable totals",
    body: "Total issued shares are disclosed through the Zama decryption oracle with a KMS proof verified on-chain. The aggregate is public and provable; individual balances stay private.",
  },
  {
    title: "Dividend waterfalls on ciphertext",
    body: "Declare a public pool; each investor's pro-rata payout is computed on their encrypted balance and paid in a confidential stablecoin. Nobody learns another holder's cut.",
  },
  {
    title: "Hidden-weight voting",
    body: "Shareholder resolutions where both the direction and the weight of every vote stay encrypted. Only the final pass/fail outcome is revealed with a cryptographic proof.",
  },
  {
    title: "Auditor view keys",
    body: "Any holder can appoint an observer - an auditor or regulator - who gains standing decryption access to their positions. Privacy with accountability, not instead of it.",
  },
  {
    title: "Compliance-grade controls",
    body: "Agent-controlled issuance, transfer restrictions, freezes, pauses, and agent-controlled force transfers for legal enforcement, built on OpenZeppelin confidential contracts.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Issue",
    body: "The company mints encrypted share allocations to investor wallets. Amounts never appear on-chain in clear.",
  },
  {
    n: "02",
    title: "Disclose",
    body: "Total supply is disclosed with a KMS proof - the public, verifiable denominator for everything that follows.",
  },
  {
    n: "03",
    title: "Distribute",
    body: "Dividends flow pro-rata over encrypted balances. Each investor decrypts their own payout, and only theirs.",
  },
  {
    n: "04",
    title: "Govern",
    body: "Resolutions pass or fail on encrypted vote weights, settled on-chain with proof and without revealing exact totals.",
  },
];

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-bold tracking-tight">Charter</span>
        </div>
        <nav className="flex items-center gap-2">
          <a
            href="https://github.com/Ridwannurudeen/charter"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm text-muted transition-colors duration-150 hover:border-primary hover:text-primary-bright"
          >
            GitHub
          </a>
          <Link
            href="/investor"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-bright"
          >
            Launch app
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary-bright">
            Built on the Zama Protocol - Ethereum Sepolia
          </p>
          <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            The cap table,
            <br />
            on-chain. <span className="text-primary">Nobody</span>
            <br />
            sees how much anyone owns.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Charter puts private-company equity on Ethereum as confidential tokens. Ownership is enforceable,
            distributions are computed pro-rata on ciphertext, votes settle with on-chain proofs, and every position
            amount stays encrypted with fully homomorphic encryption. The registry is public infrastructure; the
            register is not public data.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/issuer"
              className="inline-flex h-12 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-bright"
            >
              Open the issuer console
            </Link>
            <Link
              href="/investor"
              className="inline-flex h-12 items-center rounded-lg border border-line-strong px-6 text-sm text-foreground transition-colors duration-150 hover:border-primary hover:text-primary-bright"
            >
              I&apos;m a shareholder
            </Link>
          </div>
        </section>

        <section className="border-y border-line bg-surface/60">
          <div className="mx-auto grid w-full max-w-6xl gap-px overflow-hidden px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-5">
                <h3 className="text-sm font-semibold text-primary-bright">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-line bg-surface p-5">
                <div className="font-mono text-sm text-primary">{s.n}</div>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
          <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-8 sm:p-12">
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              Composable privacy for the whole equity lifecycle.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Charter shares are standard ERC-7984 confidential tokens. They move on the same rails as confidential
              stablecoins, can plug into the Zama wrapper ecosystem, and are built on the same ERC-7984 rails used
              across the confidential-token ecosystem. One registry, every workflow: issuance, distributions,
              governance, audit.
            </p>
            <Link
              href="/investor"
              className="mt-6 inline-flex h-12 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-bright"
            >
              Launch app
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-faint sm:px-6">
          <span>Charter - confidential equity on Ethereum Sepolia</span>
          <a
            href="https://github.com/Ridwannurudeen/charter"
            target="_blank"
            rel="noreferrer"
            className="text-muted underline-offset-2 hover:text-primary-bright hover:underline"
          >
            GitHub
          </a>
          <span>
            Powered by the{" "}
            <a
              href="https://www.zama.org"
              target="_blank"
              rel="noreferrer"
              className="text-muted underline-offset-2 hover:text-primary-bright hover:underline"
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
