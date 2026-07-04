"use client";

import { CheckCircle2, ExternalLink, Info, TriangleAlert } from "lucide-react";
import { useState } from "react";

export function Card({
  title,
  subtitle,
  eyebrow,
  variant = "flat",
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  variant?: "flat" | "raised" | "feature";
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    flat: "border-line bg-surface",
    raised: "border-line-strong bg-surface-2 shadow-[var(--shadow-1)]",
    feature: "border-line-strong bg-surface-2 surface-hairline",
  }[variant];

  return (
    <section className={`rounded-lg border p-5 sm:p-6 ${styles} ${className}`}>
      {(title || eyebrow) && (
        <header className="mb-5">
          {eyebrow && <p className="eyebrow mb-2 text-cipher">{eyebrow}</p>}
          {title && <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">{title}</h2>}
          {subtitle && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{subtitle}</p>}
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
  size = "md",
  disabled,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: "primary" | "ghost" | "danger" | "quiet";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const styles = {
    primary:
      "bg-primary text-on-primary shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_12px_32px_-22px_var(--primary)] hover:bg-primary-bright hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_18px_44px_-24px_var(--primary)]",
    ghost:
      "border border-line-strong bg-surface-2 text-foreground hover:border-cipher hover:text-cipher hover:shadow-[var(--shadow-1)]",
    danger: "border border-danger/45 bg-danger/5 text-danger hover:bg-danger/10 hover:border-danger/70",
    quiet: "text-muted hover:bg-surface-2 hover:text-foreground",
  }[variant];
  const sizes = {
    sm: "h-9 px-3 text-xs",
    md: "h-11 px-4 text-sm",
  }[size];

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
      className={`inline-flex min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md font-semibold transition-[background,border-color,color,box-shadow,transform] duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 ${sizes} ${styles} ${className}`}
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
      <span className="eyebrow mb-2 block text-faint">{label}</span>
      {children}
      {helper && <span className="mt-2 block text-xs leading-relaxed text-muted">{helper}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const numeric = props.inputMode === "numeric" || props.type === "number";
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-md border border-line bg-background/55 px-3 text-sm text-foreground placeholder:text-faint transition-colors duration-150 focus:border-cipher focus:outline-none ${
        numeric ? "font-mono tabular" : ""
      } ${props.className ?? ""}`}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}: {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-col gap-5 py-4 sm:py-6 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div>
        <p className="eyebrow text-cipher">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

export function Stat({
  label,
  value,
  mono = true,
  trend,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  trend?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-line bg-surface-2 px-4 py-3 shadow-[var(--shadow-1)] ${className}`}>
      <div className="eyebrow text-faint">{label}</div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground ${mono ? "font-mono tabular" : ""}`}
      >
        {value}
      </div>
      {trend && <div className="mt-2 text-xs text-muted">{trend}</div>}
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
    muted: "bg-surface-2 text-muted border-line",
    danger: "bg-danger/10 text-danger border-danger/30",
    primary: "bg-cipher/10 text-cipher border-cipher/35",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

export function Callout({
  tone,
  children,
  icon,
}: {
  tone: "info" | "error" | "success";
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const styles = {
    info: "border-line-strong bg-surface-2 text-muted",
    error: "border-danger/40 bg-danger/5 text-danger",
    success: "border-success/40 bg-success/5 text-success",
  }[tone];
  const fallbackIcon = {
    info: <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />,
    error: <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />,
    success: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />,
  }[tone];
  return (
    <div
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed shadow-[var(--shadow-1)] ${styles}`}
    >
      {icon ?? fallbackIcon}
      <div>{children}</div>
    </div>
  );
}

export function shortAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
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
  if (message.includes("IssuanceNotAccredited")) return "This wallet has not been accredited yet.";
  if (message.includes("VestingAlreadyRevoked")) return "This vesting grant has already been revoked.";
  if (message.includes("VestingNotBeneficiary")) return "Only the grant beneficiary can claim vested shares.";
  if (message.includes("GuardianNotGuardian")) return "Connect with a guardian wallet to perform this action.";
  if (message.includes("GuardianQuorumNotReached")) return "Guardian quorum has not been reached yet.";
  if (message.includes("GuardianTimelockNotElapsed")) return "The timelock has not elapsed yet.";
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
      className="inline-flex items-center gap-1 font-mono text-cipher underline-offset-2 hover:underline"
    >
      {shortAddress(hash)}
      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}
