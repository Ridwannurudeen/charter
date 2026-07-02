"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell, ConnectGate } from "@/components/AppShell";
import { Badge, Button, Callout, Card, Field, Input, Stat, formatUnits6 } from "@/components/ui";
import { ADDRESSES, CONTRACTS_CONFIGURED } from "@/lib/contracts";
import { encryptU64, publicDecrypt } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

type DistributionRow = {
  id: number;
  pool: bigint;
  totalShares: bigint;
  declaredAt: number;
};

export default function IssuerPage() {
  return (
    <AppShell>
      <ConnectGate>
        <IssuerConsole />
      </ConnectGate>
    </AppShell>
  );
}

function IssuerConsole() {
  const { address, eip1193, shares, mcUSD, distributor, isAdmin, isAgent, refreshRoles } = useWallet();
  const [paused, setPaused] = useState(false);
  const [totalOnRecord, setTotalOnRecord] = useState<bigint>(0n);
  const [distributions, setDistributions] = useState<DistributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!CONTRACTS_CONFIGURED) {
      setLoading(false);
      return;
    }
    if (!shares || !distributor) return;
    setLoading(true);
    try {
      const [p, total, count] = await Promise.all([
        shares.paused(),
        shares.totalSharesOnRecord(),
        distributor.distributionCount(),
      ]);
      setPaused(p);
      setTotalOnRecord(total);
      const rows: DistributionRow[] = [];
      for (let i = 0; i < Number(count); i++) {
        const d = await distributor.getDistribution(i);
        rows.push({ id: i, pool: d.pool, totalShares: d.totalShares, declaredAt: Number(d.declaredAt) });
      }
      setDistributions(rows.reverse());
    } catch {
      setError("Could not load registry state — are the contract addresses configured?");
    } finally {
      setLoading(false);
    }
  }, [shares, distributor]);

  useEffect(() => {
    // Fetch-on-mount/dep-change: async loads set state only after awaited RPC calls resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    void refreshRoles();
  }, [refresh, refreshRoles]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(`${label} confirmed.`);
      await refresh();
    } catch (e) {
      setError(`${label} failed: ${(e as Error)?.message?.slice(0, 160) ?? "unknown error"}`);
    }
  };

  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [restrictAddr, setRestrictAddr] = useState("");
  const [poolAmount, setPoolAmount] = useState("");
  const [payoutId, setPayoutId] = useState("");
  const [payoutList, setPayoutList] = useState("");

  if (!isAdmin && !isAgent) {
    return (
      <div className="mx-auto max-w-md">
        <Callout tone="info">
          The issuer console requires the registry admin or agent role. Connect with the company wallet to manage
          issuance, disclosures, and distributions.
        </Callout>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Issuer console</h1>
          <p className="mt-1 text-sm text-muted">
            Allocations are encrypted in your browser; the chain computes on ciphertext.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Stat
            label="Shares on record"
            value={totalOnRecord > 0n ? totalOnRecord.toLocaleString("en-US") : "not disclosed"}
          />
          <Stat
            label="Transfers"
            value={paused ? <Badge tone="danger">Paused</Badge> : <Badge tone="success">Live</Badge>}
            mono={false}
          />
        </div>
      </div>

      {error && <Callout tone="error">{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Issue shares" subtitle="Allocations are encrypted client-side. The chain never sees the amount.">
          <div className="flex flex-col gap-4">
            <Field label="Investor wallet">
              <Input placeholder="0x…" value={mintTo} onChange={(e) => setMintTo(e.target.value)} />
            </Field>
            <Field label="Shares">
              <Input
                placeholder="500000"
                inputMode="numeric"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
              />
            </Field>
            <Button
              disabled={!mintTo || !mintAmount}
              onClick={() =>
                run("Issuance", async () => {
                  const { handle, inputProof } = await encryptU64(
                    eip1193!,
                    ADDRESSES.shares,
                    address!,
                    BigInt(mintAmount),
                  );
                  return (await shares!.confidentialMint(mintTo, handle, inputProof)).wait();
                })
              }
            >
              Mint encrypted allocation
            </Button>
          </div>
        </Card>

        <Card
          title="Supply disclosure"
          subtitle="Publish the total issued shares with a KMS decryption proof, verified on-chain. This becomes the denominator for pro-rata distributions."
        >
          <div className="flex flex-col gap-3">
            <Button
              variant="ghost"
              onClick={() => run("Disclosure request", async () => (await shares!.requestSupplyDisclosure()).wait())}
            >
              1 · Request disclosure
            </Button>
            <Button
              onClick={() =>
                run("Disclosure finalization", async () => {
                  const handle: string = await shares!.confidentialTotalSupply();
                  const result = await publicDecrypt(eip1193!, [handle]);
                  const clear = result.clearValues[handle];
                  if (typeof clear !== "bigint") throw new Error("oracle returned no value — request disclosure first");
                  return (await shares!.finalizeSupplyDisclosure(clear, result.decryptionProof)).wait();
                })
              }
            >
              2 · Fetch proof &amp; finalize on-chain
            </Button>
          </div>
        </Card>

        <Card
          title="Declare a distribution"
          subtitle="The pool total is public and verifiable; every individual payout stays encrypted. Funds are pulled from your mcUSD treasury."
        >
          <div className="flex flex-col gap-4">
            <Field
              label="Pool (mcUSD)"
              helper="Requires a disclosed share supply. Treasury and operator approval are handled automatically."
            >
              <Input
                placeholder="10000"
                inputMode="numeric"
                value={poolAmount}
                onChange={(e) => setPoolAmount(e.target.value)}
              />
            </Field>
            <Button
              disabled={!poolAmount || totalOnRecord === 0n}
              onClick={() =>
                run("Distribution declaration", async () => {
                  const pool = BigInt(poolAmount) * 1_000_000n;
                  const until = Math.floor(Date.now() / 1000) + 86_400;
                  await (await mcUSD!.mint(address, pool)).wait();
                  if (!(await mcUSD!.isOperator(address, ADDRESSES.distributor))) {
                    await (await mcUSD!.setOperator(ADDRESSES.distributor, until)).wait();
                  }
                  return (await distributor!.declare(ADDRESSES.mcUSD, pool)).wait();
                })
              }
            >
              Fund &amp; declare
            </Button>
          </div>
        </Card>

        <Card
          title="Pay a distribution"
          subtitle="Transfers must be paused first — the pause is the record date. Keep batches to ~15 investors per transaction."
        >
          <div className="flex flex-col gap-4">
            <Field label="Distribution ID">
              <Input
                placeholder="0"
                inputMode="numeric"
                value={payoutId}
                onChange={(e) => setPayoutId(e.target.value)}
              />
            </Field>
            <Field label="Investor wallets" helper="Comma-separated addresses.">
              <Input placeholder="0x…, 0x…" value={payoutList} onChange={(e) => setPayoutList(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                onClick={() =>
                  run(paused ? "Unpause" : "Record-date pause", async () =>
                    (await (paused ? shares!.unpause() : shares!.pause())).wait(),
                  )
                }
              >
                {paused ? "Unpause transfers" : "Pause (set record date)"}
              </Button>
              <Button
                disabled={!paused || payoutId === "" || !payoutList}
                onClick={() =>
                  run("Batch payout", async () => {
                    const list = payoutList
                      .split(",")
                      .map((a) => a.trim())
                      .filter(Boolean);
                    return (await distributor!.payBatch(BigInt(payoutId), list)).wait();
                  })
                }
              >
                Pay batch
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Compliance" subtitle="Restrict a wallet from transferring, or lift a restriction.">
          <div className="flex flex-col gap-4">
            <Field label="Wallet">
              <Input placeholder="0x…" value={restrictAddr} onChange={(e) => setRestrictAddr(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={!restrictAddr}
                onClick={() => run("Block", async () => (await shares!.blockUser(restrictAddr)).wait())}
              >
                Block
              </Button>
              <Button
                variant="ghost"
                disabled={!restrictAddr}
                onClick={() => run("Unblock", async () => (await shares!.unblockUser(restrictAddr)).wait())}
              >
                Unblock
              </Button>
            </div>
          </div>
        </Card>

        <Card
          title="Distribution history"
          subtitle="Pool totals are public by design; the payouts inside them are not."
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              <div className="skeleton h-9 rounded-md" />
              <div className="skeleton h-9 rounded-md" />
              <div className="skeleton h-9 rounded-md" />
            </div>
          ) : distributions.length === 0 ? (
            <p className="text-sm text-faint">No distributions yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {distributions.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-mono text-muted">#{d.id}</span>
                  <span className="font-mono tabular">{formatUnits6(d.pool)} mcUSD</span>
                  <span className="text-muted">over {d.totalShares.toLocaleString("en-US")} shares</span>
                  <span className="text-xs text-faint">
                    {new Date(d.declaredAt * 1000).toLocaleDateString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
