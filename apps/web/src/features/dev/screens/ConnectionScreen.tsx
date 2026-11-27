import type { ServerVersion } from "@bluechip/domain/api/SystemApi"
import { Badge } from "@bluechip/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bluechip/ui/components/card"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { versionAtom } from "../../../atoms/system.ts"
import { ConnectionBanner } from "../../../components/layout/ConnectionBanner.tsx"
import { type Connection, connectionAtom, heartbeatAtom } from "../../../lib/api/events.ts"

const connectionBadge: Record<
  Connection,
  { readonly label: string; readonly variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  connecting: { label: "Connecting", variant: "secondary" },
  live: { label: "Live", variant: "success" },
  reconnecting: { label: "Reconnecting", variant: "warning" },
  outdated: { label: "Outdated", variant: "destructive" },
  signedOut: { label: "Signed out", variant: "secondary" }
}

export function ConnectionScreen() {
  const version = useAtomValue(versionAtom)
  const heartbeat = useAtomValue(heartbeatAtom)
  const connection = connectionBadge[useAtomValue(connectionAtom)]
  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <div className="grid gap-2">
        <h1 className="text-display-3 font-semibold">Connection</h1>
        <p className="text-body text-g-600">
          The web app talking to the server through <code>/api</code>.
        </p>
      </div>
      <ConnectionBanner />
      <Card>
        <CardHeader>
          <CardTitle>Server</CardTitle>
          <CardDescription>GET /api/version</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerVersionDetails version={version} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Live events</CardTitle>
          <CardDescription>GET /api/events</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <span className="text-caption text-g-500">Heartbeats</span>
            <NumberRoll
              className="text-display-3 font-semibold"
              value={heartbeat === undefined ? 0 : heartbeat.sequence + 1}
            />
          </div>
          <Badge variant={connection.variant}>{connection.label}</Badge>
        </CardContent>
      </Card>
    </div>
  )
}

function ServerVersionDetails({ version }: Readonly<{ version: AsyncResult.AsyncResult<ServerVersion, unknown> }>) {
  if (AsyncResult.isInitial(version)) return <p className="text-g-500">Loading…</p>
  if (AsyncResult.isFailure(version)) return <p className="text-loss">Couldn't reach the server.</p>
  const { value } = version
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-body">
      <dt className="text-g-500">Release</dt>
      <dd>{value.version}</dd>
      <dt className="text-g-500">Contract</dt>
      <dd>v{value.contract}</dd>
      <dt className="text-g-500">Network</dt>
      <dd>{value.network}</dd>
      <dt className="text-g-500">Server time</dt>
      <dd>{DateTime.formatIso(value.serverTime)}</dd>
    </dl>
  )
}
