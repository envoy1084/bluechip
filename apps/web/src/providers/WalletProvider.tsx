import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { WagmiProvider } from "wagmi"
import { wagmiConfig } from "../wallet/config.ts"

/** wagmi for connecting outside wallets (deposits from a wallet you already have); wagmi needs its own query client. */
export function WalletProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
