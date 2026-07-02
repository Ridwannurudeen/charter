"use client";

import { ZeroAddress } from "ethers";
import { useCallback, useEffect, useState } from "react";

import { AppShell, ConnectGate } from "@/components/AppShell";
import { Badge, Button, Callout, Card, Field, Input } from "@/components/ui";
import { ADDRESSES } from "@/lib/contracts";
import { encryptBool, publicDecrypt } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

type ResolutionRow = {
  id: number;
  description: string;
  snapshot: number;
  deadline: number;
  forVotes: string;
  againstVotes: string;
  tallyRequested: boolean;
  resolved: boolean;
  forClear: bigint;
  againstClear: bigint;
  passed: boolean;
  voted: boolean;
};

export default function GovernancePage() {
  return (
    <AppShell>
      <ConnectGate>
        <Governance />
      </ConnectGate>
    </AppShell>
  );
}

function Governance() {
  const { address, eip1193, shares, resolutions, isAdmin, isAgent } = useWallet();
  const [rows, setRows] = useState<ResolutionRow[]>([]);
  const [clock, setClock] = useState(0);
  const [votingActive, setVotingActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState("300");

  const refresh = useCallback(async () => {
    if (!resolutions || !shares || !address) return;
    try {
      const [count, currentClock, delegatee] = await Promise.all([
        resolutions.resolutionCount(),
        shares.clock(),
        shares.delegates(address),
      ]);
      setClock(Number(currentClock));
      setVotingActive(delegatee !== ZeroAddress);
      const list: ResolutionRow[] = [];
      for (let i = 0; i < Number(count); i++) {
        const [r, voted] = await Promise.all([resolutions.getResolution(i), resolutions.hasVoted(i, address)]);
        list.push({
          id: i,
          description: r.description,
          snapshot: Number(r.snapshot),
          deadline: Number(r.deadline),
          forVotes: r.forVotes,
          againstVotes: r.againstVotes,
          tallyRequested: r.tallyRequested,
          resolved: r.resolved,
          forClear: r.forClear,
          againstClear: r.againstClear,
          passed: r.passed,
          voted,
        });
      }
      setRows(list.reverse());
    } catch {
      setError("Could not load resolutions — are the contract addresses configured?");
    }
  }, [resolutions, shares, address]);

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
      setError(`${label} failed: ${(e as Error)?.message?.slice(0, 160) ?? "unknown error"}`);
    }
  };

  const vote = (id: number, support: boolean) =>
    run(support ? "Vote FOR" : "Vote AGAINST", async () => {
      const { handle, inputProof } = await encryptBool(eip1193!, ADDRESSES.resolutions, address!, support);
      return (await resolutions!.castVote(id, handle, inputProof)).wait();
    });

  const settle = (row: ResolutionRow) =>
    run("Settlement", async () => {
      if (!row.tallyRequested) await (await resolutions!.requestTally(row.id)).wait();
      const result = await publicDecrypt(eip1193!, [row.forVotes, row.againstVotes]);
      const forClear = result.clearValues[row.forVotes];
      const againstClear = result.clearValues[row.againstVotes];
      if (typeof forClear !== "bigint" || typeof againstClear !== "bigint")
        throw new Error("oracle returned no tallies");
      return (await resolutions!.settle(row.id, forClear, againstClear, result.decryptionProof)).wait();
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shareholder resolutions</h1>
        <p className="mt-1 text-sm text-muted">
          Votes are weighted by your holdings at the snapshot — but neither your choice nor your weight is ever
          revealed. Only the final tallies are disclosed, with a cryptographic proof.
        </p>
      </div>

      {!votingActive && (
        <Callout tone="info">
          Your voting power is inactive. Visit the Investor Portal and activate voting before the next snapshot to
          participate.
        </Callout>
      )}
      {error && <Callout tone="error">{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}

      {(isAdmin || isAgent) && (
        <Card
          title="Propose a resolution"
          subtitle="Voting power snapshots at the current block; voting opens immediately after."
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Resolution text">
                <Input
                  placeholder="Approve the Series A financing"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </div>
            <div className="w-full sm:w-44">
              <Field label="Voting period (blocks)">
                <Input inputMode="numeric" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </Field>
            </div>
            <Button
              disabled={!description || !period}
              onClick={() =>
                run("Proposal", async () => (await resolutions!.propose(description, BigInt(period))).wait())
              }
            >
              Propose
            </Button>
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-faint">No resolutions yet.</p>
        </Card>
      ) : (
        rows.map((row) => {
          const open = clock <= row.deadline;
          return (
            <Card key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-faint">#{row.id}</span>
                    {row.resolved ? (
                      <Badge tone={row.passed ? "success" : "danger"}>{row.passed ? "Passed" : "Rejected"}</Badge>
                    ) : open ? (
                      <Badge tone="primary">Voting open</Badge>
                    ) : (
                      <Badge tone="muted">Awaiting settlement</Badge>
                    )}
                    {row.voted && <Badge tone="muted">You voted</Badge>}
                  </div>
                  <h3 className="mt-2 font-semibold">{row.description}</h3>
                  <p className="mt-1 text-xs text-muted">
                    Snapshot block {row.snapshot.toLocaleString("en-US")} · closes at block{" "}
                    {row.deadline.toLocaleString("en-US")}
                    {open && ` · current ${clock.toLocaleString("en-US")}`}
                  </p>
                  {row.resolved && (
                    <p className="mt-3 font-mono text-sm tabular">
                      <span className="text-success">{row.forClear.toLocaleString("en-US")} FOR</span>
                      <span className="mx-2 text-faint">/</span>
                      <span className="text-danger">{row.againstClear.toLocaleString("en-US")} AGAINST</span>
                    </p>
                  )}
                  {!row.resolved && (
                    <p className="mt-3 font-mono text-xs text-faint">
                      tallies encrypted: {row.forVotes.slice(2, 14)}… / {row.againstVotes.slice(2, 14)}…
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {open && !row.voted && (
                    <>
                      <Button className="h-10" disabled={!votingActive} onClick={() => vote(row.id, true)}>
                        For
                      </Button>
                      <Button
                        variant="danger"
                        className="h-10"
                        disabled={!votingActive}
                        onClick={() => vote(row.id, false)}
                      >
                        Against
                      </Button>
                    </>
                  )}
                  {!open && !row.resolved && (
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
