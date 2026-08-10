"use client";

import { createConfig, http } from "wagmi";
import { studionet } from "genlayer-js/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [studionet],
  connectors: [injected()],
  transports: {
    [studionet.id]: http(process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || undefined),
  },
  ssr: true,
});
