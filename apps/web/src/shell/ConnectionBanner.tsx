import { Alert, AlertAction, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { connectionAtom } from "../api/events.ts"

/** Says when live updates are paused, and when this version of the app must reload. Hidden while connected. */
export function ConnectionBanner() {
  const connection = useAtomValue(connectionAtom)
  if (connection === "outdated") {
    return (
      <Alert variant="warning">
        <AlertTitle>A new version of bluechip is ready</AlertTitle>
        <AlertDescription>Reload to keep using the app.</AlertDescription>
        <AlertAction>
          <Button size="sm" onClick={() => window.location.reload()}>Reload</Button>
        </AlertAction>
      </Alert>
    )
  }
  if (connection === "reconnecting") {
    return (
      <Alert variant="info">
        <AlertTitle>Reconnecting…</AlertTitle>
        <AlertDescription>Prices and activity will update again once we're back.</AlertDescription>
      </Alert>
    )
  }
  return null
}
