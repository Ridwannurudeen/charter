"use client";

import { useState } from "react";

import { ZERO_HANDLE } from "@/lib/contracts";
import { userDecrypt } from "@/lib/fhevm";
import { useWallet } from "@/lib/wallet";

import { Spinner } from "./ui";

/**
 * The signature interaction: an encrypted on-chain value shown as shimmering
 * ciphertext until the holder authorizes an EIP-712 user decryption, then the
 * cleartext reveals in place. Decryption happens client-side; nothing is
 * published.
 */
export function EncryptedValue({
  handle,
  contractAddress,
  format = (v) => v.toLocaleString("en-US"),
  suffix = "",
  label = "Decrypt",
}: {
  handle: string | null;
  contractAddress: string;
  format?: (value: bigint) => string;
  suffix?: string;
  label?: string;
}) {
  const { eip1193, signer, address } = useWallet();
  const [clear, setClear] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!handle || handle === ZERO_HANDLE) {
    return <span className="font-mono text-sm text-faint">— no encrypted value —</span>;
  }

  if (clear !== null) {
    return (
      <span className="reveal-in font-mono text-lg text-foreground tabular">
        {format(clear)}
        {suffix && <span className="ml-1 text-sm text-muted">{suffix}</span>}
      </span>
    );
  }

  const decrypt = async () => {
    if (!eip1193 || !signer || !address) return;
    setBusy(true);
    setError(null);
    try {
      const results = await userDecrypt(eip1193, signer, address, [{ handle, contractAddress }]);
      const value = results[handle];
      if (typeof value !== "bigint") throw new Error("unexpected decryption result");
      setClear(value);
    } catch {
      setError("Decryption failed — you may not have access to this value.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <span className="cipher font-mono text-sm" aria-label="encrypted value">
        {handle.slice(2, 18)}…
      </span>
      <button
        onClick={decrypt}
        disabled={busy}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-primary/40 px-2.5 text-xs font-medium text-primary-bright transition-colors duration-150 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <Spinner />
        ) : (
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 018 0" />
          </svg>
        )}
        {label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
