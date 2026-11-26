// What's next over the coming week: each automation's next scheduled run and each agent's rules ending, soonest
// first, and the automations that watch something live (they run when it happens, not at a time).
import type { Agent } from "@bluechip/domain/agents/Agent"
import { type Automation, triggerOf } from "@bluechip/domain/automations/Automation"
import type { Watcher } from "@bluechip/domain/automations/Trigger"
import type { AgentId, AutomationId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"
import { ENDING_SOON_DAYS } from "./needsYou.ts"

export type Upcoming =
  | {
    readonly _tag: "run"
    readonly key: string
    readonly at: Date
    readonly automationId: AutomationId
    readonly title: string
    readonly detail: string
  }
  | {
    readonly _tag: "rulesEnd"
    readonly key: string
    readonly at: Date
    readonly agentId: AgentId
    readonly title: string
    readonly detail: string
  }

export interface ComingUp {
  readonly upcoming: ReadonlyArray<Upcoming>
  /** One per live automation, said "NVIDIA stop-loss watches prices" with its name set apart. */
  readonly watching: ReadonlyArray<{ readonly name: string; readonly watches: string }>
}

const DAY = 86_400_000
const WINDOW_DAYS = 7
const RENEW_WINDOW_DAYS = 14
const SHOWN = 5

const WATCHES: Readonly<Record<Exclude<Watcher, "schedule">, string>> = {
  price: "prices",
  portfolio: "your portfolio",
  news: "the news"
}

/**
 * The next runs within a week and agents' rules ending within two weeks (those ending sooner need you, and show
 * there), five at most, soonest first; then what live automations watch. Paused and ended automations have nothing
 * coming.
 */
export const comingUp = (
  automations: ReadonlyArray<Pick<Automation, "id" | "name" | "status" | "nextRunAt" | "agentId" | "trigger">>,
  agents: ReadonlyArray<Pick<Agent, "id" | "name" | "status" | "lockedUntil">>,
  now: Date
): ComingUp => {
  const time = now.getTime()
  const active = automations.filter((automation) => automation.status === "active")
  const agentName = (id: AgentId | null) => agents.find((agent) => agent.id === id)?.name

  const runs = active.flatMap((automation): ReadonlyArray<Upcoming> => {
    if (automation.nextRunAt === null) return []
    const at = DateTime.toDateUtc(automation.nextRunAt)
    if (at.getTime() < time || at.getTime() > time + WINDOW_DAYS * DAY) return []

    const through = agentName(automation.agentId)
    return [{
      _tag: "run",
      key: `run ${automation.id}`,
      at,
      automationId: automation.id,
      title: `${automation.name} runs`,
      detail: automation.agentId === null
        ? "For you, with your Face ID"
        : through === undefined
        ? ""
        : `Through ${through}`
    }]
  })

  const rulesEnd = agents.flatMap((agent): ReadonlyArray<Upcoming> => {
    if (agent.status !== "active" || agent.lockedUntil === null) return []
    const at = DateTime.toDateUtc(agent.lockedUntil)
    const left = at.getTime() - time
    if (left <= ENDING_SOON_DAYS * DAY || left > RENEW_WINDOW_DAYS * DAY) return []

    return [{
      _tag: "rulesEnd",
      key: `rules ${agent.id}`,
      at,
      agentId: agent.id,
      title: `${agent.name}'s rules end`,
      detail: "Renew them to keep it trading"
    }]
  })

  return {
    upcoming: [...runs, ...rulesEnd].toSorted((a, b) => a.at.getTime() - b.at.getTime()).slice(0, SHOWN),
    watching: active.flatMap((automation) => {
      const watcher = triggerOf(automation.trigger).watcher
      return automation.nextRunAt === null && watcher !== "schedule" ?
        [{ name: automation.name, watches: WATCHES[watcher] }] :
        []
    })
  }
}
