import { INTERNAL_COHORT } from "./Settings.ts"
import type { ObjectSpec, ProjectName } from "./Spec.ts"

/** The action retention counts as coming back. */
export const CAME_BACK = "Came back"

/** Actions: events grouped under one name. */
export const actions: ReadonlyArray<ObjectSpec> = [
  {
    name: CAME_BACK,
    description: "Signed in, traded or talked to the assistant: what retention counts as coming back.",
    body: { steps: [{ event: "signed_in" }, { event: "trade_filled" }, { event: "message_sent" }] }
  }
]

const performed = (event: string, days: number, negation = false) => ({
  key: event,
  type: "behavioral",
  value: "performed_event",
  event_type: "events",
  time_value: days,
  time_interval: "day",
  negation
})

const person = (key: string, operator: string, value: unknown) => ({ key, type: "person", operator, value })

const all = (...criteria: ReadonlyArray<unknown>) => ({
  filters: { properties: { type: "OR", values: [{ type: "AND", values: criteria }] } },
  is_static: false
})

const any = (...criteria: ReadonlyArray<unknown>) => ({
  filters: { properties: { type: "OR", values: criteria.map((criterion) => ({ type: "AND", values: [criterion] })) } },
  is_static: false
})

/** Cohorts of people, by what they did or what their person properties say. */
export const cohorts = (project: ProjectName): ReadonlyArray<ObjectSpec> => {
  const funded = project === "production" ? "first_funded" : "faucet_minted"
  return [
    {
      name: "Activated",
      description: "Made at least one trade.",
      body: all(performed("trade_filled", 365))
    },
    {
      name: "Funded, never traded",
      description: `Got money in (${funded}) and never traded.`,
      body: all(performed(funded, 365), performed("trade_filled", 365, true))
    },
    {
      name: "Has an active agent",
      description: "At least one agent active now (person property active_agents_count).",
      body: all(person("active_agents_count", "gt", 0))
    },
    {
      name: "Agent owners who never approved",
      description: "Made an agent and never signed an approval.",
      body: all(person("agents_count", "gt", 0), performed("approval_signed", 365, true))
    },
    {
      name: "Automation users",
      description: "At least one automation (person property automations_count).",
      body: all(person("automations_count", "gt", 0))
    },
    {
      name: "Assistant power users",
      description: "Ten or more assistant messages in the last 7 days.",
      body: all({
        key: "message_sent",
        type: "behavioral",
        value: "performed_event_multiple",
        event_type: "events",
        operator: "gte",
        operator_value: 10,
        time_value: 7,
        time_interval: "day",
        negation: false
      })
    },
    {
      name: "Telegram linked",
      description: "Linked Telegram (person property telegram_linked).",
      body: all(person("telegram_linked", "exact", [true]))
    },
    {
      name: "Dormant",
      description: "Signed up over 14 days ago and hasn't come back in 14 days.",
      body: all(
        performed("signed_up", 365),
        performed("signed_up", 14, true),
        performed("$pageview", 14, true),
        performed("signed_in", 14, true)
      )
    },
    {
      name: "Answered US person",
      description: "Said they are a US person at eligibility (for reviewing that screen's words).",
      body: all(person("eligibility", "exact", ["us_person"]))
    },
    {
      name: INTERNAL_COHORT,
      description: "The operator's own people and test accounts: left out of every insight by default.",
      body: any(person("$internal_or_test_user", "exact", [true]), person("internal", "exact", [true]))
    }
  ]
}
