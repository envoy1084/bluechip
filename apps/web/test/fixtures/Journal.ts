// Journal entries, the stories read from them, and the sessions its rules moments come from.
import { AgentSession } from "@bluechip/domain/agents/Agent"
import { AgentSessionId, JournalEntryId } from "@bluechip/domain/Ids"
import { JournalEntry } from "@bluechip/domain/journal/Journal"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import * as DateTime from "effect/DateTime"
import type { JournalStory } from "../../src/features/agents/model/journalStory.ts"
import type { RulesMoment } from "../../src/features/agents/model/journalTimeline.ts"
import { AGENT_ID, PICKER } from "./Agents.ts"

/** Stock names as the server writes them: NVIDIA and Apple, any other stock by its symbol. */
export const nameOf = (symbol: StockSymbol): string =>
  symbol === "NVDA" ? "NVIDIA" : symbol === "AAPL" ? "Apple" : symbol

// The stock picker with the conservative preset: a lower daily budget and largest trade than `PICKER`.
export const CAUTIOUS = draftSpec({
  template: "stockPicker",
  preset: "conservative",
  stocks: ["NVDA", "AAPL"],
  targets: []
})

/** Entry number `n` (1 to 9) of the agent's journal, at `at`: by default a filled buy of Nvidia. */
export const journalEntry = (
  n: number,
  at: string,
  options: { readonly kind?: JournalEntry["kind"]; readonly entry?: string; readonly refs?: JournalEntry["refs"] } = {}
): JournalEntry =>
  new JournalEntry({
    id: JournalEntryId.make(`journal_01jd8v4t5m6n7a8q9r0s1t2v3${n}`),
    agentId: AGENT_ID,
    at: DateTime.makeUnsafe(at),
    kind: options.kind ?? "intent",
    entry: options.entry ?? "Buy $50.00 of NVIDIA: filled.",
    refs: options.refs ?? {}
  })

/** Session number `n` (1 to 9), asked by you at 10:00 on day `n` of November 2026 and locked a minute later. */
export const agentSession = (
  n: number,
  options: Partial<Pick<AgentSession, "status" | "spec" | "installedAt" | "endedAt" | "validUntil">> = {}
): AgentSession =>
  new AgentSession({
    id: AgentSessionId.make(`agentsession_01jd8v4t5m6n7a8q9r0s1t2v3${n}`),
    status: "replaced",
    spec: PICKER,
    createdBy: "owner",
    validUntil: null,
    createdAt: DateTime.makeUnsafe(`2026-11-0${n}T10:00:00Z`),
    installedAt: DateTime.makeUnsafe(`2026-11-0${n}T10:01:00Z`),
    endedAt: null,
    ...options
  })

/** The first lock of rules over Nvidia, by you, at `at`. */
export const firstLock = (id: string, at: string): RulesMoment => ({
  _tag: "Rules",
  id,
  at: DateTime.makeUnsafe(at),
  change: "locked",
  by: "owner",
  moved: [],
  stocks: ["NVDA"],
  until: null
})

/** A filled buy of $500 of Apple, with what `story` changes. */
export const appleBuy = (story: Partial<Extract<JournalStory, { _tag: "Trade" }>> = {}): JournalStory => ({
  _tag: "Trade",
  trade: "Buy $500.00 of Apple",
  side: "buy",
  symbol: "AAPL",
  moment: "filled",
  policy: null,
  decision: null,
  why: null,
  ...story
})
