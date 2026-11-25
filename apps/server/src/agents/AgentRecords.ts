import { Agent } from "@bluechip/domain/agents/Agent"
import { Limits } from "@bluechip/domain/agents/Limits"
import type { AgentId } from "@bluechip/domain/Ids"
import * as Schema from "effect/Schema"
import type { agents } from "../db/schema/agents.ts"

export type AgentRow = typeof agents.$inferSelect

const LimitsJson = Schema.toCodecJson(Limits)

/** Limits as stored (JSON, amounts as strings). */
export const encodeLimits = (limits: Limits): unknown => Schema.encodeSync(LimitsJson)(limits)

/** Limits as stored, back to `Limits`. */
export const decodeLimits = (stored: unknown): Limits => Schema.decodeUnknownSync(LimitsJson)(stored)

/** An agent as the API returns it: its grant and key stay on the server. */
export const toAgent = (row: AgentRow): Agent =>
  new Agent({
    id: row.id as AgentId,
    name: row.name,
    template: row.template,
    status: row.status,
    paused: row.paused,
    limits: decodeLimits(row.limits),
    pendingLimits: row.pendingLimits === null ? null : decodeLimits(row.pendingLimits),
    lockedUntil: row.lockedUntil,
    createdAt: row.createdAt
  })
