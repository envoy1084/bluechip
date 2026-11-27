// The showcase conversations: a card gallery, one chat per family of the chat's UI (trades, agents, limits,
// automations, portfolio, markdown, tool rows, errors…) and chats about some of the cast's agents, so every card and
// state can be opened and reviewed in context, in every scenario with money. A person who just started also has
// their first few chats. A new person has none: their chat is the start screen.
import type { AgentId } from "@bluechip/domain/Ids"
import type { Cast, CastAgent, ScenarioId } from "../cast.ts"
import type { Script } from "./threads.ts"
import { agentChat } from "./threads/showcase/agentChat.ts"
import { everyAgentCard } from "./threads/showcase/agents.ts"
import { everyAutomationCard } from "./threads/showcase/automations.ts"
import { createAgentInChat } from "./threads/showcase/createAgent.ts"
import { editLimits } from "./threads/showcase/editLimits.ts"
import { errorsAndLimits } from "./threads/showcase/errors.ts"
import { cardGallery } from "./threads/showcase/gallery.ts"
import { longAnswers } from "./threads/showcase/markdown.ts"
import { memoryAndPreferences } from "./threads/showcase/memory.ts"
import { researchAndNews } from "./threads/showcase/news.ts"
import { portfolioAndPerformance } from "./threads/showcase/portfolio.ts"
import { quickQuestions } from "./threads/showcase/short.ts"
import { everyToolRow } from "./threads/showcase/tools.ts"
import { everyTrade } from "./threads/showcase/trades.ts"
import { firstAgent, howToStart, whatDidItBuy } from "./threads/starter.ts"

interface Showcase {
  readonly title: string
  readonly agentId: AgentId | null
  readonly hoursAgo: number
  readonly script: Script
}

const FAMILIES = {
  gallery: { title: "Card gallery: every card, one by one", script: cardGallery },
  createAgent: { title: "Make my first agent from chat", script: createAgentInChat },
  editLimits: { title: "Change my agent's limits", script: editLimits },
  portfolio: { title: "How am I doing? Portfolio and results", script: portfolioAndPerformance },
  trades: { title: "Every trade card, in each state", script: everyTrade },
  agents: { title: "Every agent card: drafts, changes, pauses", script: everyAgentCard },
  automations: { title: "Every automation card", script: everyAutomationCard },
  memory: { title: "What you remember about me", script: memoryAndPreferences },
  news: { title: "Research and news on my stocks", script: researchAndNews },
  markdown: { title: "Long answers and formatting", script: longAnswers },
  tools: { title: "Every tool row: data, empty, failed", script: everyToolRow },
  errors: { title: "When things go wrong", script: errorsAndLimits },
  short: { title: "Quick questions", script: quickQuestions }
} as const satisfies Record<string, Omit<Showcase, "agentId" | "hoursAgo">>

type Family = keyof typeof FAMILIES

/** Every family, newest first from `start` hours ago, a few hours apart. */
const everyFamily = (start: number, step: number): ReadonlyArray<readonly [Family, number]> =>
  (Object.keys(FAMILIES) as Array<Family>).map((family, index) => [family, start + index * step])

const EARLY: ReadonlyArray<Omit<Showcase, "agentId">> = [
  { title: "What did my agent buy?", hoursAgo: 2, script: whatDidItBuy },
  { title: "Make a careful agent", hoursAgo: 26, script: firstAgent },
  { title: "How do I start?", hoursAgo: 40, script: howToStart }
]

const PLAN: Readonly<
  Record<Exclude<ScenarioId, "newPerson">, {
    readonly early: ReadonlyArray<Omit<Showcase, "agentId">>
    readonly families: ReadonlyArray<readonly [Family, hoursAgo: number]>
    readonly agents: ReadonlyArray<readonly [CastAgent["state"], hoursAgo: number]>
  }>
> = {
  starter: { early: EARLY, families: everyFamily(0.3, 3), agents: [["active", 30]] },
  typical: { early: [], families: everyFamily(0.5, 6), agents: [["active", 120], ["asking", 200]] },
  heavy: {
    early: [],
    families: everyFamily(0.2, 7),
    agents: [["paused", 120], ["updating", 200], ["draft", 300], ["expired", 400], ["locking", 600]]
  }
}

/** The showcase conversations of `cast`'s scenario. */
export const showcasesOf = (cast: Cast): ReadonlyArray<Showcase> => {
  if (cast.scenario === "newPerson") return []
  const plan = PLAN[cast.scenario]

  return [
    ...plan.early.map((entry) => ({
      ...entry,
      agentId: entry.script === firstAgent ? cast.agents[0]?.id ?? null : null
    })),
    ...plan.families.map(([family, hoursAgo]) => ({ ...FAMILIES[family], agentId: null, hoursAgo })),
    ...plan.agents.flatMap(([state, hoursAgo]) => {
      const agent = cast.agents.find((candidate) => candidate.state === state)
      return agent === undefined ?
        [] :
        [{ title: `${agent.name}: how it's doing`, agentId: agent.id, hoursAgo, script: agentChat(agent) }]
    })
  ]
}
