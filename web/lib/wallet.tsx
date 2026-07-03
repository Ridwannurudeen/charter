"use client";

import { BrowserProvider, Contract, Eip1193Provider, JsonRpcSigner } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  ADDRESSES,
  DEMO_FAUCET_ABI,
  DISTRIBUTOR_ABI,
  MCUSD_ABI,
  RESOLUTIONS_ABI,
  SEPOLIA_CHAIN_ID,
  SHARES_ABI,
  TENDER_ABI,
} from "./contracts";

type WalletState = {
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  connect: () => Promise<void>;
  eip1193: Eip1193Provider | null;
  signer: JsonRpcSigner | null;
  demoFaucet: Contract | null;
  shares: Contract | null;
  mcUSD: Contract | null;
  distributor: Contract | null;
  resolutions: Contract | null;
  tender: Contract | null;
  isAdmin: boolean;
  isAgent: boolean;
  refreshRoles: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, cb: (arg: never) => void) => void;
      removeListener?: (event: string, cb: (arg: never) => void) => void;
    };
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgent, setIsAgent] = useState(false);

  const eip1193 = typeof window !== "undefined" ? (window.ethereum ?? null) : null;

  const setup = useCallback(async (request: boolean) => {
    if (!window.ethereum) return;
    setConnecting(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts: string[] = await provider.send(request ? "eth_requestAccounts" : "eth_accounts", []);
      if (accounts.length === 0) return;

      const network = await provider.getNetwork();
      let currentChain = Number(network.chainId);
      if (request && currentChain !== SEPOLIA_CHAIN_ID) {
        await provider.send("wallet_switchEthereumChain", [{ chainId: "0x" + SEPOLIA_CHAIN_ID.toString(16) }]);
        currentChain = SEPOLIA_CHAIN_ID;
      }

      const s = await provider.getSigner();
      setSigner(s);
      setAddress(await s.getAddress());
      setChainId(currentChain);
    } catch {
      // User rejected the connection/switch, or the provider is unavailable — leave state unchanged.
    } finally {
      setConnecting(false);
    }
  }, []);

  const connect = useCallback(() => setup(true), [setup]);

  useEffect(() => {
    // Restore an existing wallet connection on mount, and re-sync on account/chain changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void setup(false);
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onChange = () => void setup(false);
    eth.on("accountsChanged", onChange);
    eth.on("chainChanged", onChange);
    return () => {
      eth.removeListener?.("accountsChanged", onChange);
      eth.removeListener?.("chainChanged", onChange);
    };
  }, [setup]);

  const onSepolia = chainId === SEPOLIA_CHAIN_ID;
  const shares = useMemo(
    () => (signer && onSepolia ? new Contract(ADDRESSES.shares, SHARES_ABI, signer) : null),
    [signer, onSepolia],
  );
  const mcUSD = useMemo(
    () => (signer && onSepolia ? new Contract(ADDRESSES.mcUSD, MCUSD_ABI, signer) : null),
    [signer, onSepolia],
  );
  const distributor = useMemo(
    () => (signer && onSepolia ? new Contract(ADDRESSES.distributor, DISTRIBUTOR_ABI, signer) : null),
    [signer, onSepolia],
  );
  const resolutions = useMemo(
    () => (signer && onSepolia ? new Contract(ADDRESSES.resolutions, RESOLUTIONS_ABI, signer) : null),
    [signer, onSepolia],
  );
  const demoFaucet = useMemo(
    () => (signer && onSepolia ? new Contract(ADDRESSES.demoFaucet, DEMO_FAUCET_ABI, signer) : null),
    [signer, onSepolia],
  );
  const tender = useMemo(
    () => (signer && onSepolia ? new Contract(ADDRESSES.tender, TENDER_ABI, signer) : null),
    [signer, onSepolia],
  );

  const refreshRoles = useCallback(async () => {
    if (!shares || !address) {
      setIsAdmin(false);
      setIsAgent(false);
      return;
    }
    try {
      const [admin, agent] = await Promise.all([shares.isAdmin(address), shares.isAgent(address)]);
      setIsAdmin(admin);
      setIsAgent(agent);
    } catch {
      setIsAdmin(false);
      setIsAgent(false);
    }
  }, [shares, address]);

  useEffect(() => {
    // Re-read admin/agent roles whenever the connected account or contract binding changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshRoles();
  }, [refreshRoles]);

  const value = useMemo(
    () => ({
      address,
      chainId,
      connecting,
      connect,
      eip1193,
      signer,
      demoFaucet,
      shares,
      mcUSD,
      distributor,
      resolutions,
      tender,
      isAdmin,
      isAgent,
      refreshRoles,
    }),
    [
      address,
      chainId,
      connecting,
      connect,
      eip1193,
      signer,
      demoFaucet,
      shares,
      mcUSD,
      distributor,
      resolutions,
      tender,
      isAdmin,
      isAgent,
      refreshRoles,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
