"use client";

import type { Eip1193Provider, Signer } from "ethers";

// Types are structural — the SDK is only ever loaded dynamically client-side
// (it initializes WASM and touches window at import time).
type FhevmInstance = {
  createEncryptedInput(
    contractAddress: string,
    userAddress: string,
  ): {
    add64(value: bigint | number): void;
    addBool(value: boolean): void;
    encrypt(): Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
  };
  generateKeypair(): { publicKey: string; privateKey: string };
  createEIP712(
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number,
  ): {
    domain: Record<string, unknown>;
    types: Record<string, { name: string; type: string }[]>;
    message: Record<string, unknown>;
  };
  userDecrypt(
    handles: { handle: string; contractAddress: string }[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number,
  ): Promise<Record<string, bigint | boolean | string>>;
  publicDecrypt(handles: string[]): Promise<{
    clearValues: Readonly<Record<string, bigint | boolean | string>>;
    decryptionProof: `0x${string}`;
  }>;
};

let instancePromise: Promise<FhevmInstance> | null = null;

export function getFhevm(provider: Eip1193Provider): Promise<FhevmInstance> {
  if (!instancePromise) {
    instancePromise = (async () => {
      const sdk = await import("@zama-fhe/relayer-sdk/web");
      await sdk.initSDK();
      const instance = await sdk.createInstance({ ...sdk.SepoliaConfig, network: provider });
      return instance as unknown as FhevmInstance;
    })();
    instancePromise.catch(() => {
      instancePromise = null; // allow retry after a failed init
    });
  }
  return instancePromise;
}

export async function encryptU64(
  provider: Eip1193Provider,
  contract: string,
  user: string,
  value: bigint,
): Promise<{ handle: string; inputProof: string }> {
  const fhevm = await getFhevm(provider);
  const input = fhevm.createEncryptedInput(contract, user);
  input.add64(value);
  const { handles, inputProof } = await input.encrypt();
  return { handle: toHex(handles[0]), inputProof: toHex(inputProof) };
}

export async function encryptBool(
  provider: Eip1193Provider,
  contract: string,
  user: string,
  value: boolean,
): Promise<{ handle: string; inputProof: string }> {
  const fhevm = await getFhevm(provider);
  const input = fhevm.createEncryptedInput(contract, user);
  input.addBool(value);
  const { handles, inputProof } = await input.encrypt();
  return { handle: toHex(handles[0]), inputProof: toHex(inputProof) };
}

const DECRYPT_SESSION_DAYS = 1;

/**
 * Decrypts handles the connected user has ACL access to, via the EIP-712
 * user-decryption flow. One wallet signature authorizes a 1-day session over
 * the given contracts; the keypair lives in sessionStorage.
 */
export async function userDecrypt(
  provider: Eip1193Provider,
  signer: Signer,
  userAddress: string,
  pairs: { handle: string; contractAddress: string }[],
): Promise<Record<string, bigint | boolean | string>> {
  const fhevm = await getFhevm(provider);
  const contracts = [...new Set(pairs.map((p) => p.contractAddress))];

  const cacheKey = `charter.decrypt.${userAddress}.${contracts.sort().join(",")}`;
  const cached = sessionStorage.getItem(cacheKey);
  let session: {
    publicKey: string;
    privateKey: string;
    signature: string;
    startTimestamp: number;
  };

  if (cached) {
    session = JSON.parse(cached);
    const expired = (session.startTimestamp + DECRYPT_SESSION_DAYS * 86400) * 1000 < Date.now() + 60_000;
    if (expired) sessionStorage.removeItem(cacheKey);
    if (expired) session = await newSession();
  } else {
    session = await newSession();
  }

  async function newSession() {
    const { publicKey, privateKey } = fhevm.generateKeypair();
    const startTimestamp = Math.floor(Date.now() / 1000);
    const eip712 = fhevm.createEIP712(publicKey, contracts, startTimestamp, DECRYPT_SESSION_DAYS);
    const types = Object.fromEntries(Object.entries(eip712.types).filter(([k]) => k !== "EIP712Domain"));
    const signature = await signer.signTypedData(
      eip712.domain as Parameters<Signer["signTypedData"]>[0],
      types,
      eip712.message,
    );
    const s = { publicKey, privateKey, signature, startTimestamp };
    sessionStorage.setItem(cacheKey, JSON.stringify(s));
    return s;
  }

  return fhevm.userDecrypt(
    pairs,
    session.privateKey,
    session.publicKey,
    session.signature,
    contracts,
    userAddress,
    session.startTimestamp,
    DECRYPT_SESSION_DAYS,
  );
}

export async function publicDecrypt(provider: Eip1193Provider, handles: string[]) {
  const fhevm = await getFhevm(provider);
  return fhevm.publicDecrypt(handles);
}

function toHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
