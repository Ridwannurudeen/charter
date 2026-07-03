"use client";

import { ZeroAddress } from "ethers";
import { useCallback, useEffect, useState } from "react";

import { AppShell, ConnectGate } from "@/components/AppShell";
import { Badge, Button, Callout, Card, Field, Input, TxLink, errorText, txHashFrom } from "@/components/ui";
import { ADDRESSES, CONTRACTS_CONFIGURED, ZERO_HANDLE } from "@/lib/contracts";
import { encryptBool, publicDecrypt } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

type ResolutionRow = {
  id: number;
  description: string;
  snapshot: number;
  deadline: number;
  passedHandle: string;
  voterCount: number;
  quorumReached: boolean;
  tallyRequested: boolean;
  resolved: boolean;
  passed: boolean;
  voted: boolean;
};

type Notice = {
  label: string;
  hash: string | null;
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
  const [shareHandle, setShareHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState("300");
  const [minVoters, setMinVoters] = useState(0);

  const refresh = useCallback(async () => {
    if (!CONTRACTS_CONFIGURED) {
      setLoading(false);
      return;
    }
    if (!resolutions || !shares || !address) return;
    setLoading(true);
    try {
      const [count, currentClock, delegatee, balanceHandle, quorum] = await Promise.all([
        resolutions.resolutionCount(),
        shares.clock(),
        shares.delegates(address),
        shares.confidentialBalanceOf(address),
        resolutions.MIN_VOTERS(),
      ]);
      setClock(Number(currentClock));
      setVotingActive(delegatee !== ZeroAddress);
      setShareHandle(balanceHandle);
      setMinVoters(Number(quorum));

      const list: ResolutionRow[] = [];
      for (let i = 0; i < Number(count); i++) {
        const [r, voted] = await Promise.all([resolutions.getResolution(i), resolutions.hasVoted(i, address)]);
        list.push({
          id: i,
          description: r.description,
          snapshot: Number(r.snapshot),
          deadline: Number(r.deadline),
          passedHandle: r.passedHandle,
          voterCount: Number(r.voterCount),
          quorumReached: r.quorumReached,
          tallyRequested: r.tallyRequested,
          resolved: r.resolved,
          passed: r.passed,
          voted,
        });
      }
      setRows(list.reverse());
      setError(null);
    } catch (e) {
      setError(`Could not load resolutions: ${errorText(e)}`);
    } finally {
      setLoading(false);
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
      const result = await fn();
      setNotice({ label, hash: txHashFrom(result) });
      await refresh();
    } catch (e) {
      setError(`${label} failed: ${errorText(e)}`);
    }
  };

  const vote = (id: number, support: boolean) =>
    run(support ? "Vote FOR" : "Vote AGAINST", async () => {
      const { handle, inputProof } = await encryptBool(eip1193!, ADDRESSES.resolutions, address!, support);
      return (await resolutions!.castVote(id, handle, inputProof)).wait();
    });

  const settle = (row: ResolutionRow) =>
    run("Settlement", async () => {
      let { passedHandle, quorumReached } = row;
      if (!row.tallyRequested) {
        const tx = await (await resolutions!.requestTally(row.id)).wait();
        const updated = await resolutions!.getResolution(row.id);
        passedHandle = updated.passedHandle;
        quorumReached = updated.quorumReached;
        // Below quorum, requestTally already resolves the resolution as rejected — nothing to decrypt.
        if (updated.resolved) return tx;
      }
      if (!quorumReached) throw new Error("quorum not reached — no outcome to settle");

      const result = await publicDecrypt(eip1193!, [passedHandle]);
      const passed = result.clearValues[passedHandle];
      if (typeof passed !== "boolean") throw new Error("oracle returned no outcome");
      return (await resolutions!.settle(row.id, passed, result.decryptionProof)).wait();
    });

  const hasVotingPowerHandle = shareHandle !== null && shareHandle !== ZERO_HANDLE;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shareholder resolutions</h1>
        <p className="mt-1 text-sm text-muted">
          Your choice and weight are encrypted end-to-end and never disclosed. Only the resolution&apos;s pass/fail
          outcome is revealed, proven on-chain by a KMS decryption proof. Who voted is public; how they voted is not.
          Any shareholder with active voting power can propose a resolution — not just the issuer.
          {minVoters > 0 && ` A resolution needs at least ${minVoters} voters to reach quorum before it can settle.`}
        </p>
      </div>

      {!votingActive && (
        <Callout tone="info">
          Your voting power is inactive. Visit the Investor Portal and activate voting before the next snapshot to
          participate.
        </Callout>
      )}
      {votingActive && !hasVotingPowerHandle && (
        <Callout tone="info">No share balance is visible for this wallet yet, so voting is disabled.</Callout>
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

      {(isAdmin || isAgent || votingActive) && (
        <Card
          title="Propose a resolution"
          subtitle="Any shareholder with active voting power can open a resolution. Voting power snapshots at the current block; voting opens immediately after."
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

      {loading ? (
        <Card>
          <div className="flex flex-col gap-3">
            <div className="skeleton h-24 rounded-md" />
            <div className="skeleton h-24 rounded-md" />
            <div className="skeleton h-24 rounded-md" />
          </div>
        </Card>
      ) : rows.length === 0 ? (
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
                      <Badge tone={row.passed ? "success" : "danger"}>
                        {row.passed ? "Passed" : row.quorumReached ? "Rejected" : "Rejected (no quorum)"}
                      </Badge>
                    ) : open ? (
                      <Badge tone="primary">Voting open</Badge>
                    ) : (
                      <Badge tone="muted">Awaiting settlement</Badge>
                    )}
                    {row.voted && <Badge tone="muted">You voted</Badge>}
                  </div>
                  <h3 className="mt-2 font-semibold">{row.description}</h3>
                  <p className="mt-1 text-xs text-muted">
                    Snapshot block {row.snapshot.toLocaleString("en-US")} - closes at block{" "}
                    {row.deadline.toLocaleString("en-US")}
                    {open && ` - current ${clock.toLocaleString("en-US")}`}
                  </p>
                  <p className="mt-1 text-xs text-faint">
                    {row.voterCount.toLocaleString("en-US")} {row.voterCount === 1 ? "voter" : "voters"}
                    {minVoters > 0 && ` - quorum needs ${minVoters}`}
                  </p>
                  <p className="mt-3 text-sm text-muted">
                    {row.resolved
                      ? row.quorumReached
                        ? `Final outcome: ${row.passed ? "Passed" : "Rejected"}. Exact vote weights remain encrypted.`
                        : "Rejected: the resolution did not reach quorum, so no tally was disclosed."
                      : row.tallyRequested
                        ? `Outcome proof handle: ${row.passedHandle.slice(2, 14)}...`
                        : "Vote direction and voting weight remain encrypted; exact totals are never disclosed."}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {open && !row.voted && (
                    <>
                      <Button
                        className="h-10"
                        disabled={!votingActive || !hasVotingPowerHandle}
                        onClick={() => vote(row.id, true)}
                      >
                        For
                      </Button>
                      <Button
                        variant="danger"
                        className="h-10"
                        disabled={!votingActive || !hasVotingPowerHandle}
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
