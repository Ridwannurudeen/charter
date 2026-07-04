"use client";

import { Gavel, Hourglass, ShieldCheck } from "lucide-react";
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

type ProposalRow = {
  id: number;
  from: string;
  to: string;
  amount: string;
  reason: string;
  readyAt: number;
  confirmations: number;
  executed: boolean;
  confirmed: boolean;
};

type Notice = {
  label: string;
  hash: string | null;
};

export default function GuardianPage() {
  return (
    <AppShell>
      <ConnectGate>
        <Guardian />
      </ConnectGate>
    </AppShell>
  );
}

function Guardian() {
  const { address, eip1193, shares, guardian } = useWallet();
  const moduleConfigured = CONTRACTS_CONFIGURED && ADDRESSES.guardian !== ZERO_ADDRESS;
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [clock, setClock] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [timelock, setTimelock] = useState(0);
  const [guardianAccount, setGuardianAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("5000");
  const [reason, setReason] = useState("Demo enforcement action: recover shares from a compromised wallet");

  const refresh = useCallback(async () => {
    if (!moduleConfigured) {
      setLoading(false);
      return;
    }
    if (!guardian || !shares || !address) return;
    setLoading(true);
    try {
      const [proposalCount, currentClock, quorum, delay, isGuardian] = await Promise.all([
        guardian.proposalCount(),
        shares.clock(),
        guardian.THRESHOLD(),
        guardian.TIMELOCK(),
        guardian.isGuardian(address),
      ]);
      setClock(Number(currentClock));
      setThreshold(Number(quorum));
      setTimelock(Number(delay));
      setGuardianAccount(isGuardian);
      const list: ProposalRow[] = [];
      for (let i = 0; i < Number(proposalCount); i++) {
        const [proposal, confirmed] = await Promise.all([guardian.getProposal(i), guardian.confirmedBy(i, address)]);
        list.push({
          id: i,
          from: proposal.from,
          to: proposal.to,
          amount: proposal.amount,
          reason: proposal.reason,
          readyAt: Number(proposal.readyAt),
          confirmations: Number(proposal.confirmations),
          executed: proposal.executed,
          confirmed,
        });
      }
      setRows(list.reverse());
      setError(null);
    } catch (e) {
      setError(`Could not load guardian proposals: ${errorText(e)}`);
    } finally {
      setLoading(false);
    }
  }, [moduleConfigured, guardian, shares, address]);

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

  const propose = () =>
    run("Guardian proposal", async () => {
      const { handle, inputProof } = await encryptU64(eip1193!, ADDRESSES.guardian, address!, BigInt(amount));
      return (await guardian!.propose(from, to, handle, inputProof, reason)).wait();
    });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Enforcement"
        title="Force-transfers need a quorum, a reason, and time."
        description="Guardian enforcement replaces silent single-key seizure with a public proposal, a quorum of confirmations, and a timelock before anyone can execute. This is due-process plumbing, not a claim that a court order was verified on-chain."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Guardian quorum"
          value={threshold ? `${threshold}-of-N` : "loading"}
          trend="Threshold is on-chain"
        />
        <Stat label="Timelock" value={timelock.toLocaleString("en-US")} trend="Blocks after quorum" />
        <Stat
          label="Current block"
          value={clock.toLocaleString("en-US")}
          trend={guardianAccount ? "Guardian connected" : "Permissionless view"}
        />
      </div>

      {!moduleConfigured && (
        <Callout tone="info">The guardian contract address is not configured for this build.</Callout>
      )}
      {guardianAccount && (
        <Callout
          tone="info"
          icon={<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
        >
          Connected wallet is a guardian. You can propose and confirm enforcement actions.
        </Callout>
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

      {guardianAccount && moduleConfigured && (
        <Card
          eyebrow="Guardian action"
          title="Propose a forced transfer"
          subtitle="The reason is public and permanent. The encrypted amount stays private until an authorized holder decrypts it."
          variant="feature"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="From">
              <Input placeholder="0x..." value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input placeholder="0x..." value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Encrypted shares">
              <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Public reason" helper="Visible to everyone before execution; do not put private data here.">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          <div className="mt-5">
            <Button disabled={!from || !to || !amount || !reason} onClick={propose}>
              <Gavel className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Propose
            </Button>
          </div>
        </Card>
      )}

      <div>
        <div className="mb-4">
          <p className="eyebrow text-cipher">Due-process trail</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em]">
            Public reason. Private amount. Delayed execution.
          </h2>
        </div>

        {loading ? (
          <Card variant="raised">
            <div className="grid gap-3">
              <div className="skeleton h-32 rounded-md" />
              <div className="skeleton h-32 rounded-md" />
            </div>
          </Card>
        ) : rows.length === 0 ? (
          <Card variant="raised">
            <p className="py-8 text-center text-sm text-faint">No enforcement actions proposed.</p>
          </Card>
        ) : (
          <div className="grid gap-5">
            {rows.map((row) => {
              const quorumReached = threshold > 0 && row.confirmations >= threshold;
              const ready = quorumReached && row.readyAt > 0 && clock >= row.readyAt;
              const remaining = quorumReached && row.readyAt > clock ? row.readyAt - clock : 0;
              const confirmationProgress =
                threshold === 0 ? 0 : Math.min(100, Math.round((row.confirmations * 100) / threshold));
              return (
                <Card key={row.id} variant="raised">
                  <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-faint">#{row.id}</span>
                        {row.executed ? (
                          <Badge tone="success">Executed</Badge>
                        ) : ready ? (
                          <Badge tone="primary">Ready</Badge>
                        ) : quorumReached ? (
                          <Badge tone="muted">Timelock</Badge>
                        ) : (
                          <Badge tone="muted">Awaiting quorum</Badge>
                        )}
                        {row.confirmed && <Badge tone="primary">You confirmed</Badge>}
                      </div>

                      <div className="rounded-md border border-line bg-background/45 px-4 py-3">
                        <p className="eyebrow text-faint">Public reason</p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">{row.reason}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Stat label="From" value={shortAddress(row.from)} />
                        <Stat label="To" value={shortAddress(row.to)} />
                      </div>

                      <div>
                        <p className="eyebrow mb-2 text-faint">Encrypted amount</p>
                        <EncryptedValue
                          handle={row.amount}
                          contractAddress={ADDRESSES.guardian}
                          suffix="shares"
                          label="Decrypt amount"
                          emptyText="No encrypted enforcement amount recorded."
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 rounded-lg border border-line bg-background/35 p-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
                          <span>
                            {row.confirmations.toLocaleString("en-US")} / {threshold.toLocaleString("en-US")}{" "}
                            confirmations
                          </span>
                          <span className="font-mono tabular">{confirmationProgress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full border border-line bg-background/55">
                          <div
                            className="h-full bg-cipher transition-[width] duration-300"
                            style={{ width: `${confirmationProgress}%` }}
                          />
                        </div>
                      </div>

                      <div className="rounded-md border border-line bg-surface px-3 py-3">
                        <p className="eyebrow text-faint">Execution window</p>
                        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                          <Hourglass className="h-4 w-4 text-cipher" strokeWidth={1.75} aria-hidden="true" />
                          {row.executed
                            ? "Executed"
                            : ready
                              ? "Ready for anyone to execute"
                              : quorumReached
                                ? `${remaining.toLocaleString("en-US")} blocks remaining`
                                : "Starts after quorum"}
                        </p>
                        {row.readyAt > 0 && (
                          <p className="mt-2 font-mono text-xs text-faint">
                            Ready at block {row.readyAt.toLocaleString("en-US")}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {guardianAccount && !row.confirmed && !row.executed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => run("Confirmation", async () => (await guardian!.confirm(row.id)).wait())}
                          >
                            Confirm
                          </Button>
                        )}
                        {ready && !row.executed && (
                          <Button
                            size="sm"
                            onClick={() => run("Execution", async () => (await guardian!.execute(row.id)).wait())}
                          >
                            Execute
                          </Button>
                        )}
                      </div>
                      {ready && !row.executed && (
                        <p className="text-xs leading-relaxed text-muted">
                          Execution is permissionless after quorum and timelock; any wallet can click this button.
                        </p>
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
