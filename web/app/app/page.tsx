"use client";

import { ArrowRight, Banknote, Eye, Landmark, LockKeyhole, ShieldCheck, Vote } from "lucide-react";
import Link from "next/link";

import { AppShell, ConnectGate } from "@/components/AppShell";
import { Badge, Card, PageHeader, Stat, shortAddress } from "@/components/ui";
import { ADDRESSES } from "@/lib/contracts";
import { useWallet } from "@/lib/wallet";

const PROOF_LINKS = [
  ["Active distributor", ADDRESSES.distributor, "guarded claim path"],
  ["Shares", ADDRESSES.shares, "one unmoved ledger"],
  ["Resolutions", ADDRESSES.resolutions, "active governance"],
] as const;

const WORKSPACES = [
  ["/investor", "Investor", "Decrypt positions, claim payouts, transfer shares, appoint observers.", LockKeyhole],
  ["/issuer", "Issuer", "Issue encrypted shares, disclose supply, declare distributions.", Banknote],
  ["/governance", "Governance", "Create proposals, cast encrypted votes, settle outcomes.", Vote],
  ["/auditor", "Auditor", "Inspect only holder-approved observer portfolios.", Eye],
] as const;

const ADVANCED = [
  ["/tender", "Buyback", "Confidential tender offers"],
  ["/vesting", "Vesting", "Cliff-and-linear grants"],
  ["/compliance", "Compliance", "Accreditation-gated issuance"],
  ["/guardian", "Guardian", "Quorum enforcement trail"],
] as const;

export default function AppOverviewPage() {
  return (
    <AppShell>
      <ConnectGate>
        <AppOverview />
      </ConnectGate>
    </AppShell>
  );
}

function AppOverview() {
  const { address, isAdmin, isAgent } = useWallet();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="App overview"
        title="Choose the workspace for this wallet."
        description="Charter's app is role-based. Start with the action this wallet is allowed to perform, then move into the specialized module pages when needed."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Connected wallet"
          value={address ? shortAddress(address) : "not connected"}
          trend={isAdmin ? "Admin role" : isAgent ? "Agent role" : "Shareholder or observer"}
        />
        <Stat label="Network" value="Sepolia" trend="Live deployed contracts" mono={false} />
        <Stat label="Distributor" value="guarded claim" trend="MAX_PAY_BATCH restored" mono={false} />
      </div>

      <section className="grid gap-5 lg:grid-cols-4">
        {WORKSPACES.map(([href, title, body, Icon]) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
            className="group min-h-64 rounded-xl border border-line bg-surface-2 p-6 shadow-[var(--shadow-1)] transition-[border-color,transform] duration-200 hover:-translate-y-1 hover:border-cipher"
          >
            <Icon className="h-5 w-5 text-cipher" strokeWidth={1.75} aria-hidden="true" />
            <h2 className="mt-12 font-display text-3xl font-semibold tracking-[-0.045em]">{title}</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">{body}</p>
            <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cipher">
              Open
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
            </span>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card
          eyebrow="Live proof"
          title="The demo is anchored to deployed Sepolia contracts."
          subtitle="These are not mock UI routes. The shell points at the current guarded distributor and the same CharterShares ledger used by every module."
          variant="feature"
        >
          <div className="grid gap-3">
            {PROOF_LINKS.map(([label, addressValue, detail]) => (
              <a
                key={label}
                href={`https://sepolia.etherscan.io/address/${addressValue}`}
                target="_blank"
                rel="noreferrer"
                className="grid gap-2 rounded-lg border border-line bg-background/45 p-4 transition-colors hover:border-cipher sm:grid-cols-[10rem_1fr_auto] sm:items-center"
              >
                <span className="eyebrow text-faint">{label}</span>
                <span className="font-mono text-sm text-foreground">{shortAddress(addressValue)}</span>
                <span className="text-sm text-muted">{detail}</span>
              </a>
            ))}
          </div>
        </Card>

        <Card
          eyebrow="Advanced modules"
          title="Specialized workflows sit behind the primary roles."
          subtitle="These modules are important, but they are not first-contact navigation for a new visitor."
          variant="raised"
        >
          <div className="grid gap-3">
            {ADVANCED.map(([href, title, body]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-background/45 p-4 transition-colors hover:border-cipher hover:text-cipher"
              >
                <span>
                  <span className="font-display text-xl font-semibold tracking-[-0.035em]">{title}</span>
                  <span className="mt-1 block text-sm text-muted">{body}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card variant="flat" className="border-cipher/25 bg-cipher/5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="primary">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Amount privacy only
          </Badge>
          <Badge tone="muted">Identities and timing are public</Badge>
          <Badge tone="muted">Mock mcUSD on Sepolia</Badge>
          <Badge tone="muted">
            <Landmark className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Not a full cap-table replacement
          </Badge>
        </div>
      </Card>
    </div>
  );
}
