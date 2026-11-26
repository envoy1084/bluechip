import type { Intent } from "@bluechip/domain/intents/Intent"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import { liveIntentsAtom } from "../../../lib/api/events.ts"

const newest = (live: Intent | undefined, intent: Intent): Intent =>
  live !== undefined && DateTime.isGreaterThanOrEqualTo(live.updatedAt, intent.updatedAt) ? live : intent

/** The newest of what we know about an intent: as it was given, or as a later `IntentChanged` reported it. */
export function useLatestIntent(intent: Intent): Intent {
  return newest(useAtomValue(liveIntentsAtom).get(intent.id), intent)
}

/** The newest of what we know about each of several intents, in their order. */
export function useLatestIntents(intents: ReadonlyArray<Intent>): ReadonlyArray<Intent> {
  const live = useAtomValue(liveIntentsAtom)
  return intents.map((intent) => newest(live.get(intent.id), intent))
}
