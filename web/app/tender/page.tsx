"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell, ConnectGate } from "@/components/AppShell";
import {
  Badge,
  Button,
  Callout,
  Card,
  Field,
  Input,
  PageHeader,
  Stat,
  TxLink,
  errorText,
  txHashFrom,
} from "@/components/ui";
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
  const openCount = rows.filter((row) => clock <= row.deadline).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Buyback board"
        title="Tender shares without revealing how many."
        description={
          <>
            The issuer offers to repurchase shares at a public price. You tender an encrypted quantity - how many shares
            you offer to sell stays private. Only the aggregate tendered amount is disclosed at close, with an on-chain
            proof.
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open offers" value={openCount.toLocaleString("en-US")} trend="Public offer board" />
        <Stat label="Current block" value={clock.toLocaleString("en-US")} trend="Share-clock deadline" />
        <Stat label="Tender privacy" value="encrypted" trend="Quantity stays private" mono={false} />
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
        <Card
          eyebrow="Issuer action"
          title="Open a buyback"
          subtitle="Escrows pricePerShare x maxShares of mcUSD from your treasury."
          variant="feature"
        >
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

      <div>
        <div className="mb-4">
          <p className="eyebrow text-cipher">Offer board</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em]">Public price, private size.</h2>
        </div>

        {loading ? (
          <Card variant="raised">
            <div className="flex flex-col gap-3">
              <div className="skeleton h-24 rounded-md" />
              <div className="skeleton h-24 rounded-md" />
            </div>
          </Card>
        ) : rows.length === 0 ? (
          <Card variant="raised">
            <p className="py-8 text-center text-sm text-faint">No buyback offers yet.</p>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {rows.map((row) => {
              const open = clock <= row.deadline;
              const oversubscribed = row.totalSettled && row.totalTenderedClear > row.maxShares;
              return (
                <Card key={row.id} variant="raised">
                  <div className="flex flex-wrap items-start justify-between gap-4">
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
                    <div className="grid w-full grid-cols-2 gap-3">
                      <Stat label="Price" value={`${row.pricePerShare.toLocaleString("en-US")} mcUSD`} />
                      <Stat label="Cap" value={row.maxShares.toLocaleString("en-US")} trend="shares" />
                    </div>
                    <p className="text-xs text-muted">
                      Closes at block {row.deadline.toLocaleString("en-US")}
                      {open && ` - current ${clock.toLocaleString("en-US")}`}
                    </p>
                    {row.totalSettled && (
                      <p className="rounded-md border border-line bg-background/45 px-3 py-2 text-sm text-muted">
                        Total tendered: {row.totalTenderedClear.toLocaleString("en-US")} shares. Individual tenders stay
                        encrypted.
                      </p>
                    )}
                    <div className="w-full">
                      {open && !row.tendered && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="flex-1">
                            <Field label="Shares to tender">
                              <Input
                                inputMode="numeric"
                                placeholder="1000"
                                value={qty[row.id] ?? ""}
                                onChange={(e) => setQty((q) => ({ ...q, [row.id]: e.target.value }))}
                              />
                            </Field>
                          </div>
                          <Button className="h-10" onClick={() => submitTender(row.id)}>
                            Tender
                          </Button>
                        </div>
                      )}
                      {!open && !row.totalSettled && (
                        <Button variant="ghost" size="sm" className="h-10" onClick={() => settle(row)}>
                          Settle with proof
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
