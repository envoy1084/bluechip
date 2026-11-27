import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { NetworkCheck } from "../components/layout/NetworkCheck.tsx"
import { siteHead } from "../lib/seo/head.ts"
import { AnalyticsProvider } from "../providers/AnalyticsProvider.tsx"
import { AtomProvider } from "../providers/AtomProvider.tsx"
import { WalletProvider } from "../providers/WalletProvider.tsx"
import styles from "../styles.css?url"

export const Route = createRootRoute({
  head: () => {
    const head = siteHead()
    return { meta: head.meta, links: [...head.links, { rel: "stylesheet", href: styles }] }
  },
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
