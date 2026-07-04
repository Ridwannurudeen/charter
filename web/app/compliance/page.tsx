"use client";

import { Search, ShieldCheck } from "lucide-react";
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
  shortAddress,
  txHashFrom,
} from "@/components/ui";
import { ADDRESSES, CONTRACTS_CONFIGURED, ZERO_ADDRESS } from "@/lib/contracts";
import { encryptU64 } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

type Notice = {
  label: string;
  hash: string | null;
};

type LookupResult = {
  address: string;
  accredited: boolean;
};

export default function CompliancePage() {
  return (
    <AppShell>
      <ConnectGate>
        <Compliance />
      </ConnectGate>
    </AppShell>
  );
}

function Compliance() {
  const { address, eip1193, registry, gatedIssuance, isAdmin, isAgent } = useWallet();
  const moduleConfigured =
    CONTRACTS_CONFIGURED && ADDRESSES.registry !== ZERO_ADDRESS && ADDRESSES.gatedIssuance !== ZERO_ADDRESS;
  const [registryAdmin, setRegistryAdmin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [accreditAddr, setAccreditAddr] = useState("");
  const [checkAddr, setCheckAddr] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [issueTo, setIssueTo] = useState("");
  const [issueAmount, setIssueAmount] = useState("25000");
  const [preflight, setPreflight] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!moduleConfigured) {
      setLoading(false);
      return;
    }
    if (!registry) return;
    setLoading(true);
    try {
      setRegistryAdmin(await registry.admin());
      setError(null);
    } catch (e) {
      setError(`Could not load registry state: ${errorText(e)}`);
    } finally {
      setLoading(false);
    }
  }, [moduleConfigured, registry]);

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

  const checkAccreditation = () =>
    run("Accreditation check", async () => {
      const accredited = await registry!.isAccredited(checkAddr);
      setLookup({ address: checkAddr, accredited });
      return null;
    });

  const setAccredited = (status: boolean) =>
    run(status ? "Accreditation" : "Accreditation revocation", async () =>
      (await registry!.setAccredited(accreditAddr, status)).wait(),
    );

  const issue = () =>
    run("Gated issuance", async () => {
      const accredited = await registry!.isAccredited(issueTo);
      if (!accredited) {
        setPreflight("This wallet has not been accredited yet. Accredit it before issuing encrypted shares.");
        throw new Error("IssuanceNotAccredited");
      }
      setPreflight(null);
      const { handle, inputProof } = await encryptU64(eip1193!, ADDRESSES.gatedIssuance, address!, BigInt(issueAmount));
      return (await gatedIssuance!.issue(issueTo, handle, inputProof)).wait();
    });

  const isIssuer = isAdmin || isAgent;
  const connectedIsRegistryAdmin = registryAdmin !== null && address?.toLowerCase() === registryAdmin.toLowerCase();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Compliant issuance"
        title="Mint only to wallets cleared in advance."
        description="This is a default-deny issuance gate, not a real identity-verification system. Accreditation happens off-chain first; the registry records the issuer's on-chain allowlist decision."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Registry mode"
          value="default-deny"
          trend="Only accredited wallets can receive gated issuance"
          mono={false}
        />
        <Stat
          label="Registry admin"
          value={registryAdmin ? shortAddress(registryAdmin) : loading ? "loading" : "unconfigured"}
          trend={connectedIsRegistryAdmin ? "Connected wallet" : "Public admin slot"}
        />
        <Stat
          label="Issue module"
          value={ADDRESSES.gatedIssuance === ZERO_ADDRESS ? "missing" : "wired"}
          trend="Agent-gated mint path"
          mono={false}
        />
      </div>

      {!moduleConfigured && (
        <Callout tone="info">
          The accreditation registry or gated issuance address is not configured for this build.
        </Callout>
      )}
      {preflight && <Callout tone="info">{preflight}</Callout>}
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
        {isAdmin && moduleConfigured && (
          <Card
            eyebrow="Registry admin"
            title="Accredit a wallet"
            subtitle="Mark a wallet as eligible, or revoke that status before any future issuance."
            variant="feature"
          >
            <div className="flex flex-col gap-4">
              <Field label="Wallet address">
                <Input placeholder="0x..." value={accreditAddr} onChange={(e) => setAccreditAddr(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button disabled={!accreditAddr} onClick={() => setAccredited(true)}>
                  <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Accredit
                </Button>
                <Button variant="ghost" disabled={!accreditAddr} onClick={() => setAccredited(false)}>
                  Revoke
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card
          eyebrow="Public check"
          title="Check accreditation"
          subtitle="Anyone can inspect whether a wallet is currently eligible for gated issuance."
          variant="raised"
        >
          <div className="flex flex-col gap-4">
            <Field label="Wallet address">
              <Input placeholder="0x..." value={checkAddr} onChange={(e) => setCheckAddr(e.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" disabled={!checkAddr || !moduleConfigured} onClick={checkAccreditation}>
                <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Check
              </Button>
              {lookup && (
                <Badge tone={lookup.accredited ? "success" : "danger"}>
                  {shortAddress(lookup.address)} {lookup.accredited ? "accredited" : "not accredited"}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {isIssuer && moduleConfigured && (
          <Card
            eyebrow="Issuer action"
            title="Issue to an accredited wallet"
            subtitle="The UI checks the registry first, then encrypts the amount against the gated issuance module."
            variant="feature"
            className="lg:col-span-2"
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_0.7fr_auto] lg:items-end">
              <Field label="Recipient">
                <Input placeholder="0x..." value={issueTo} onChange={(e) => setIssueTo(e.target.value)} />
              </Field>
              <Field label="Encrypted shares">
                <Input inputMode="numeric" value={issueAmount} onChange={(e) => setIssueAmount(e.target.value)} />
              </Field>
              <Button disabled={!issueTo || !issueAmount} onClick={issue}>
                Issue shares
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
