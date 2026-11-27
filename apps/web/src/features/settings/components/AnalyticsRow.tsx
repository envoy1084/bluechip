import { Switch } from "@bluechip/ui/components/switch"
import { useSyncExternalStore } from "react"
import { SettingsRow as Row } from "../../../components/layout/SettingsSection.tsx"
import { analyticsOptedOut, setAnalyticsOptOut, subscribeAnalyticsOptOut } from "../../../lib/analytics.ts"

/**
 * Product analytics on this browser: what you open and tap, and replays of the screen with what you type hidden. The
 * choice is kept in this browser (the account has no setting for it yet).
 */
export function AnalyticsRow() {
  const optedOut = useSyncExternalStore(subscribeAnalyticsOptOut, analyticsOptedOut, () => false)

  return (
    <Row
      title="Product analytics"
      description="Helps us see where bluechip is hard to use. Replays never show what you type. Applies to this browser."
    >
      <Switch
        aria-label="Product analytics"
        checked={!optedOut}
        onCheckedChange={(on) => setAnalyticsOptOut(!on)}
      />
    </Row>
  )
}
