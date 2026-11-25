import type { ActivityKind, ActivityPeriod } from "@bluechip/domain/activity/Activity"
import * as Atom from "effect/reactivity/Atom"
import { BluechipApiClient, liveReactivityKey, portfolioReactivityKey } from "../lib/api/client.ts"

type ActivityQuery = `${typeof ActivityKind.Type} ${typeof ActivityPeriod.Type}`

/** The user's activity for a kind and a period, newest first; refetched when their money moves. */
export const activityAtom = Atom.family((key: ActivityQuery) => {
  const [kind, period] = key.split(" ") as [typeof ActivityKind.Type, typeof ActivityPeriod.Type]
  return BluechipApiClient.query("activity", "list", {
    query: { kind, period, pageSize: 50 },
    reactivityKeys: [portfolioReactivityKey, liveReactivityKey]
  })
})
