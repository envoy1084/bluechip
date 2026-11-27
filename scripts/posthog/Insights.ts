import { CAME_BACK } from "./Cohorts.ts"
import { event, paths, retention, stickiness, trends, where } from "./Queries.ts"
import type { InsightSpec, ProjectName } from "./Spec.ts"

const insight = (name: string, description: string, query: InsightSpec["query"]): InsightSpec => ({
  name,
  description,
  query
})

/** Growth: visitors, sign-ups, active people, retention and stickiness. */
export const growth: ReadonlyArray<InsightSpec> = [
  insight("Visitors", "Unique visitors per day.", () => trends([event("$pageview", { math: "dau" })])),
  insight("Sign-ups", "Sign-ups per day.", () => trends([event("signed_up")])),
  insight(
    "Sign-ups by country",
    "Sign-ups by the country of a person's first visit.",
    () =>
      trends([event("signed_up")], {
        breakdown: { by: "$initial_geoip_country_code", type: "person" },
        display: "ActionsTable"
      })
  ),
  insight("Active people", "Daily, weekly and monthly active people.", () =>
    trends([
      event(null, { math: "dau", label: "Daily" }),
      event(null, { math: "weekly_active", label: "Weekly" }),
      event(null, { math: "monthly_active", label: "Monthly" })
    ])),
  insight(
    "Retention: came back",
    "Weekly: signed up, then signed in, traded or talked to the assistant.",
    (refs) => retention("signed_up", { action: refs.action(CAME_BACK) })
  ),
  insight(
    "Retention: traded",
    "Weekly: signed up, then a trade from any source.",
    () => retention("signed_up", { event: "trade_filled" })
  ),
  insight(
    "Retention: agents trading",
    "Unbounded weekly retention of agents' trades.",
    () => retention("agent_locked", { event: "trade_filled" }, { cumulative: true })
  ),
  insight("Stickiness", "Days per week people opened bluechip.", () => stickiness([event("$pageview")]))
]

/** Money: funding, value traded, traders and trade sizes. */
export const money = (project: ProjectName): ReadonlyArray<InsightSpec> => {
  const funding = project === "production" ? "deposit_detected" : "faucet_minted"
  const firstFunding = project === "production" ? event("first_funded") : event("faucet_minted", { math: "dau" })
  return [
    insight(
      "First funded per week",
      "People putting money in for the first time, weekly.",
      () => trends([firstFunding], { interval: "week", from: "-12w" })
    ),
    insight(
      "Money in (USD)",
      `Dollars in per day (${funding}).`,
      () => trends([event(funding, { math: "sum", property: "usd" })], { display: "ActionsBar" })
    ),
    insight(
      "Value traded by source",
      "Sum of trade_filled.usd per day by who asked.",
      () =>
        trends([event("trade_filled", { math: "sum", property: "usd" })], {
          breakdown: { by: "source" },
          display: "ActionsBar"
        })
    ),
    insight(
      "Value traded by side",
      "Sum of trade_filled.usd per day, buys and sells.",
      () => trends([event("trade_filled", { math: "sum", property: "usd" })], { breakdown: { by: "side" } })
    ),
    insight(
      "Value traded by stock",
      "Sum of trade_filled.usd by stock.",
      () =>
        trends([event("trade_filled", { math: "sum", property: "usd" })], {
          breakdown: { by: "symbol" },
          display: "ActionsTable"
        })
    ),
    insight(
      "Traders per day",
      "People with a filled trade each day.",
      () => trends([event("trade_filled", { math: "dau" })])
    ),
    insight(
      "Trades per trader",
      "Filled trades over distinct traders, per day.",
      () => trends([event("trade_filled"), event("trade_filled", { math: "dau" })], { formula: "A / B" })
    ),
    insight(
      "Trade sizes",
      "Filled trades by size range.",
      () => trends([event("trade_filled")], { breakdown: { by: "usd_bucket" }, display: "ActionsPie" })
    )
  ]
}

/** Agents: made, locked, templates, refusals and approvals. */
export const agents: ReadonlyArray<InsightSpec> = [
  insight(
    "Agents created and locked",
    "Agents created and locked onchain, weekly.",
    () => trends([event("agent_created"), event("agent_locked")], { interval: "week", from: "-12w" })
  ),
  insight(
    "Agents by template",
    "Agents locked by template.",
    () => trends([event("agent_locked")], { breakdown: { by: "template" }, display: "ActionsPie" })
  ),
  insight(
    "People with an active agent",
    "Weekly active people who have an agent active.",
    () => trends([event(null, { math: "weekly_active", where: [where("active_agents_count", 0, "gt", "person")] })])
  ),
  insight(
    "Refused by policy",
    "Intents a policy refused, by the policy.",
    () => trends([event("intent_decided", { where: [where("decision", "refused")] })], { breakdown: { by: "policy" } })
  ),
  insight(
    "Intents ended by outcome",
    "How intents ended.",
    () => trends([event("intent_ended")], { breakdown: { by: "outcome" }, display: "ActionsBar" })
  ),
  insight(
    "Time to approve",
    "Median seconds from an approval asked to signed.",
    () => trends([event("approval_signed", { math: "median", property: "seconds_to_resolve" })])
  )
]

