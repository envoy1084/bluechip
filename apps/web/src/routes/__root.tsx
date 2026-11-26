import { themeScript } from "@bluechip/ui/lib/theme"
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { AtomProvider } from "../providers/AtomProvider.tsx"
import { WalletProvider } from "../providers/WalletProvider.tsx"
import styles from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "bluechip" },
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
        <WalletProvider>
          <Outlet />
        </WalletProvider>
      </AtomProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The theme script sets `data-theme` before hydration, so React must not flag the attribute it didn't render.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
