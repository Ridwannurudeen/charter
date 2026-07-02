"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useWallet } from "@/lib/wallet";
import { SEPOLIA_CHAIN_ID } from "@/lib/contracts";

import { Badge, Button, shortAddress } from "./ui";

const TABS = [
  { href: "/issuer", label: "Issuer Console" },
  { href: "/investor", label: "Investor Portal" },
  { href: "/governance", label: "Governance" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, chainId, connecting, connect, isAdmin, isAgent } = useWallet();
  const wrongChain = address !== null && chainId !== SEPOLIA_CHAIN_ID;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Charter home">
              <Logo />
              <span className="text-lg font-bold tracking-tight">Charter</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {TABS.map((tab) => {
                const active = pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                      active ? "bg-raised font-semibold text-primary-bright" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {address && (isAdmin || isAgent) && <Badge tone="primary">{isAdmin ? "Admin" : "Agent"}</Badge>}
            {wrongChain && <Badge tone="danger">Wrong network</Badge>}
            {address ? (
              <span className="rounded-lg border border-line bg-raised px-3 py-2 font-mono text-sm text-foreground">
                {shortAddress(address)}
              </span>
            ) : (
              <Button onClick={connect} disabled={connecting}>
                Connect wallet
              </Button>
            )}
          </div>
        </div>
        <nav
          className="flex items-center gap-1 overflow-x-auto border-t border-line px-3 py-2 md:hidden"
          aria-label="Primary mobile"
        >
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-raised font-semibold text-primary-bright" : "text-muted"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-line py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-faint sm:px-6">
          <span>Charter — confidential equity on Ethereum Sepolia</span>
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

export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="7" stroke="var(--primary)" strokeWidth="2.4" />
      <path
        d="M21.5 11.2c-1-1.4-2.8-2.4-5-2.4-3.8 0-6.6 3.1-6.6 7.2s2.8 7.2 6.6 7.2c2.2 0 4-1 5-2.4"
        stroke="var(--primary)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ConnectGate({ children }: { children: React.ReactNode }) {
  const { address, connect, connecting, chainId } = useWallet();
  if (!address) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-line bg-surface px-6 py-16 text-center">
        <Logo className="h-10 w-10" />
        <h1 className="text-xl font-semibold">Connect to continue</h1>
        <p className="text-sm leading-relaxed text-muted">
          Charter runs on Ethereum Sepolia. Connect a wallet to access the confidential share registry.
        </p>
        <Button onClick={connect} disabled={connecting}>
          Connect wallet
        </Button>
      </div>
    );
  }
  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-danger/40 bg-surface px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Wrong network</h1>
        <p className="text-sm leading-relaxed text-muted">Switch your wallet to Ethereum Sepolia (chain 11155111).</p>
        <Button onClick={connect}>Switch to Sepolia</Button>
      </div>
    );
  }
  return <>{children}</>;
}
