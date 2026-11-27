import { event, trends, where } from "./Queries.ts"
import type { InsightSpec, ProjectName } from "./Spec.ts"

type Series = Parameters<typeof trends>[0][number]

// One number for the last 7 days, against the 7 days before.
const counter = (name: string, description: string, series: Series): InsightSpec => ({
  name,
  description,
  query: () => trends([series], { from: "-7d", display: "BoldNumber", compare: true })
})

/** The numbers at the top of each dashboard, by dashboard. */
export const counters = (project: ProjectName) => {
  const funding = project === "production" ? "deposit_detected" : "faucet_minted"
  return {
    growth: [
      counter("Visitors, 7 days", "Unique visitors in the last 7 days.", event("$pageview", { math: "dau" })),
      counter("Sign-ups, 7 days", "Sign-ups in the last 7 days.", event("signed_up")),
      counter("Active people, 7 days", "People who did anything in the last 7 days.", event(null, { math: "dau" })),
      counter(
        "Traders, 7 days",
        "People with a filled trade in the last 7 days.",
        event("trade_filled", { math: "dau" })
      )
    ],
    money: [
      counter(
        "Money in, 7 days",
        `Dollars in over the last 7 days (${funding}).`,
        event(funding, { math: "sum", property: "usd" })
      ),
      counter(
        "Value traded, 7 days",
        "Sum of trade_filled.usd over the last 7 days.",
        event("trade_filled", { math: "sum", property: "usd" })
      ),
      counter("Trades, 7 days", "Filled trades in the last 7 days.", event("trade_filled")),
      counter(
        "Agent trades, 7 days",
        "Trades agents filled in the last 7 days.",
        event("trade_filled", { where: [where("executor", "agent")] })
      )
    ],
    agents: [
      counter("Agents created, 7 days", "Agents created in the last 7 days.", event("agent_created")),
      counter("Agents locked, 7 days", "Agents locked onchain in the last 7 days.", event("agent_locked")),
      counter(
        "Refusals, 7 days",
        "Intents a policy refused in the last 7 days.",
        event("intent_decided", { where: [where("decision", "refused")] })
      ),
      counter("Approvals signed, 7 days", "Approvals signed in the last 7 days.", event("approval_signed"))
    ],
    automations: [
      counter("Automations created, 7 days", "Automations created in the last 7 days.", event("automation_created")),
      counter("Automation runs, 7 days", "Automation runs in the last 7 days.", event("automation_fired")),
      counter("Automation skips, 7 days", "Runs skipped in the last 7 days.", event("automation_skipped"))
    ],
    assistant: [
      counter("Conversations, 7 days", "Conversations started in the last 7 days.", event("conversation_started")),
      counter("Messages, 7 days", "Messages sent to the assistant in the last 7 days.", event("message_sent")),
      counter("Cards confirmed, 7 days", "Cards confirmed in the last 7 days.", event("card_confirmed")),
      counter(
        "LLM cost, 7 days",
        "Model cost over the last 7 days (USD).",
        event("$ai_generation", { math: "sum", property: "$ai_total_cost_usd" })
      )
    ],
    engagement: [
      counter("Notifications sent, 7 days", "Notifications sent in the last 7 days.", event("notification_sent")),
      counter("Notifications opened, 7 days", "Notifications opened in the last 7 days.", event("notification_opened")),
      counter("Passkey failures, 7 days", "Failed passkey prompts in the last 7 days.", event("passkey_prompt_failed"))
    ],
    webQuality: [
      counter("Exceptions, 7 days", "Errors the web app threw in the last 7 days.", event("$exception")),
      counter("API errors, 7 days", "Errors the API answered in the last 7 days.", event("api_error")),
      counter("Rage clicks, 7 days", "Rage clicks in the last 7 days.", event("$rageclick"))
    ]
  }
}
