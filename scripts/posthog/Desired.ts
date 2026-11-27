import { actions, cohorts } from "./Cohorts.ts"
import { counters } from "./Counters.ts"
import { funnels } from "./Funnels.ts"
import { agents, assistant, automations, engagement, growth, money, webQuality } from "./Insights.ts"
import { HOME_DASHBOARD, manualSteps, settings } from "./Settings.ts"
import type { DashboardSpec, InsightSpec, PostHogDesired, ProjectName } from "./Spec.ts"

const names = (insights: ReadonlyArray<InsightSpec>) => insights.map((insight) => insight.name)

/** Everything a project should say: its settings, actions, cohorts, insights and the seven dashboards. */
export const desired = (project: ProjectName): PostHogDesired => {
  const moneyInsights = money(project)
  const top = counters(project)
  // Each dashboard reads top down: its numbers for the week, then charts side by side, then funnels and tables across.
  const dashboards: ReadonlyArray<DashboardSpec> = [
    {
      name: HOME_DASHBOARD,
      description: "Visitors, sign-ups, activation, active people, retention and where people come from.",
      insights: [
        ...names(top.growth),
        "Active people",
        "Visitors",
        "Sign-ups",
        "Sign-ups by country",
        "Activation",
        "Activation by source",
        "Activation, time to convert",
        "Retention: came back",
        "Retention: traded",
        "Retention: agents trading",
        "Stickiness"
      ]
    },
    {
      name: "bluechip: Money",
      description: "Money in, value traded, traders and trade sizes.",
      insights: [
        ...names(top.money),
        "Value traded by source",
        "Value traded by side",
        "Money in (USD)",
        "First funded per week",
        "Traders per day",
        "Trades per trader",
        "Value traded by stock",
        "Trade sizes",
        "First trade"
      ]
    },
    {
      name: "bluechip: Agents",
      description: "Agents made and locked, templates, refusals and approvals.",
      insights: [
        ...names(top.agents),
        "Agents created and locked",
        "People with an active agent",
        "Intents ended by outcome",
        "Refused by policy",
        "Agents by template",
        "Time to approve",
        "Agent creation",
        "Agent to first agent trade",
        "Approval"
      ]
    },
    {
      name: "bluechip: Automations",
      description: "Automations made, fired and skipped.",
      insights: [
        ...names(top.automations),
        "Automation fires by outcome",
        "Automation skips by condition",
        "Automations by trigger",
        "Automations by action",
        "Automation"
      ]
    },
    {
      name: "bluechip: Assistant and LLM",
      description: "Conversations, tools and cards, and what the models cost.",
      insights: [
        ...names(top.assistant),
        "Conversations",
        "Messages per conversation",
        "Cards",
        "Tool calls",
        "LLM cost by feature",
        "Model mix",
        "LLM latency p95",
        "LLM error rate",
        "LLM cost per person",
        "Assistant to trade"
      ]
    },
    {
      name: "bluechip: Engagement and channels",
      description: "Notifications, push, Telegram, safety set-up and paths.",
      insights: [
        ...names(top.engagement),
        "Notifications sent and opened",
        "Notifications by channel",
        "Passkey failures",
        "Push opt-in",
        "Telegram",
        "Safety set-up",
        "Sign-up friction",
        "Paths from sign-up",
        "Paths to an agent",
        "Paths after a passkey failure"
      ]
    },
    {
      name: "bluechip: Web quality",
      description: "Web vitals, errors and rage clicks.",
      insights: [
        ...names(top.webQuality),
        "Exceptions",
        "API errors by endpoint",
        "LCP p75 by page",
        "INP p75 by page",
        "CLS p75 by page",
        "Rage clicks by page"
      ]
    }
  ]

  return {
    settings: (refs) => settings(project, refs),
    actions,
    cohorts: cohorts(project),
    insights: [
      ...Object.values(top).flat(),
      ...funnels(project),
      ...growth,
      ...moneyInsights,
      ...agents,
      ...automations,
      ...assistant,
      ...engagement,
      ...webQuality
    ],
    dashboards,
    manual: manualSteps(project)
  }
}
