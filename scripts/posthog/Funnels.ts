import { event, funnel, where } from "./Queries.ts"
import type { InsightSpec, ProjectName } from "./Spec.ts"

/** The eleven funnels: where people drop off between signing up, funding, trading and letting an agent trade. */
export const funnels = (project: ProjectName): ReadonlyArray<InsightSpec> => {
  const funded = project === "production" ? event("first_funded") : event("faucet_minted")
  const activation = [
    event("$pageview"),
    event("signup_started"),
    event("signed_up"),
    event("eligibility_answered", { where: [where("answer", "eligible")] }),
    funded,
    event("trade_filled", { where: [where("is_first", true)], label: "First trade" }),
    event("agent_locked", { where: [where("is_first", true)], label: "First agent" }),
    event("trade_filled", { where: [where("executor", "agent")], label: "First agent trade" })
  ]

  return [
    {
      name: "Activation",
      description: "The north star: from the landing page to an agent's first trade, 14 days.",
      query: () => funnel(activation, { window: [14, "day"] })
    },
    {
      name: "Activation by source",
      description: "The activation funnel by the first UTM source a person arrived with.",
      query: () => funnel(activation, { window: [14, "day"], breakdown: { by: "$initial_utm_source", type: "person" } })
    },
    {
      name: "Activation, time to convert",
      description: "How long each activation step takes.",
      query: () => funnel(activation, { window: [14, "day"], timeToConvert: true })
    },
    {
      name: "Sign-up friction",
      description: "Passkey prompt opened to signed up.",
      query: () => funnel([event("signup_started"), event("signed_up")], { window: [1, "day"] })
    },
    {
      name: "First trade",
      description: "A stock viewed to its trade filled, within a day.",
      query: () =>
        funnel(
          [event("stock_viewed"), event("trade_review_opened"), event("trade_signed"), event("trade_filled")],
          { window: [1, "day"] }
        )
    },
    {
      name: "Agent creation",
      description: "The agent flow opened to the agent locked onchain, within a day, by template.",
      query: () =>
        funnel(
          [event("agent_flow_started"), event("agent_step_completed"), event("agent_created"), event("agent_locked")],
          { window: [1, "day"], breakdown: { by: "template" } }
        )
    },
    {
      name: "Agent to first agent trade",
      description: "An agent locked to its first filled trade, 7 days.",
      query: () =>
        funnel(
          [
            event("agent_locked"),
            event("intent_created", { where: [where("executor", "agent")] }),
            event("trade_filled", { where: [where("executor", "agent")] })
          ],
          { window: [7, "day"] }
        )
    },
    {
      name: "Approval",
      description: "An approval requested, opened and signed within 24 hours, by where it was opened.",
      query: () =>
        funnel([event("approval_requested"), event("approval_opened"), event("approval_signed")], {
          window: [24, "hour"],
          breakdown: { by: "entry" }
        })
    },
    {
      name: "Automation",
      description: "The automation editor opened to a trade it made, 14 days, by trigger.",
      query: () =>
        funnel(
          [
            event("automation_editor_opened"),
            event("automation_created"),
            event("automation_fired"),
            event("trade_filled", { where: [where("source", "automation")] })
          ],
          { window: [14, "day"], breakdown: { by: "trigger" } }
        )
    },
    {
      name: "Assistant to trade",
      description: "The assistant opened to a trade it proposed, filled, within a day.",
      query: () =>
        funnel(
          [
            event("assistant_opened"),
            event("message_sent"),
            event("tool_called", { where: [where("tool", "proposeTrade")] }),
            event("card_shown", { where: [where("kind", "trade")] }),
            event("card_confirmed"),
            event("trade_filled", { where: [where("source", "assistant")] })
          ],
          { window: [1, "day"] }
        )
    },
    {
      name: "Telegram",
      description: "Telegram linked to a trade confirmed there.",
      query: () =>
        funnel(
          [
            event("telegram_linked"),
            event("telegram_message"),
            event("card_confirmed", { where: [where("surface", "telegram")] }),
            event("trade_filled", { where: [where("source", "telegram")] })
          ],
          { window: [14, "day"] }
        )
    },
    {
      name: "Safety set-up",
      description: "Signed up to a second passkey and a recovery key, 30 days.",
      query: () =>
        funnel([event("signed_up"), event("passkey_added"), event("recovery_key_added")], {
          window: [30, "day"],
          from: "-90d"
        })
    },
    {
      name: "Push opt-in",
      description: "Signed up to push notifications on, 7 days.",
      query: () => funnel([event("signed_up"), event("push_enabled")], { window: [7, "day"] })
    }
  ]
}
