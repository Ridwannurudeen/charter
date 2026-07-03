"use client";

import { ZeroAddress, getAddress } from "ethers";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { AppShell, ConnectGate } from "@/components/AppShell";
import { EncryptedValue } from "@/components/EncryptedValue";
import { Badge, Button, Callout, Card, Field, Input, errorText, shortAddress } from "@/components/ui";
import { ADDRESSES, CONTRACTS_CONFIGURED } from "@/lib/contracts";
import { useWallet } from "@/lib/wallet";

const STORAGE_KEY = "charter.auditor.accounts";

type PortfolioRow = {
  account: string;
  handle: string | null;
  verified: boolean;
};

export default function AuditorPage() {
  return (
    <AppShell>
      <ConnectGate>
        <AuditorConsole />
      </ConnectGate>
    </AppShell>
  );
}

function AuditorConsole() {
  const { address, shares } = useWallet();
  const [accountInput, setAccountInput] = useState("");
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [inspected, setInspected] = useState<PortfolioRow | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setLoadingPortfolio(false);
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPortfolio(parsed.filter((item): item is string => typeof item === "string"));
      } catch {
        setError("Could not load the saved auditor portfolio.");
      } finally {
        setLoadingPortfolio(false);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const persistPortfolio = (accounts: string[]) => {
    setPortfolio(accounts);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    } catch {
      setError("Could not save the auditor portfolio.");
    }
  };

  const refreshPortfolio = useCallback(async () => {
    if (!CONTRACTS_CONFIGURED || !shares || !address) {
      setRows([]);
      return;
    }
    setLoadingPortfolio(true);
    try {
      const nextRows = await Promise.all(
        portfolio.map(async (account) => {
          const observer: string = await shares.observer(account);
          const verified = observer.toLowerCase() === address.toLowerCase();
          return {
            account,
            verified,
            handle: verified ? await shares.confidentialBalanceOf(account) : null,
          };
        }),
      );
      setRows(nextRows);
      setError(null);
    } catch (e) {
      setError(`Could not refresh auditor portfolio: ${errorText(e)}`);
    } finally {
      setLoadingPortfolio(false);
    }
  }, [address, portfolio, shares]);

  useEffect(() => {
    // Fetch-on-mount/dep-change: async loads set state only after awaited RPC calls resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshPortfolio();
  }, [refreshPortfolio]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(`${label} failed: ${errorText(e)}`);
    }
  };

  const inspect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await run("Inspection", async () => {
      if (!CONTRACTS_CONFIGURED) throw new Error("contracts are not deployed yet");
      if (!shares || !address) return;

      const account = getAddress(accountInput.trim());
      const observer: string = await shares.observer(account);
      if (observer === ZeroAddress || observer.toLowerCase() !== address.toLowerCase()) {
        setInspected(null);
        setNotice("This account has not appointed you as observer.");
        return;
      }

      const handle: string = await shares.confidentialBalanceOf(account);
      const row = { account, handle, verified: true };
      setInspected(row);
      setNotice(`Observer access verified for ${shortAddress(account)}.`);
      if (!portfolio.some((saved) => saved.toLowerCase() === account.toLowerCase())) {
        persistPortfolio([...portfolio, account]);
      }
    });
  };

  const remove = (account: string) => {
    persistPortfolio(portfolio.filter((saved) => saved.toLowerCase() !== account.toLowerCase()));
    setRows((current) => current.filter((row) => row.account.toLowerCase() !== account.toLowerCase()));
    if (inspected?.account.toLowerCase() === account.toLowerCase()) setInspected(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditor view</h1>
        <p className="mt-1 text-sm text-muted">
          Holders appoint you as observer; you decrypt exactly what they granted - their share balances and transfer
          amounts. Nothing else, nobody else.
        </p>
      </div>

      {error && <Callout tone="error">{error}</Callout>}
      {notice && <Callout tone={notice.includes("not appointed") ? "info" : "success"}>{notice}</Callout>}

      <Card title="Inspect account" subtitle="Verify observer access before attempting any decryption.">
        <form onSubmit={inspect} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Holder wallet">
              <Input placeholder="0x..." value={accountInput} onChange={(e) => setAccountInput(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={!accountInput}>
            Verify observer access
          </Button>
        </form>
        {inspected && (
          <div className="mt-5 border-t border-line pt-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted">{shortAddress(inspected.account)}</span>
              <Badge tone="success">Observer verified</Badge>
            </div>
            <EncryptedValue
              handle={inspected.handle}
              contractAddress={ADDRESSES.shares}
              suffix="shares"
              label="Decrypt as observer"
            />
          </div>
        )}
      </Card>

      <Card
        title="Portfolio"
        subtitle="Verified accounts are saved in this browser so repeated checks do not start from scratch."
      >
        {loadingPortfolio ? (
          <div className="flex flex-col gap-3">
            <div className="skeleton h-14 rounded-md" />
            <div className="skeleton h-14 rounded-md" />
          </div>
        ) : portfolio.length === 0 ? (
          <p className="text-sm leading-relaxed text-faint">
            No observed accounts yet. Ask a holder to open the Investor Portal, use Auditor access, and appoint your
            wallet as observer.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => (
              <li key={row.account} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{shortAddress(row.account)}</span>
                    {row.verified ? (
                      <Badge tone="success">Observer verified</Badge>
                    ) : (
                      <Badge tone="danger">Access removed</Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    {row.verified ? (
                      <EncryptedValue
                        handle={row.handle}
                        contractAddress={ADDRESSES.shares}
                        suffix="shares"
                        label="Decrypt as observer"
                      />
                    ) : (
                      <span className="text-sm text-faint">This account no longer appoints you as observer.</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(row.account)}
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-line text-muted transition-colors duration-150 hover:border-danger/60 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label={`Remove ${shortAddress(row.account)} from auditor portfolio`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
