import { Action, Condition, Trigger } from "@bluechip/domain/automations/Automation"
import { JudgmentAnswer } from "@bluechip/domain/automations/conditions/Judgment"
import { ConditionRecord, TriggerData } from "@bluechip/domain/automations/Run"
import { Settings } from "@bluechip/domain/automations/Settings"
import { WatchState } from "@bluechip/domain/automations/Trigger"
import { index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import * as Schema from "effect/Schema"
import { dateTimeUtc, jsonbSchema, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"
import { agents } from "../agents/tables.ts"

const AUTOMATION_STATUSES = ["active", "paused", "done", "expired", "deleted"] as const

/**
 * Automations: their trigger, conditions, action and settings, each `{ type, config }` decoded through the catalogs
 * (a new entry needs no migration), where they stand, how often they fired, and when a schedule runs next.
 * `request_key` makes a retried create save one automation.
 */
export const automations = pgTable("automations", {
  id: typeId("automation")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  requestKey: text("request_key").notNull(),
  name: text("name").notNull(),
  trigger: jsonbSchema(Trigger)("trigger").notNull(),
  conditions: jsonbSchema(Schema.Array(Condition))("conditions").notNull(),
  action: jsonbSchema(Action)("action").notNull(),
  settings: jsonbSchema(Settings)("settings").notNull(),
  status: text("status", { enum: AUTOMATION_STATUSES }).notNull(),
  nextRunAt: dateTimeUtc("next_run_at"),
  fires: integer("fires").notNull().default(0),
  lastFiredAt: dateTimeUtc("last_fired_at"),
  createdBy: text("created_by", { enum: ["owner", "assistant", "template"] }).notNull(),
  createdFrom: typeId("message")("created_from"),
  createdAt: dateTimeUtc("created_at").notNull(),
  updatedAt: dateTimeUtc("updated_at").notNull()
}, (table) => [
  uniqueIndex("automations_user_request_key_idx").on(table.userId, table.requestKey),
  index("automations_user_created_at_idx").on(table.userId, table.createdAt),
  index("automations_status_next_run_at_idx").on(table.status, table.nextRunAt)
])

/** What the watchers remember of each automation between ticks: extremes, the day's first price, the last window. */
export const automationState = pgTable("automation_state", {
  automationId: typeId("automation")("automation_id").primaryKey().references(() => automations.id, {
    onDelete: "cascade"
  }),
  state: jsonbSchema(WatchState)("state").notNull(),
  updatedAt: dateTimeUtc("updated_at").notNull()
})

/**
 * Each fire of an automation, once per window (`window_key`): what fired it, each condition's result, how it ended
 * and the intents it proposed.
 */
export const automationRuns = pgTable("automation_runs", {
  id: typeId("run")("id").primaryKey(),
  automationId: typeId("automation")("automation_id").notNull().references(() => automations.id, {
    onDelete: "cascade"
  }),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  windowKey: text("window_key").notNull(),
  firedAt: dateTimeUtc("fired_at").notNull(),
  triggerData: jsonbSchema(TriggerData)("trigger_data").notNull(),
  conditions: jsonbSchema(Schema.Array(ConditionRecord))("conditions").notNull(),
  outcome: text("outcome", { enum: ["running", "proposed", "asked", "notified", "skipped", "failed"] }).notNull(),
  reason: text("reason").notNull(),
  intentIds: text("intent_ids").array().notNull(),
  notificationId: text("notification_id")
}, (table) => [
  uniqueIndex("automation_runs_automation_window_idx").on(table.automationId, table.windowKey),
  index("automation_runs_automation_fired_at_idx").on(table.automationId, table.firedAt)
])

/** Every typed question a model answered while an automation ran: what it read, which model, and its answer. */
export const judgments = pgTable("judgments", {
  id: typeId("judgment")("id").primaryKey(),
  runId: typeId("run")("run_id").notNull().references(() => automationRuns.id, { onDelete: "cascade" }),
  preset: text("preset", { enum: ["materiallyNegative", "materiallyPositive", "earningsRelated"] }).notNull(),
  newsItemId: typeId("news")("news_item_id"),
  headline: text("headline").notNull(),
  model: text("model").notNull(),
  answer: jsonbSchema(JudgmentAnswer)("answer").notNull(),
  at: dateTimeUtc("at").notNull()
}, (table) => [index("judgments_run_idx").on(table.runId)])

/** News stories bluechip read, once each (`source`, `source_id`), for `news` triggers and judgments. */
export const newsItems = pgTable("news_items", {
  id: typeId("news")("id").primaryKey(),
  source: text("source").notNull(),
  sourceId: text("source_id").notNull(),
  symbols: text("symbols").array().notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  url: text("url"),
  publishedAt: dateTimeUtc("published_at").notNull(),
  receivedAt: dateTimeUtc("received_at").notNull()
}, (table) => [
  uniqueIndex("news_items_source_id_idx").on(table.source, table.sourceId),
  index("news_items_published_at_idx").on(table.publishedAt)
])
