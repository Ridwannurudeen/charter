"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell, ConnectGate } from "@/components/AppShell";
import { Badge, Button, Callout, Card, Field, Input, TxLink, errorText, txHashFrom } from "@/components/ui";
import { ADDRESSES, CONTRACTS_CONFIGURED } from "@/lib/contracts";
import { encryptU64, publicDecrypt } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

const OPERATOR_UNTIL = 4_000_000_000; // far-future uint48 seconds

type OfferRow = {
  id: number;
  pricePerShare: bigint;
  maxShares: bigint;
  deadline: number;
  totalTendered: string;
  totalRequested: boolean;
  totalSettled: boolean;
  totalTenderedClear: bigint;
  tendered: boolean;
};

export default function TenderPage() {
  return (
    <AppShell>
      <ConnectGate>
        <Tender />
      </ConnectGate>
    </AppShell>
  );
}

function Tender() {
  const { address, eip1193, shares, mcUSD, tender, isAdmin, isAgent } = useWallet();
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [clock, setClock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ label: string; hash: string | null } | null>(null);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [price, setPrice] = useState("2");
  const [cap, setCap] = useState("500000");
  const [period, setPeriod] = useState("300");

  const refresh = useCallback(async () => {
    if (!CONTRACTS_CONFIGURED) {
      setLoading(false);
      return;
    }
    if (!tender || !shares || !address) return;
    setLoading(true);
    try {
      const [count, currentClock] = await Promise.all([tender.offerCount(), shares.clock()]);
      setClock(Number(currentClock));
      const list: OfferRow[] = [];
      for (let i = 0; i < Number(count); i++) {
        const [o, didTender] = await Promise.all([tender.getOffer(i), tender.tendered(i, address)]);
        list.push({
          id: i,
          pricePerShare: o.pricePerShare,
          maxShares: o.maxShares,
          deadline: Number(o.deadline),
          totalTendered: o.totalTendered,
          totalRequested: o.totalRequested,
          totalSettled: o.totalSettled,
          totalTenderedClear: o.totalTenderedClear,
          tendered: didTender,
        });
      }
      setRows(list.reverse());
      setError(null);
    } catch (e) {
      setError(`Could not load buyback offers: ${errorText(e)}`);
    } finally {
      setLoading(false);
    }
  }, [tender, shares, address]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      setNotice({ label, hash: txHashFrom(result) });
      await refresh();
    } catch (e) {
      setError(`${label} failed: ${errorText(e)}`);
    }
  };

  const submitTender = (id: number) =>
    run("Tender", async () => {
      const amount = qty[id];
      if (!amount) throw new Error("enter a quantity");
      // Let the buyback pull accepted shares if the offer clears.
      await (await shares!.setOperator(ADDRESSES.tender, OPERATOR_UNTIL)).wait();
      const { handle, inputProof } = await encryptU64(eip1193!, ADDRESSES.tender, address!, BigInt(amount));
      return (await tender!.tender(id, handle, inputProof)).wait();
    });

  const settle = (row: OfferRow) =>
    run("Settle buyback", async () => {
      let totalHandle = row.totalTendered;
      if (!row.totalRequested) {
        await (await tender!.requestTotal(row.id)).wait();
        totalHandle = (await tender!.getOffer(row.id)).totalTendered;
      }
      const result = await publicDecrypt(eip1193!, [totalHandle]);
      const total = result.clearValues[totalHandle];
      if (typeof total !== "bigint") throw new Error("oracle returned no total");
      return (await tender!.settleTotal(row.id, total, result.decryptionProof)).wait();
    });

  const openOffer = () =>
    run("Open buyback", async () => {
      // Escrow max payout: pricePerShare * maxShares of mcUSD.
      await (await mcUSD!.setOperator(ADDRESSES.tender, OPERATOR_UNTIL)).wait();
      return (await tender!.openOffer(ADDRESSES.mcUSD, BigInt(price), BigInt(cap), BigInt(period))).wait();
    });

  const isIssuer = isAdmin || isAgent;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Confidential buyback</h1>
        <p className="mt-1 text-sm text-muted">
          The issuer offers to repurchase shares at a public price. You tender an{" "}
          <span className="text-foreground">encrypted quantity</span> — how many shares you offer to sell stays private.
          Only the aggregate tendered amount is disclosed at close, with an on-chain proof. If the offer is
          oversubscribed, accepted amounts scale pro-rata on ciphertext.
        </p>
      </div>

      {error && <Callout tone="error">{error}</Callout>}
      {notice && (
        <Callout tone="success">
          {notice.label} confirmed.
          {notice.hash && (
            <>
              {" "}
              Tx: <TxLink hash={notice.hash} />
            </>
          )}
        </Callout>
      )}

      {isIssuer && (
        <Card title="Open a buyback" subtitle="Escrows pricePerShare x maxShares of mcUSD from your treasury.">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Price per share (mcUSD units)">
                <Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Max shares to repurchase">
                <Input inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
              </Field>
            </div>
            <div className="w-full sm:w-40">
              <Field label="Window (blocks)">
                <Input inputMode="numeric" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </Field>
            </div>
            <Button disabled={!price || !cap || !period} onClick={openOffer}>
              Open
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card>
          <div className="flex flex-col gap-3">
            <div className="skeleton h-24 rounded-md" />
            <div className="skeleton h-24 rounded-md" />
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-faint">No buyback offers yet.</p>
        </Card>
      ) : (
        rows.map((row) => {
          const open = clock <= row.deadline;
          const oversubscribed = row.totalSettled && row.totalTenderedClear > row.maxShares;
          return (
            <Card key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-faint">#{row.id}</span>
                    {row.totalSettled ? (
                      <Badge tone={oversubscribed ? "primary" : "success"}>
                        {oversubscribed ? "Settled - pro-rata" : "Settled - full fill"}
                      </Badge>
                    ) : open ? (
                      <Badge tone="primary">Open</Badge>
                    ) : (
                      <Badge tone="muted">Awaiting settlement</Badge>
                    )}
                    {row.tendered && <Badge tone="muted">You tendered</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    Repurchase up to {row.maxShares.toLocaleString("en-US")} shares at{" "}
                    {row.pricePerShare.toLocaleString("en-US")} mcUSD each.
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Closes at block {row.deadline.toLocaleString("en-US")}
                    {open && ` - current ${clock.toLocaleString("en-US")}`}
                  </p>
                  {row.totalSettled && (
                    <p className="mt-2 text-sm text-muted">
                      Total tendered: {row.totalTenderedClear.toLocaleString("en-US")} shares. Individual tenders stay
                      encrypted.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {open && !row.tendered && (
                    <div className="flex items-end gap-2">
                      <Field label="Shares to tender">
                        <Input
                          className="w-32"
                          inputMode="numeric"
                          placeholder="1000"
                          value={qty[row.id] ?? ""}
                          onChange={(e) => setQty((q) => ({ ...q, [row.id]: e.target.value }))}
                        />
                      </Field>
                      <Button className="h-10" onClick={() => submitTender(row.id)}>
                        Tender
                      </Button>
                    </div>
                  )}
                  {!open && !row.totalSettled && (
                    <Button variant="ghost" className="h-10" onClick={() => settle(row)}>
                      Settle with proof
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
