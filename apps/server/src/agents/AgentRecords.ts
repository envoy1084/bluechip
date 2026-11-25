import { Agent, AgentSession } from "@bluechip/domain/agents/Agent"
import type { AgentId, AgentSessionId } from "@bluechip/domain/Ids"
import { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import * as Schema from "effect/Schema"
import type { agents, agentSessions } from "../db/schema/agents.ts"

export type AgentRow = typeof agents.$inferSelect
export type SessionRow = typeof agentSessions.$inferSelect

const SpecJson = Schema.toCodecJson(AgentSpec)

/** A spec as stored (JSON, amounts as strings). */
export const encodeSpec = (spec: AgentSpec): unknown => Schema.encodeSync(SpecJson)(spec)

/** A spec as stored, back to `AgentSpec`. */
export const decodeSpec = (stored: unknown): AgentSpec => Schema.decodeUnknownSync(SpecJson)(stored)

/** A session as the API returns it: its key, grant and operation stay on the server. */
export const toSession = (row: SessionRow): AgentSession =>
  new AgentSession({
    id: row.id as AgentSessionId,
    status: row.status,
    spec: decodeSpec(row.spec),
    createdBy: row.createdBy,
    validUntil: row.validUntil,
    createdAt: row.createdAt,
    installedAt: row.installedAt,
    endedAt: row.endedAt
  })

/**
 * An agent as the API returns it, from its row and its sessions: the policies in force (a draft's are the ones it will
 * lock) and a change on its way.
 */
export const toAgent = (row: AgentRow, sessions: ReadonlyArray<SessionRow>): Agent => {
  const current = sessions.find((session) => session.id === row.currentSessionId)
  const pending = sessions.find((session) => session.id === row.pendingSessionId)
  const inForce = current ?? pending!
  return new Agent({
    id: row.id as AgentId,
    name: row.name,
    template: row.templateId,
    status: row.status,
    paused: row.paused,
    spec: decodeSpec(inForce.spec),
    pendingSpec: current !== undefined && pending !== undefined ? decodeSpec(pending.spec) : null,
    lockedUntil: current?.validUntil ?? null,
    createdAt: row.createdAt
  })
}
