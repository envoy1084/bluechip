import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { NetworkCheck } from "../components/layout/NetworkCheck.tsx"
import { network } from "../lib/network.ts"
import { AnalyticsProvider } from "../providers/AnalyticsProvider.tsx"
import { AtomProvider } from "../providers/AtomProvider.tsx"
import { WalletProvider } from "../providers/WalletProvider.tsx"
import styles from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      // Paper money says so in every tab.
      { title: network === "sepolia" ? "bluechip paper" : "bluechip" },
      { name: "description", content: "Hire an agent. Set its limits. Let it trade." }
    ],
    links: [{ rel: "stylesheet", href: styles }]
  }),
  component: RootComponent
})

function RootComponent() {
  return (
    <RootDocument>
      <AtomProvider>
        <AnalyticsProvider>
          <WalletProvider>
            <Outlet />
            <NetworkCheck />
          </WalletProvider>
        </AnalyticsProvider>
      </AtomProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
