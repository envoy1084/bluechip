import type { ActivityKind, ActivityPeriod } from "@bluechip/domain/activity/Activity"
import * as Atom from "effect/reactivity/Atom"
import { activityAtom } from "../../../atoms/activity.ts"

/**
 * The pages of activity loaded so far for a kind and a period, read together so the list and its totals cover the
 * same items: `"<kind> <period> <pageToken> <pageToken>…"`, the first token empty.
 */
export const activityPagesAtom = Atom.family((key: string) => {
  const [kind, period, ...pageTokens] = key.split(" ") as [
    typeof ActivityKind.Type,
    typeof ActivityPeriod.Type,
    ...Array<string>
  ]
  return Atom.make((get) =>
    pageTokens.map((pageToken) =>
      get(activityAtom(pageToken === "" ? `${kind} ${period}` : `${kind} ${period} ${pageToken}`))
    )
  )
})
