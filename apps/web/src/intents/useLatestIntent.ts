import type { Intent } from "@bluechip/domain/intents/Intent"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import { liveIntentsAtom } from "../api/events.ts"

/** The newest of what we know about an intent: as it was given, or as a later `IntentChanged` reported it. */
export function useLatestIntent(intent: Intent): Intent {
  const live = useAtomValue(liveIntentsAtom).get(intent.id)
  return live !== undefined && DateTime.isGreaterThanOrEqualTo(live.updatedAt, intent.updatedAt) ? live : intent
}
