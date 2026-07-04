"use client";

import { EyeOff, LockKeyhole, RotateCcw } from "lucide-react";
import { useState } from "react";

import { ZERO_HANDLE } from "@/lib/contracts";
import { userDecrypt } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

import { Spinner } from "./ui";

/**
 * The signature interaction: an encrypted on-chain value shown as a redacted
 * ciphertext bar until the holder authorizes an EIP-712 user decryption, then
 * the cleartext reveals in place. Decryption happens client-side; nothing is
 * published.
 */
export function EncryptedValue({
  handle,
  contractAddress,
  format = (v) => v.toLocaleString("en-US"),
  suffix = "",
  label = "Decrypt",
  emptyText = "No shares issued to this wallet yet. Use the demo share faucet below.",
}: {
  handle: string | null;
  contractAddress: string;
  format?: (value: bigint) => string;
  suffix?: string;
  label?: string;
  emptyText?: string;
}) {
  const { eip1193, signer, address } = useWallet();
  const [clear, setClear] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Decrypting");
  const [error, setError] = useState<string | null>(null);

  if (!handle || handle === ZERO_HANDLE) {
    return <span className="text-sm leading-relaxed text-faint">{emptyText}</span>;
  }

  if (clear !== null) {
    return (
      <span className="inline-flex flex-wrap items-center gap-3">
        <span className="reveal-in font-mono text-2xl font-semibold text-foreground tabular">
          {format(clear)}
          {suffix && <span className="ml-2 text-sm font-normal text-muted">{suffix}</span>}
        </span>
        <button
          type="button"
          onClick={() => setClear(null)}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 text-xs font-medium text-muted transition-colors duration-150 hover:border-cipher hover:text-cipher"
        >
          <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Hide
        </button>
      </span>
    );
  }

  const decrypt = async () => {
    if (!eip1193 || !signer || !address) return;
    setBusy(true);
    setBusyLabel("Awaiting signature");
    setError(null);
    try {
      setBusyLabel("Decrypting in browser");
      const results = await userDecrypt(eip1193, signer, address, [{ handle, contractAddress }]);
      const value = results[handle];
      if (typeof value !== "bigint") throw new Error("unexpected decryption result");
      setClear(value);
    } catch {
      setError("Decryption failed - you may not have access to this value.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-2 rounded-md border border-cipher/25 bg-cipher/5 px-3 py-2">
        <LockKeyhole className="h-4 w-4 text-cipher" strokeWidth={1.75} aria-hidden="true" />
        <span className="cipher h-5 w-36 font-mono text-sm" aria-label="encrypted value">
          {handle.slice(2, 18)}...
        </span>
      </span>
      <button
        onClick={decrypt}
        disabled={busy}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-cipher/40 bg-surface-2 px-3 text-xs font-semibold text-cipher transition-colors duration-150 hover:bg-cipher/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Spinner /> : <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />}
        {busy ? busyLabel : label}
      </button>
      {!busy && (
        <span className="max-w-sm text-xs leading-relaxed text-faint">
          One EIP-712 signature authorizes a 1-day private decryption session.
        </span>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
