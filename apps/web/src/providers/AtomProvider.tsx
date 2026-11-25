import { RegistryProvider } from "@effect/atom-react/RegistryContext"
import type { ReactNode } from "react"

/** One atom registry for the whole app, so every component shares query results and the live stream. */
export function AtomProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <RegistryProvider>{children}</RegistryProvider>
}
