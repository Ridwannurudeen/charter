"use client";

import { ZeroAddress } from "ethers";
import { useCallback, useEffect, useState } from "react";

import { AppShell, ConnectGate } from "@/components/AppShell";
import { EncryptedValue } from "@/components/EncryptedValue";
import { Badge, Button, Callout, Card, Field, Input, formatUnits6, shortAddress } from "@/components/ui";
import { ADDRESSES, CONTRACTS_CONFIGURED } from "@/lib/contracts";
import { encryptU64 } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

export default function InvestorPage() {
  return (
    <AppShell>
      <ConnectGate>
        <InvestorPortal />
      </ConnectGate>
    </AppShell>
  );
}

function InvestorPortal() {
  const { address, eip1193, shares, mcUSD } = useWallet();
  const [shareHandle, setShareHandle] = useState<string | null>(null);
  const [usdHandle, setUsdHandle] = useState<string | null>(null);
  const [delegatee, setDelegatee] = useState<string | null>(null);
  const [observer, setObserver] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!CONTRACTS_CONFIGURED) {
      setLoading(false);
      return;
    }
    if (!shares || !mcUSD || !address) return;
    setLoading(true);
    try {
      const [sh, uh, del, obs] = await Promise.all([
        shares.confidentialBalanceOf(address),
        mcUSD.confidentialBalanceOf(address),
        shares.delegates(address),
        shares.observer(address),
      ]);
      setShareHandle(sh);
      setUsdHandle(uh);
      setDelegatee(del);
      setObserver(obs);
    } catch {
      setError("Could not load registry state — are the contract addresses configured?");
    } finally {
      setLoading(false);
    }
  }, [shares, mcUSD, address]);

  useEffect(() => {
    // Fetch-on-mount/dep-change: async loads set state only after awaited RPC calls resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(`${label} confirmed.`);
      await refresh();
    } catch (e) {
      setError(`${label} failed: ${(e as Error)?.message?.slice(0, 140) ?? "unknown error"}`);
    }
  };

  const votingActive = delegatee !== null && delegatee !== ZeroAddress;
  const hasObserver = observer !== null && observer !== ZeroAddress;

  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [observerAddr, setObserverAddr] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Investor portal</h1>
        <p className="mt-1 text-sm text-muted">
          Your positions are encrypted on-chain. Decryption happens in your browser, authorized by one wallet signature
          — nothing is revealed publicly.
        </p>
      </div>

      {error && <Callout tone="error">{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="My shareholding" subtitle="Charter Demo Corp common shares (CDC-S)">
          {loading ? (
            <div className="skeleton h-8 w-56 rounded-md" />
          ) : (
            <EncryptedValue
              handle={shareHandle}
              contractAddress={ADDRESSES.shares}
              suffix="shares"
              label="Decrypt my stake"
            />
          )}
          <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
            {votingActive ? (
              <>
                <Badge tone="success">Voting active</Badge>
                <span className="text-xs text-muted">
                  Delegated to {delegatee === address ? "self" : shortAddress(delegatee!)}
                </span>
              </>
            ) : (
              <>
                <Badge tone="muted">Voting inactive</Badge>
                <Button
                  variant="ghost"
                  className="h-9"
                  onClick={() => run("Voting activation", async () => (await shares!.delegate(address)).wait())}
                >
                  Activate voting power
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card title="My distributions" subtitle="Confidential USD received from dividend waterfalls">
          {loading ? (
            <div className="skeleton h-8 w-56 rounded-md" />
          ) : (
            <EncryptedValue
              handle={usdHandle}
              contractAddress={ADDRESSES.mcUSD}
              format={formatUnits6}
              suffix="mcUSD"
              label="Decrypt my payouts"
            />
          )}
        </Card>

        <Card
          title="Transfer shares"
          subtitle="Amounts are encrypted client-side before they touch the chain. Transfers respect the issuer's compliance policy."
        >
          <div className="flex flex-col gap-4">
            <Field label="Recipient">
              <Input placeholder="0x…" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
            </Field>
            <Field label="Shares">
              <Input
                placeholder="1000"
                inputMode="numeric"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </Field>
            <Button
              disabled={!transferTo || !transferAmount}
              onClick={() =>
                run("Transfer", async () => {
                  const { handle, inputProof } = await encryptU64(
                    eip1193!,
                    ADDRESSES.shares,
                    address!,
                    BigInt(transferAmount),
                  );
                  return (await shares!.confidentialTransfer(transferTo, handle, inputProof)).wait();
                })
              }
            >
              Send encrypted transfer
            </Button>
          </div>
        </Card>

        <Card
          title="Auditor access"
          subtitle="Appoint an observer — an auditor or regulator — with standing access to decrypt your positions. Revocable by setting the zero address."
        >
          {hasObserver && (
            <div className="mb-4">
              <Badge tone="primary">Observer: {shortAddress(observer!)}</Badge>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <Field label="Observer address" helper="They can decrypt your balance and transfer amounts — nothing else.">
              <Input placeholder="0x…" value={observerAddr} onChange={(e) => setObserverAddr(e.target.value)} />
            </Field>
            <Button
              variant="ghost"
              disabled={!observerAddr}
              onClick={() =>
                run("Observer update", async () => (await shares!.setObserver(address, observerAddr)).wait())
              }
            >
              {hasObserver ? "Replace observer" : "Appoint observer"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
