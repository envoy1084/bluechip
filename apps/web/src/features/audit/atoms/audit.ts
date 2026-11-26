import { AuditEvent, type AuditType } from "@bluechip/domain/audit/Audit"
import type { AgentId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Atom from "effect/reactivity/Atom"
import * as Schema from "effect/Schema"
import { BluechipApiClient, liveReactivityKey, securityReactivityKey } from "../../../lib/api/client.ts"

/** What the log shows: a kind of thing, an agent, and the days (`from` and `to`, `YYYY-MM-DD` in local time). */
export interface AuditFilter {
  readonly type: AuditType | null
  readonly agentId: AgentId | null
  readonly from: string | null
  readonly to: string | null
}

// A local day's start, and the start of the day after `to` so the last day is whole.
const startOf = (day: string, plusDays = 0) => {
  const date = new Date(`${day}T00:00:00`)
  date.setDate(date.getDate() + plusDays)
  return DateTime.fromDateUnsafe(date)
}

const queryOf = (filter: AuditFilter) => ({
  ...(filter.type === null ? {} : { type: filter.type }),
  ...(filter.agentId === null ? {} : { agentId: filter.agentId }),
  ...(filter.from === null ? {} : { from: startOf(filter.from) }),
  ...(filter.to === null ? {} : { to: startOf(filter.to, 1) })
})

/** One page of the log for a filter and page token (the key is both, as JSON), newest first. */
export const auditPageAtom = Atom.family((key: string) => {
  const { filter, pageToken } = JSON.parse(key) as { filter: AuditFilter; pageToken: string | null }
  return BluechipApiClient.query("audit", "list", {
    query: { ...queryOf(filter), pageSize: 50, ...(pageToken === null ? {} : { pageToken }) },
    reactivityKeys: [securityReactivityKey, liveReactivityKey]
  })
})

/** Everything the filter shows, as the JSON file the export saves. */
export const exportAuditAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(filter: AuditFilter) {
    const client = yield* BluechipApiClient
    const events = yield* client.audit.export({ query: queryOf(filter) })
    const encoded = yield* Schema.encodeEffect(Schema.toCodecJson(Schema.Array(AuditEvent)))(events)
    return JSON.stringify(encoded, null, 2)
  })
)
