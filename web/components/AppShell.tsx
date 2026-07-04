"use client";

import { Check, Copy, ExternalLink, Moon, Sun, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ADDRESSES, SEPOLIA_CHAIN_ID, ZERO_ADDRESS } from "@/lib/contracts";
import { useWallet } from "@/lib/wallet";

import { DeploymentBanner } from "./DeploymentBanner";
import { Badge, Button, shortAddress } from "./ui";

const TABS = [
  { href: "/issuer", label: "Issuer" },
  { href: "/investor", label: "Investor" },
  { href: "/governance", label: "Governance" },
  { href: "/tender", label: "Buyback" },
  { href: "/auditor", label: "Auditor" },
];

const ADDRESS_LINKS = [
  { label: "Shares", address: ADDRESSES.shares },
  { label: "mcUSD", address: ADDRESSES.mcUSD },
  { label: "Distributor", address: ADDRESSES.distributor },
  { label: "Resolutions", address: ADDRESSES.resolutions },
];

type Theme = "light" | "dark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, chainId, connecting, connect, eip1193, isAdmin, isAgent } = useWallet();
  const wrongChain = address !== null && chainId !== SEPOLIA_CHAIN_ID;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 1200);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-background/86 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-8">
            <Link href="/" prefetch={false} className="flex shrink-0 items-center gap-3" aria-label="Charter home">
              <Logo />
              <span className="font-display text-xl font-semibold tracking-[-0.03em]">Charter</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {TABS.map((tab) => {
                const active = pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    prefetch={false}
                    aria-current={active ? "page" : undefined}
                    className={`group relative rounded-md px-3 py-2 text-sm transition-colors duration-200 ${
                      active ? "text-foreground" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`absolute inset-x-3 -bottom-[13px] h-px origin-left rounded-full bg-cipher transition-transform duration-300 ${
                        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-cipher sm:inline-flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cipher opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cipher" />
              </span>
              Sepolia
            </span>
            <ThemeToggle />
            {address && (isAdmin || isAgent) && <Badge tone="primary">{isAdmin ? "Admin" : "Agent"}</Badge>}
            {wrongChain && <Badge tone="danger">Wrong network</Badge>}
            {address ? (
              <div className="flex min-w-0 items-center rounded-md border border-line bg-surface-2 shadow-[var(--shadow-1)]">
                <Wallet className="ml-3 h-4 w-4 shrink-0 text-faint" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate px-2 py-2 font-mono text-sm text-foreground">{shortAddress(address)}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border-l border-line text-muted transition-colors duration-150 hover:text-cipher"
                  aria-label="Copy connected wallet address"
                  title={copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy address"}
                >
                  {copyState === "copied" ? (
                    <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>
            ) : (
              <Button onClick={connect} disabled={connecting || !eip1193}>
                <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Connect
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
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                  active ? "bg-surface-2 text-cipher" : "text-muted"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <DeploymentBanner />
        {children}
      </main>
      <footer className="border-t border-line py-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-faint sm:px-6">
          <span>Charter - confidential equity on Ethereum Sepolia</span>
          <a
            href="https://github.com/Ridwannurudeen/charter"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-cipher hover:underline"
          >
            GitHub
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </a>
          {ADDRESS_LINKS.some((item) => item.address !== ZERO_ADDRESS) && (
            <span className="flex flex-wrap items-center gap-2">
              {ADDRESS_LINKS.map((item) =>
                item.address === ZERO_ADDRESS ? null : (
                  <a
                    key={item.label}
                    href={`https://sepolia.etherscan.io/address/${item.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-muted underline-offset-2 hover:text-cipher hover:underline"
                  >
                    {item.label}: {shortAddress(item.address)}
                  </a>
                ),
              )}
            </span>
          )}
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

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("charter.theme");
    const next =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = next;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(next);
  }, []);

  const toggle = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("charter.theme", next);
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-line bg-surface-2 text-muted transition-colors duration-150 hover:border-cipher hover:text-cipher"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M20 3.5 32.5 9.8v10.7c0 7.4-4.9 13.4-12.5 16-7.6-2.6-12.5-8.6-12.5-16V9.8L20 3.5Z"
        fill="color-mix(in srgb, var(--primary) 18%, transparent)"
        stroke="var(--primary)"
        strokeWidth="1.8"
      />
      <path d="M13 15h14" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 20h7" stroke="var(--cipher)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M23.5 20H27" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 25h14" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

export function ConnectGate({ children }: { children: React.ReactNode }) {
  const { address, connect, connecting, chainId, eip1193 } = useWallet();
  if (!address) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-16 text-center shadow-[var(--shadow-2)]">
        <Logo className="h-12 w-12" />
        <p className="eyebrow text-cipher">Wallet required</p>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Connect to continue</h1>
        <p className="text-sm leading-relaxed text-muted">
          {eip1193
            ? "Charter runs on Ethereum Sepolia. Connect a wallet to access the confidential share registry."
            : "Install a browser wallet, then connect on Ethereum Sepolia to access the confidential share registry."}
        </p>
        <Button onClick={connect} disabled={connecting || !eip1193}>
          <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Connect wallet
        </Button>
      </div>
    );
  }
  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-danger/40 bg-surface px-6 py-16 text-center shadow-[var(--shadow-2)]">
        <Logo className="h-12 w-12" />
        <p className="eyebrow text-danger">Network mismatch</p>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Wrong network</h1>
        <p className="text-sm leading-relaxed text-muted">Switch your wallet to Ethereum Sepolia (chain 11155111).</p>
        <Button onClick={connect}>Switch to Sepolia</Button>
      </div>
    );
  }
  return <>{children}</>;
}
