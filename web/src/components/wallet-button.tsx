"use client";

import { Wallet } from "lucide-react";
import { useState } from "react";
import { formatEther } from "viem";
import { useAccount, useBalance, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { genLayerGameConfig } from "@/lib/genlayer-game";

export function WalletButton() {
  const [open, setOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { connectors, connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  const wrongNetwork = isConnected && chainId !== genLayerGameConfig.chainId;

  return <div className="wallet-menu">
    <button className={`wallet-button ${wrongNetwork ? "is-wrong-network" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Open wallet controls">
      {isConnected ? <><span className="wallet-status" />{wrongNetwork ? "Wrong network" : `${address?.slice(0, 4)}…${address?.slice(-3)}`}</> : <><Wallet size={13} strokeWidth={2.2} />Connect</>}
    </button>
    {open && <div className="wallet-popover" role="dialog" aria-label="Wallet controls">
      {!isConnected ? <>
        <strong>Choose wallet</strong>
        {connectors.map((connector) => <button key={connector.uid} onClick={() => { connect({ connector }); setOpen(false); }}>{connector.name}</button>)}
        {!connectors.length && <p>No compatible browser wallet was detected.</p>}
      </> : <>
        <strong>{address?.slice(0, 8)}…{address?.slice(-6)}</strong>
        <p>{balance ? `${Number(formatEther(balance.value)).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${balance.symbol}` : "Balance loading…"}</p>
        {wrongNetwork && <button onClick={() => switchChain({ chainId: genLayerGameConfig.chainId })}>Switch to {genLayerGameConfig.network}</button>}
        <a href="https://testnet-faucet.genlayer.foundation/" target="_blank" rel="noreferrer">Get testnet GEN</a>
        <button onClick={() => { disconnect(); setOpen(false); }}>Disconnect</button>
      </>}
      {connectError && <p className="error-message">{connectError.message}</p>}
    </div>}
  </div>;
}
