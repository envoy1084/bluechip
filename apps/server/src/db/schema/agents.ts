import { boolean, index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../columns.ts"
import { users } from "./accounts.ts"

const AGENT_STATUSES = ["draft", "locking", "active", "updating", "removing", "removed"] as const
const SESSION_STATUSES = ["draft", "locking", "active", "replaced", "revoked", "expired", "failed"] as const

/**
 * The user's agents: the template they started from, where their session stands, and which of their sessions is in
 * force (`current_session_id`) and which is on its way (`pending_session_id`: a lock, change or renewal).
 */
export const agents = pgTable("agents", {
  id: typeId("agent")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  templateId: text("template_id"),
  status: text("status", { enum: AGENT_STATUSES }).notNull(),
  paused: boolean("paused").notNull().default(false),
  currentSessionId: typeId("agentsession")("current_session_id"),
  pendingSessionId: typeId("agentsession")("pending_session_id"),
  createdAt: dateTimeUtc("created_at").notNull(),
  updatedAt: dateTimeUtc("updated_at").notNull()
}, (table) => [index("agents_user_created_at_idx").on(table.userId, table.createdAt)])

/**
 * Each set of policies locked (or being locked) for an agent, kept as its history: the spec (encoded `AgentSpec`), the
 * session key and Namera permission id, the grant once locked (`Grant.serialize`, server-only), its end, and the owner
 * operation in flight. A change shares its key and permission id with the session it replaces; a renewal has its own.
 */
export const agentSessions = pgTable("agent_sessions", {
  id: typeId("agentsession")("id").primaryKey(),
  agentId: typeId("agent")("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  spec: jsonb("spec").$type<unknown>().notNull(),
  sessionKey: text("session_key").notNull(),
  permissionId: text("permission_id"),
  grant: text("grant"),
  validUntil: dateTimeUtc("valid_until"),
  status: text("status", { enum: SESSION_STATUSES }).notNull(),
  userOpHash: text("user_op_hash"),
  createdBy: text("created_by", { enum: ["owner", "assistant", "automation"] }).notNull(),
  createdAt: dateTimeUtc("created_at").notNull(),
  installedAt: dateTimeUtc("installed_at"),
  endedAt: dateTimeUtc("ended_at")
}, (table) => [index("agent_sessions_agent_created_at_idx").on(table.agentId, table.createdAt)])

/** Each session's policies, one row each, with where each is enforced: to find the agents carrying a policy. */
export const sessionPolicies = pgTable("session_policies", {
  sessionId: typeId("agentsession")("session_id").notNull().references(() => agentSessions.id, {
    onDelete: "cascade"
  }),
  position: integer("position").notNull(),
  policy: text("policy").notNull(),
  config: jsonb("config").$type<unknown>().notNull(),
  kind: text("kind", { enum: ["userOp", "action", "execution", "rule"] }).notNull(),
  contract: text("contract").notNull()
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.position] }),
  index("session_policies_policy_idx").on(table.policy)
])

/**
 * Agents' session keys by address, encrypted (AES-256-GCM under `AGENT_KEY_ENCRYPTION_KEY`, the agent's id as
 * associated data); only signing reads them.
 */
export const sessionKeys = pgTable("session_keys", {
  address: text("address").primaryKey(),
  agentId: typeId("agent")("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  ciphertext: text("ciphertext").notNull(),
  createdAt: dateTimeUtc("created_at").notNull()
})

/** Sets of policies users saved to start agents from. */
export const agentTemplates = pgTable("agent_templates", {
  id: typeId("template")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  basedOn: text("based_on"),
  spec: jsonb("spec").$type<unknown>().notNull(),
  createdAt: dateTimeUtc("created_at").notNull()
}, (table) => [index("agent_templates_user_created_at_idx").on(table.userId, table.createdAt)])
