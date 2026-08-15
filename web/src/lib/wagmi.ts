"use client";

import { createConfig, http } from "wagmi";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [testnetBradbury, studionet],
  connectors: [injected()],
  transports: {
    [testnetBradbury.id]: http(process.env.NEXT_PUBLIC_GENLAYER_GAME_RPC_URL || undefined),
    [studionet.id]: http(process.env.NEXT_PUBLIC_GENLAYER_GAME_RPC_URL || undefined),
  },
  ssr: true,
});
