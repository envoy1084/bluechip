import { actions, cohorts } from "./Cohorts.ts"
import { funnels } from "./Funnels.ts"
import { agents, assistant, automations, engagement, growth, money, webQuality } from "./Insights.ts"
import { HOME_DASHBOARD, manualSteps, settings } from "./Settings.ts"
import type { DashboardSpec, InsightSpec, PostHogDesired, ProjectName } from "./Spec.ts"

const names = (insights: ReadonlyArray<InsightSpec>) => insights.map((insight) => insight.name)

/** Everything a project should say: its settings, actions, cohorts, insights and the seven dashboards. */
export const desired = (project: ProjectName): PostHogDesired => {
  const moneyInsights = money(project)
  const dashboards: ReadonlyArray<DashboardSpec> = [
    {
      name: HOME_DASHBOARD,
      description: "Visitors, sign-ups, activation, active people, retention and where people come from.",
      insights: ["Activation", "Activation by source", "Activation, time to convert", ...names(growth)]
    },
    {
      name: "bluechip: Money",
      description: "Money in, value traded, traders and trade sizes.",
      insights: [...names(moneyInsights), "First trade"]
    },
    {
      name: "bluechip: Agents",
      description: "Agents made and locked, templates, refusals and approvals.",
      insights: ["Agent creation", "Agent to first agent trade", "Approval", ...names(agents)]
    },
    {
      name: "bluechip: Automations",
      description: "Automations made, fired and skipped.",
      insights: ["Automation", ...names(automations)]
    },
    {
      name: "bluechip: Assistant and LLM",
      description: "Conversations, tools and cards, and what the models cost.",
      insights: ["Assistant to trade", ...names(assistant)]
    },
    {
      name: "bluechip: Engagement and channels",
      description: "Notifications, push, Telegram, safety set-up and paths.",
      insights: ["Push opt-in", "Telegram", "Safety set-up", "Sign-up friction", ...names(engagement)]
    },
    {
      name: "bluechip: Web quality",
      description: "Web vitals, errors and rage clicks.",
      insights: names(webQuality)
    }
  ]

  return {
    settings: (refs) => settings(project, refs),
    actions,
    cohorts: cohorts(project),
    insights: [
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
