/**
 * The events the server sends to analytics, one per fact it is the source of truth for: sign-ups, money, trades,
 * agents, intents, automations, the assistant, notifications and the account's safety. Exact dollars appear only
 * here, on money events (`usd`); every other amount is a {@link UsdBucket}.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { UsdBucket } from "./Buckets.ts"
import { Executor, Side, Surface, TradeSource } from "./Properties.ts"

const Seconds = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))
const Usd = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const AgentBy = Schema.Literals(["you", "pause_all", "telegram", "expiry"])

const agentLifecycle = <const Tag extends string>(tag: Tag) =>
  Schema.TaggedStruct(tag, {
    template: Schema.String,
    by: AgentBy,
    changed_policies: Schema.Array(Schema.String)
  })

/**
 * Every server event, by name (`_tag`).
 *
 * @stability unstable
 * @category catalog
 * @since 0.0.0
 */
export const SERVER_EVENTS = [
  // Auth and onboarding
  Schema.TaggedStruct("signed_up", {
    method: Schema.Literals(["passkey", "soft_passkey"]),
    authenticator: Schema.Literals(["platform", "cross_platform"]),
    device_class: Schema.Literals(["mobile", "desktop", "tablet", "unknown"])
  }),
  Schema.TaggedStruct("signed_in", {
    method: Schema.Literals(["passkey", "discoverable"]),
    new_device: Schema.Boolean
  }),
  Schema.TaggedStruct("eligibility_answered", { answer: Schema.Literals(["eligible", "us_person"]) }),

  // Funding
  Schema.TaggedStruct("deposit_detected", { usd: Usd, usd_bucket: UsdBucket, is_first: Schema.Boolean }),
  Schema.TaggedStruct("first_funded", { usd_bucket: UsdBucket, hours_since_signup: Seconds }),
  Schema.TaggedStruct("withdrawal_requested", { usd_bucket: UsdBucket }),
  Schema.TaggedStruct("withdrawal_sent", { usd_bucket: UsdBucket }),
  Schema.TaggedStruct("withdrawal_failed", { usd_bucket: UsdBucket, reason: Schema.String }),
  Schema.TaggedStruct("faucet_minted", { usd: Usd }),
  Schema.TaggedStruct("faucet_refused", { usd: Usd, reason: Schema.Literals(["daily_limit", "failed"]) }),

  // Market and trading
  Schema.TaggedStruct("quote_requested", { symbol: Schema.String, side: Side, usd_bucket: UsdBucket }),
  Schema.TaggedStruct("quote_failed", {
    symbol: Schema.String,
    side: Side,
    usd_bucket: UsdBucket,
    reason: Schema.String
  }),
  Schema.TaggedStruct("trade_signed", { symbol: Schema.String, side: Side, usd_bucket: UsdBucket }),
  Schema.TaggedStruct("trade_filled", {
    symbol: Schema.String,
    side: Side,
    usd: Usd,
    usd_bucket: UsdBucket,
    source: TradeSource,
    executor: Executor,
    agent_id: Schema.NullOr(Schema.String),
    automation_id: Schema.NullOr(Schema.String),
    batch_id: Schema.NullOr(Schema.String),
    slippage_bps: Schema.Finite,
    fee_usd: Usd,
    gas_sponsored: Schema.Boolean,
    is_first: Schema.Boolean,
    seconds_to_fill: Seconds
  }),
  Schema.TaggedStruct("trade_failed", {
    symbol: Schema.String,
    side: Side,
    source: TradeSource,
    reason: Schema.Literals(["reverted", "bundler", "expired", "rejected"])
  }),

  // Agents
  Schema.TaggedStruct("agent_created", {
    template: Schema.String,
    policies: Schema.Array(Schema.String),
    max_per_trade_bucket: UsdBucket,
    daily_budget_bucket: UsdBucket,
    stocks_count: Count
  }),
  Schema.TaggedStruct("agent_locked", {
    template: Schema.String,
    policies: Schema.Array(Schema.String),
    is_first: Schema.Boolean,
    seconds_from_created: Seconds
  }),
  Schema.TaggedStruct("agent_lock_failed", { reason: Schema.String }),
  agentLifecycle("agent_paused"),
  agentLifecycle("agent_resumed"),
  agentLifecycle("agent_renewed"),
  agentLifecycle("agent_changed"),
  agentLifecycle("agent_removed"),
  agentLifecycle("agent_expired"),

  // Intents and approvals
  Schema.TaggedStruct("intent_created", {
    source: TradeSource,
    executor: Executor,
    agent_id: Schema.NullOr(Schema.String),
    automation_id: Schema.NullOr(Schema.String),
    batched: Schema.Boolean,
    legs: Count
  }),
  Schema.TaggedStruct("intent_decided", {
    decision: Schema.Literals(["passes", "over_largest_trade", "asks_you", "refused", "waits"]),
    policy: Schema.NullOr(Schema.String),
    wait_reason: Schema.NullOr(Schema.String)
  }),
  Schema.TaggedStruct("intent_ended", {
    outcome: Schema.Literals(["filled", "blocked", "declined", "expired", "failed", "cancelled"]),
    source: TradeSource,
    executor: Executor,
    seconds: Seconds
  }),
  Schema.TaggedStruct("approval_requested", { reason: Schema.String, usd_bucket: UsdBucket, source: TradeSource }),
  Schema.TaggedStruct("approval_signed", { seconds_to_resolve: Seconds, surface: Surface }),
  Schema.TaggedStruct("approval_declined", { seconds_to_resolve: Seconds, surface: Surface }),
  Schema.TaggedStruct("approval_expired", { seconds_to_resolve: Seconds }),

  // Automations
  Schema.TaggedStruct("automation_created", {
    trigger: Schema.String,
    action: Schema.String,
    conditions: Schema.Array(Schema.String),
    created_by: Schema.Literals(["you", "assistant"]),
    for: Schema.Literals(["you", "agent"])
  }),
  Schema.TaggedStruct("automation_fired", {
    trigger: Schema.String,
    action: Schema.String,
    outcome: Schema.Literals(["traded", "proposed", "notified", "failed"]),
    legs: Count
  }),
  Schema.TaggedStruct("automation_skipped", { trigger: Schema.String, condition: Schema.String }),
  Schema.TaggedStruct("automation_paused", { trigger: Schema.String, by: Schema.String }),
  Schema.TaggedStruct("automation_deleted", { trigger: Schema.String, by: Schema.String }),
  Schema.TaggedStruct("judgment_made", {
    preset: Schema.String,
    verdict: Schema.String,
    confidence_bucket: Schema.Literals(["low", "medium", "high"])
  }),

  // Assistant
  Schema.TaggedStruct("conversation_started", { surface: Surface, has_agent: Schema.Boolean }),
  Schema.TaggedStruct("message_sent", { surface: Surface, conversation_id: Schema.String, turn_index: Count }),
  Schema.TaggedStruct("tool_called", {
    tool: Schema.String,
    risk: Schema.String,
    outcome: Schema.Literals(["ok", "error", "refused"]),
    conversation_id: Schema.String
  }),
  Schema.TaggedStruct("card_shown", { kind: Schema.String, conversation_id: Schema.String, surface: Surface }),
  Schema.TaggedStruct("card_confirmed", { kind: Schema.String, conversation_id: Schema.String, surface: Surface }),
  Schema.TaggedStruct("card_dismissed", { kind: Schema.String, conversation_id: Schema.String, surface: Surface }),
  Schema.TaggedStruct("assistant_error", { kind: Schema.Literals(["budget_spent", "model_error", "tool_error"]) }),
  Schema.TaggedStruct("memory_saved", { source: Schema.Literals(["assistant", "you"]) }),
  Schema.TaggedStruct("memory_deleted", { source: Schema.Literals(["assistant", "you"]) }),

  // Notifications and channels
  Schema.TaggedStruct("notification_sent", { kind: Schema.String, channel: Schema.String, severity: Schema.String }),
  Schema.TaggedStruct("notification_action", {
    kind: Schema.String,
    action: Schema.Literals(["review", "pause_all", "cancel_recovery"]),
    surface: Schema.Literals(["web", "push", "telegram"])
  }),
  Schema.TaggedStruct("push_enabled", {}),
  Schema.TaggedStruct("push_disabled", {}),
  Schema.TaggedStruct("telegram_linked", {}),
  Schema.TaggedStruct("telegram_unlinked", {}),
  Schema.TaggedStruct("telegram_message", {
    kind: Schema.Literals(["text", "command", "button"]),
    command: Schema.NullOr(Schema.String)
  }),

  // Security
  Schema.TaggedStruct("passkey_added", { count_after: Count }),
  Schema.TaggedStruct("passkey_removed", { count_after: Count }),
  Schema.TaggedStruct("recovery_key_added", { by: Schema.Literals(["device", "telegram", "guard"]) }),
  Schema.TaggedStruct("recovery_started", { by: Schema.Literals(["device", "telegram", "guard"]) }),
  Schema.TaggedStruct("recovery_cancelled", { by: Schema.Literals(["device", "telegram", "guard"]) }),
  Schema.TaggedStruct("recovery_completed", { by: Schema.Literals(["device", "telegram", "guard"]) }),
  Schema.TaggedStruct("device_signed_out", { scope: Schema.Literals(["one", "others"]) })
] as const

/**
 * An event the server sends.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ServerEvent = Schema.Union(SERVER_EVENTS)

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type ServerEvent = typeof ServerEvent.Type