/** Automations: made, fired and skipped. */
export const automations: ReadonlyArray<InsightSpec> = [
  insight(
    "Automations by trigger",
    "Automations created by trigger.",
    () => trends([event("automation_created")], { breakdown: { by: "trigger" }, display: "ActionsBar" })
  ),
  insight(
    "Automations by action",
    "Automations created by action.",
    () => trends([event("automation_created")], { breakdown: { by: "action" }, display: "ActionsPie" })
  ),
  insight(
    "Automation fires by outcome",
    "What automation runs did.",
    () => trends([event("automation_fired")], { breakdown: { by: "outcome" } })
  ),
  insight(
    "Automation skips by condition",
    "Runs skipped, by the condition that failed.",
    () => trends([event("automation_skipped")], { breakdown: { by: "condition" } })
  )
]

/** The assistant and its models' cost, latency and errors. */
export const assistant: ReadonlyArray<InsightSpec> = [
  insight(
    "Conversations",
    "Conversations started by surface.",
    () => trends([event("conversation_started")], { breakdown: { by: "surface" } })
  ),
  insight(
    "Messages per conversation",
    "Messages over conversations started, per day.",
    () => trends([event("message_sent"), event("conversation_started")], { formula: "A / B" })
  ),
  insight(
    "Tool calls",
    "Assistant tool calls by tool.",
    () => trends([event("tool_called")], { breakdown: { by: "tool" }, display: "ActionsTable" })
  ),
  insight(
    "Cards",
    "Cards shown, confirmed and dismissed.",
    () => trends([event("card_shown"), event("card_confirmed"), event("card_dismissed")])
  ),
  insight(
    "LLM cost by feature",
    "Model cost per day (USD) by feature.",
    () =>
      trends([event("$ai_generation", { math: "sum", property: "$ai_total_cost_usd" })], {
        breakdown: { by: "$ai_span_name" },
        display: "ActionsBar"
      })
  ),
  insight(
    "LLM cost per person",
    "The 20 people whose assistant costs most (USD).",
    () =>
      trends([event("$ai_generation", { math: "sum", property: "$ai_total_cost_usd" })], {
        breakdown: { by: "distinct_id", type: "hogql", limit: 20 },
        display: "ActionsTable"
      })
  ),
  insight(
    "LLM latency p95",
    "95th percentile model latency (s) by model.",
    () =>
      trends([event("$ai_generation", { math: "p95", property: "$ai_latency" })], { breakdown: { by: "$ai_model" } })
  ),
  insight(
    "LLM error rate",
    "Model calls that failed, %.",
    () =>
      trends([event("$ai_generation", { where: [where("$ai_is_error", true)] }), event("$ai_generation")], {
        formula: "A / B * 100"
      })
  ),
  insight(
    "Model mix",
    "Model calls by model.",
    () => trends([event("$ai_generation")], { breakdown: { by: "$ai_model" }, display: "ActionsPie" })
  )
]

/** Notifications, channels and the paths people take. */
export const engagement: ReadonlyArray<InsightSpec> = [
  insight(
    "Notifications sent and opened",
    "Notifications sent and opened, per day.",
    () => trends([event("notification_sent"), event("notification_opened")])
  ),
  insight(
    "Notifications by channel",
    "Notifications sent by channel.",
    () => trends([event("notification_sent")], { breakdown: { by: "channel" } })
  ),
  insight(
    "Passkey failures",
    "Failed passkey prompts by reason.",
    () => trends([event("passkey_prompt_failed")], { breakdown: { by: "reason" } })
  ),
  insight("Paths from sign-up", "Where people go after signing up.", () => paths({ from: "signed_up" })),
  insight("Paths to an agent", "How people get to locking an agent.", () => paths({ to: "agent_locked" })),
  insight(
    "Paths after a passkey failure",
    "What people do after a passkey prompt fails.",
    () => paths({ from: "passkey_prompt_failed" })
  )
]

const vital = (metric: string) =>
  insight(
    `${metric} p75 by page`,
    `75th percentile ${metric} by page.`,
    () =>
      trends([event("$web_vitals", { math: "p75", property: `$web_vitals_${metric}_value` })], {
        breakdown: { by: "$pathname" }
      })
  )

/** The web app's speed and errors. */
export const webQuality: ReadonlyArray<InsightSpec> = [
  vital("LCP"),
  vital("INP"),
  vital("CLS"),
  insight("Exceptions", "Errors the web app threw, per day.", () => trends([event("$exception")])),
  insight(
    "API errors by endpoint",
    "Errors the API answered, by endpoint group.",
    () => trends([event("api_error")], { breakdown: { by: "endpoint_group" } })
  ),
  insight(
    "Rage clicks by page",
    "Rage clicks per day by page.",
    () => trends([event("$rageclick")], { breakdown: { by: "$pathname" } })
  )
]
