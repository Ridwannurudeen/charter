"use client";

import { ZeroAddress } from "ethers";
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
  TxLink,
  errorText,
  formatUnits6,
  shortAddress,
  txHashFrom,
} from "@/components/ui";
import { ADDRESSES, CONTRACTS_CONFIGURED } from "@/lib/contracts";
import { encryptU64 } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

type Notice = {
  label: string;
  hash: string | null;
};

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
  const { address, eip1193, shares, mcUSD, distributor, demoFaucet } = useWallet();
  const [shareHandle, setShareHandle] = useState<string | null>(null);
  const [usdHandle, setUsdHandle] = useState<string | null>(null);
  const [delegatee, setDelegatee] = useState<string | null>(null);
  const [observer, setObserver] = useState<string | null>(null);
  const [demoClaimed, setDemoClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [distributionCount, setDistributionCount] = useState(0n);
  const [latestDistributionClaimed, setLatestDistributionClaimed] = useState(false);

  const refresh = useCallback(async () => {
    if (!CONTRACTS_CONFIGURED) {
      setLoading(false);
      return;
    }
    if (!shares || !mcUSD || !address) return;
    setLoading(true);
    try {
      const distCount = distributor ? await distributor.distributionCount() : 0n;
      const latestId = distCount > 0n ? distCount - 1n : 0n;
      const isLatestClaimed = distCount > 0n && distributor ? await distributor.paid(latestId, address) : false;
      const [sh, uh, del, obs, claimed] = await Promise.all([
        shares.confidentialBalanceOf(address),
        mcUSD.confidentialBalanceOf(address),
        shares.delegates(address),
        shares.observer(address),
        demoFaucet ? demoFaucet.claimed(address) : false,
      ]);
      setShareHandle(sh);
      setUsdHandle(uh);
      setDelegatee(del);
      setObserver(obs);
      setDemoClaimed(claimed);
      setDistributionCount(distCount);
      setLatestDistributionClaimed(Boolean(isLatestClaimed));
      setError(null);
    } catch (e) {
      setError(`Could not load registry state: ${errorText(e)}`);
    } finally {
      setLoading(false);
    }
  }, [shares, mcUSD, distributor, demoFaucet, address]);

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

  const votingActive = delegatee !== null && delegatee !== ZeroAddress;
  const hasObserver = observer !== null && observer !== ZeroAddress;

  const [claimDistributionId, setClaimDistributionId] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [observerAddr, setObserverAddr] = useState("");
  const latestDistributionId =
    distributionCount > 0n ? (distributionCount - 1n).toString() : "No active distribution yet";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Investor portal"
        title="Decrypt your stake. Keep the ledger private."
        description={
          <>
            Your positions are encrypted on-chain. Decryption happens in your browser, authorized by one wallet
            signature - nothing is revealed publicly.
          </>
        }
      />

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          eyebrow="Encrypted position"
          title="My shareholding"
          subtitle="Charter Demo Corp common shares (CDC-S)"
          variant="feature"
          className="lg:col-span-2"
        >
          {loading ? (
            <div className="skeleton h-12 w-72 rounded-md" />
          ) : (
            <EncryptedValue
              handle={shareHandle}
              contractAddress={ADDRESSES.shares}
              suffix="shares"
              label="Decrypt my stake"
              emptyText="No shares issued to this wallet yet. Use the demo share faucet below."
            />
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
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
                  size="sm"
                  className="h-9"
                  onClick={() => run("Voting activation", async () => (await shares!.delegate(address)).wait())}
                >
                  Activate voting power
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card
          eyebrow="Self-serve demo"
          title="Demo share faucet"
          subtitle="Claim once to become a shareholder in the self-serve Sepolia demo."
          variant="raised"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              The faucet grants 1,000 encrypted CDC-S shares to the connected wallet, then blocks repeat claims.
            </p>
            <Button
              disabled={demoClaimed || ADDRESSES.demoFaucet === ZeroAddress}
              onClick={() => run("Demo share claim", async () => (await demoFaucet!.claim()).wait())}
            >
              {demoClaimed ? "Demo shares claimed" : "Claim demo shares"}
            </Button>
          </div>
        </Card>

        <Card
          eyebrow="Confidential payouts"
          title="My distributions"
          subtitle="Confidential USD received from dividend waterfalls"
          variant="raised"
        >
          <div className="flex flex-col gap-5">
            {loading ? (
              <div className="skeleton h-8 w-56 rounded-md" />
            ) : (
              <EncryptedValue
                handle={usdHandle}
                contractAddress={ADDRESSES.mcUSD}
                format={formatUnits6}
                suffix="mcUSD"
                label="Decrypt my payouts"
                emptyText="No encrypted payout yet. Claim test mcUSD or wait for a distribution."
              />
            )}
            <Field
              label="Distribution ID"
              helper={`Latest available: ${latestDistributionId} - unclaim each distribution once`}
            >
              <Input
                placeholder={latestDistributionId}
                inputMode="numeric"
                value={claimDistributionId}
                onChange={(e) => setClaimDistributionId(e.target.value)}
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => run("mcUSD faucet", async () => (await mcUSD!.faucet()).wait())}
            >
              Claim 10,000 mcUSD (test)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!distributor || distributionCount === 0n}
              onClick={() =>
                run("Dividend claim", async () => {
                  if (!distributor || distributionCount === 0n) {
                    throw new Error("No distribution has been declared yet");
                  }
                  const id = claimDistributionId ? BigInt(claimDistributionId) : distributionCount - 1n;
                  if (await distributor.paid(id, address!)) {
                    throw new Error("This distribution has already been claimed by this wallet");
                  }
                  return (await distributor.claim(id)).wait();
                })
              }
            >
              {latestDistributionClaimed ? "Claim already submitted" : "Claim distribution payout"}
            </Button>
          </div>
        </Card>

        <Card
          eyebrow="Encrypted transfer"
          title="Transfer shares"
          subtitle="Amounts are encrypted client-side before they touch the chain. Transfers respect the issuer's compliance policy."
        >
          <div className="flex flex-col gap-4">
            <Field label="Recipient">
              <Input placeholder="0x..." value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
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
          eyebrow="Observer access"
          title="Auditor access"
          subtitle="Appoint an observer - an auditor or regulator - with standing access to decrypt your positions. Revocable by setting the zero address; revocation stops future access, but values already shared remain decryptable by the former observer."
        >
          {hasObserver && (
            <div className="mb-4">
              <Badge tone="primary">Observer: {shortAddress(observer!)}</Badge>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <Field label="Observer address" helper="They can decrypt your balance and transfer amounts - nothing else.">
              <Input placeholder="0x..." value={observerAddr} onChange={(e) => setObserverAddr(e.target.value)} />
            </Field>
            <Button
              variant="ghost"
              size="sm"
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
