import type { ActivityKind, ActivityPeriod } from "@bluechip/domain/activity/Activity"
import * as Atom from "effect/reactivity/Atom"
import { BluechipApiClient, liveReactivityKey, portfolioReactivityKey } from "../lib/api/client.ts"

/** A kind and a period, then the page's token after the first: `"all 7d"`, `"all 7d <pageToken>"`. */
type ActivityQuery = `${typeof ActivityKind.Type} ${typeof ActivityPeriod.Type}${"" | ` ${string}`}`

/** A page of the user's activity for a kind and a period, newest first; refetched when their money moves. */
export const activityAtom = Atom.family((key: ActivityQuery) => {
  const [kind, period, pageToken = ""] = key.split(" ") as [
    typeof ActivityKind.Type,
    typeof ActivityPeriod.Type,
    string?
  ]
  return BluechipApiClient.query("activity", "list", {
    query: { kind, period, pageSize: 50, ...(pageToken === "" ? {} : { pageToken }) },
    reactivityKeys: [portfolioReactivityKey, liveReactivityKey]
  })
})
