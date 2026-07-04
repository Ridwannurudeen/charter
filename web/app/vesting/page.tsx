"use client";

import { Clock3, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AppShell, ConnectGate } from "@/components/AppShell";
import { EncryptedValue } from "@/components/EncryptedValue";
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
  shortAddress,
  txHashFrom,
} from "@/components/ui";
import { ADDRESSES, CONTRACTS_CONFIGURED, ZERO_ADDRESS } from "@/lib/contracts";
import { encryptU64 } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

const OPERATOR_UNTIL = 4_000_000_000;

type GrantRow = {
  id: number;
  beneficiary: string;
  total: string;
  released: string;
  start: number;
  cliff: number;
  vestingEnd: number;
  revoked: boolean;
  elapsed: number;
  duration: number;
};

type Notice = {
  label: string;
  hash: string | null;
};

export default function VestingPage() {
  return (
    <AppShell>
      <ConnectGate>
        <Vesting />
      </ConnectGate>
    </AppShell>
  );
}

function Vesting() {
  const { address, eip1193, shares, vesting, isAdmin, isAgent } = useWallet();
  const moduleConfigured = CONTRACTS_CONFIGURED && ADDRESSES.vesting !== ZERO_ADDRESS;
  const [rows, setRows] = useState<GrantRow[]>([]);
  const [clock, setClock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("50000");
  const [cliffDelay, setCliffDelay] = useState("30");
  const [duration, setDuration] = useState("120");

  const refresh = useCallback(async () => {
    if (!moduleConfigured) {
      setLoading(false);
      return;
    }
    if (!vesting || !shares || !address) return;
    setLoading(true);
    try {
      const [count, currentClock] = await Promise.all([vesting.grantCount(), shares.clock()]);
      setClock(Number(currentClock));
      const list: GrantRow[] = [];
      for (let i = 0; i < Number(count); i++) {
        const [grant, progress] = await Promise.all([vesting.getGrant(i), vesting.vestingProgress(i)]);
        list.push({
          id: i,
          beneficiary: grant.beneficiary,
          total: grant.total,
          released: grant.released,
          start: Number(grant.start),
          cliff: Number(grant.cliff),
          vestingEnd: Number(grant.vestingEnd),
          revoked: grant.revoked,
          elapsed: Number(progress.elapsed),
          duration: Number(progress.duration),
        });
      }
      setRows(list.reverse());
      setError(null);
    } catch (e) {
      setError(`Could not load vesting grants: ${errorText(e)}`);
    } finally {
      setLoading(false);
    }
  }, [moduleConfigured, vesting, shares, address]);

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

  const createGrant = () =>
    run("Vesting grant", async () => {
      await (await shares!.setOperator(ADDRESSES.vesting, OPERATOR_UNTIL)).wait();
      const { handle, inputProof } = await encryptU64(eip1193!, ADDRESSES.vesting, address!, BigInt(amount));
      return (await vesting!.createGrant(beneficiary, handle, inputProof, BigInt(cliffDelay), BigInt(duration))).wait();
    });

  const isIssuer = isAdmin || isAgent;
  const activeCount = rows.filter((row) => !row.revoked && row.elapsed < row.duration).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Vesting"
        title="Shares that vest, not shares that exist."
        description="Create cliff-and-linear grants from encrypted share balances. Timing is public block data; grant size, released shares, and claim amounts stay encrypted."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Grant count" value={rows.length.toLocaleString("en-US")} trend="Public schedule registry" />
        <Stat label="Active grants" value={activeCount.toLocaleString("en-US")} trend="Not revoked or fully vested" />
        <Stat label="Current block" value={clock.toLocaleString("en-US")} trend="Share-token clock" />
      </div>

      {!moduleConfigured && (
        <Callout tone="info">The vesting contract address is not configured for this build yet.</Callout>
      )}
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

      {isIssuer && moduleConfigured && (
        <Card
          eyebrow="Issuer action"
          title="Create a vesting grant"
          subtitle="The issuer escrows an encrypted grant amount into the schedule contract, then the beneficiary claims vested shares over time."
          variant="feature"
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto] lg:items-end">
            <Field label="Beneficiary">
              <Input placeholder="0x..." value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} />
            </Field>
            <Field label="Encrypted shares">
              <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Cliff delay (blocks)">
              <Input inputMode="numeric" value={cliffDelay} onChange={(e) => setCliffDelay(e.target.value)} />
            </Field>
            <Field label="Duration (blocks)">
              <Input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <Button disabled={!beneficiary || !amount || !cliffDelay || !duration} onClick={createGrant}>
              Create grant
            </Button>
          </div>
        </Card>
      )}

      <div>
        <div className="mb-4">
          <p className="eyebrow text-cipher">Grant ledger</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em]">Public time, private amounts.</h2>
        </div>

        {loading ? (
          <Card variant="raised">
            <div className="grid gap-3">
              <div className="skeleton h-28 rounded-md" />
              <div className="skeleton h-28 rounded-md" />
            </div>
          </Card>
        ) : rows.length === 0 ? (
          <Card variant="raised">
            <p className="py-8 text-center text-sm text-faint">No vesting grants yet.</p>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {rows.map((row) => {
              const beneficiaryMatches = address?.toLowerCase() === row.beneficiary.toLowerCase();
              const progress = row.duration === 0 ? 0 : Math.min(100, Math.round((row.elapsed * 100) / row.duration));
              const beforeCliff = clock < row.cliff;
              const fullyVested = row.elapsed >= row.duration;
              return (
                <Card key={row.id} variant="raised">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-faint">#{row.id}</span>
                        <Badge
                          tone={row.revoked ? "danger" : fullyVested ? "success" : beforeCliff ? "muted" : "primary"}
                        >
                          {row.revoked
                            ? "Revoked"
                            : fullyVested
                              ? "Fully vested"
                              : beforeCliff
                                ? "Cliff pending"
                                : "Vesting"}
                        </Badge>
                        {beneficiaryMatches && <Badge tone="primary">Your grant</Badge>}
                      </div>
                      <span className="font-mono text-sm text-muted">{shortAddress(row.beneficiary)}</span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <Stat label="Start" value={row.start.toLocaleString("en-US")} />
                      <Stat label="Cliff" value={row.cliff.toLocaleString("en-US")} />
                      <Stat label="End" value={row.vestingEnd.toLocaleString("en-US")} />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5 text-cipher" strokeWidth={1.75} aria-hidden="true" />
                          {row.elapsed.toLocaleString("en-US")} / {row.duration.toLocaleString("en-US")} blocks elapsed
                        </span>
                        <span className="font-mono tabular">{progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full border border-line bg-background/55">
                        <div
                          className="h-full bg-cipher transition-[width] duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 border-t border-line pt-5">
                      <div>
                        <p className="eyebrow mb-2 text-faint">Encrypted total</p>
                        <EncryptedValue
                          handle={row.total}
                          contractAddress={ADDRESSES.vesting}
                          suffix="shares"
                          label="Decrypt grant"
                          emptyText="No encrypted grant total recorded."
                        />
                      </div>
                      <div>
                        <p className="eyebrow mb-2 text-faint">Released so far</p>
                        <EncryptedValue
                          handle={row.released}
                          contractAddress={ADDRESSES.vesting}
                          suffix="shares"
                          label="Decrypt released"
                          emptyText="No shares released yet."
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {beneficiaryMatches && !row.revoked && (
                        <Button
                          size="sm"
                          onClick={() => run("Claim", async () => (await vesting!.claim(row.id)).wait())}
                        >
                          Claim vested shares
                        </Button>
                      )}
                      {isIssuer && !row.revoked && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => run("Revocation", async () => (await vesting!.revoke(row.id)).wait())}
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                          Revoke
                        </Button>
                      )}
                    </div>
                    {isIssuer && !row.revoked && (
                      <p className="text-xs leading-relaxed text-muted">
                        Revocation settles vested-to-date shares to the beneficiary and returns the encrypted unvested
                        remainder to the issuer.
                      </p>
                    )}
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
