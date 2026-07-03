"use client";

import { useState } from "react";

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
      {title && (
        <header className="mb-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted leading-relaxed">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const styles = {
    primary: "bg-primary text-on-primary hover:bg-primary-bright disabled:hover:bg-primary font-semibold",
    ghost: "border border-line-strong text-foreground hover:border-primary hover:text-primary-bright",
    danger: "border border-danger/50 text-danger hover:bg-danger/10",
  }[variant];

  return (
    <button
      type={type}
      disabled={disabled || busy}
      onClick={
        onClick &&
        (async () => {
          setBusy(true);
          try {
            await onClick();
          } finally {
            setBusy(false);
          }
        })
      }
      className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45 ${styles} ${className}`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {helper && <span className="mt-1.5 block text-xs text-muted">{helper}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-lg border border-line bg-background px-3 text-sm text-foreground placeholder:text-faint focus:border-primary focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Stat({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-raised px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-lg text-foreground ${mono ? "font-mono tabular" : ""}`}>{value}</div>
    </div>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "success" | "muted" | "danger" | "primary";
  children: React.ReactNode;
}) {
  const styles = {
    success: "bg-success/10 text-success border-success/30",
    muted: "bg-raised text-muted border-line",
    danger: "bg-danger/10 text-danger border-danger/30",
    primary: "bg-primary/10 text-primary-bright border-primary/30",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

export function Callout({ tone, children }: { tone: "info" | "error" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "border-line-strong bg-raised text-muted",
    error: "border-danger/40 bg-danger/5 text-danger",
    success: "border-success/40 bg-success/5 text-success",
  }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles}`}>{children}</div>;
}

export function shortAddress(addr: string): string {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export function formatUnits6(value: bigint): string {
  const whole = value / 1_000_000n;
  const frac = (value % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

export function errorText(error: unknown, fallback = "unknown error"): string {
  const message = error instanceof Error ? error.message : String(error ?? fallback);
  if (message.includes("ResolutionsNoVotingPower")) return "You had no shares at the snapshot.";
  if (message.includes("DistributorSharesNotPaused")) return "Pause share transfers before declaring or paying.";
  if (message.includes("DistributorStaleSupply")) return "Re-run supply disclosure after issuance before declaring.";
  if (message.includes("NotIssuer")) return "Connect with the issuer admin or agent wallet.";
  if (message.includes("AlreadyClaimed")) return "This wallet has already claimed demo shares.";
  return message.slice(0, 180);
}

export function txHashFrom(result: unknown): string | null {
  if (result && typeof result === "object" && "hash" in result && typeof result.hash === "string") {
    return result.hash;
  }
  return null;
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`https://sepolia.etherscan.io/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono underline-offset-2 hover:text-primary-bright hover:underline"
    >
      {shortAddress(hash)}
    </a>
  );
}
