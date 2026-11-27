import { Empty, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { ClientOnly } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { versionAtom } from "../../atoms/system.ts"
import { network, NETWORK_NAMES } from "../../lib/network.ts"

/**
 * Covers the app when its server runs on another network than the one it was built for (`VITE_NETWORK`): addresses,
 * prices and money would not match, so nothing may be signed. Nothing shows while the server agrees or can't be
 * reached (the pages say so themselves).
 */
export function NetworkCheck() {
  return (
    <ClientOnly>
      <Mismatch />
    </ClientOnly>
  )
}

function Mismatch() {
  const version = useAtomValue(versionAtom)
  if (!AsyncResult.isSuccess(version) || version.value.network === network) return null

  return (
    <div role="alert" className="fixed inset-0 z-50 grid place-items-center bg-canvas px-4">
      <Empty>
        <EmptyTitle>This app and its server are on different networks</EmptyTitle>
        <EmptyDescription>
          This app is built for {NETWORK_NAMES[network]}, but its server runs on{" "}
          {NETWORK_NAMES[version.value.network]}. Nothing was sent. Open the app that matches the server, or build this
          one with VITE_NETWORK=
          {version.value.network}.
        </EmptyDescription>
      </Empty>
    </div>
  )
}
