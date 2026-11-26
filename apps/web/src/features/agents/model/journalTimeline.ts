// The journal as one story: its entries, read into their parts, with each time the agent's rules were locked,
// changed, renewed or ran out (from its sessions, which the journal itself doesn't hold), newest first.
import type { AgentSession, SessionAuthor } from "@bluechip/domain/agents/Agent"
import type { JournalEntry } from "@bluechip/domain/journal/Journal"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { compareSpecs, type PolicyChange, policyOf } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import * as DateTime from "effect/DateTime"
import { type JournalStory, storyOf } from "./journalStory.ts"

/** What happened to its rules. */
export type RulesChange = "locked" | "changed" | "renewed" | "ranOut"

export interface RulesMoment {
  readonly _tag: "Rules"
  readonly id: string
  readonly at: DateTime.Utc
  readonly change: RulesChange
  readonly by: SessionAuthor
  /** Each policy that moved, in words: "Trade size tightened", "Cash reserve added". */
  readonly moved: ReadonlyArray<string>
  /** The stocks it may trade under these rules. */
  readonly stocks: ReadonlyArray<StockSymbol>
  /** When these rules run out, while they're the ones in force. */
  readonly until: DateTime.Utc | null
}

/** A model's judgment in one of its automations' runs. */
export interface JudgedEntry {
  readonly entry: JournalEntry
  readonly story: Extract<JournalStory, { _tag: "Judgment" }>
}

export type JournalLine =
  | {
    readonly _tag: "Entry"
    readonly id: string
    readonly at: DateTime.Utc
    readonly entry: JournalEntry
    readonly story: JournalStory
    /** A run's judgments in the order they were made, told inside it; empty for every other entry. */
    readonly judgments: ReadonlyArray<JudgedEntry>
  }
  | RulesMoment

/** What the journal can be narrowed to. */
export type JournalFilter = "all" | "trades" | "automations" | "rules"

export const JOURNAL_FILTERS: ReadonlyArray<{ readonly value: JournalFilter; readonly label: string }> = [
  { value: "all", label: "All" },
  { value: "trades", label: "Trades" },
  { value: "automations", label: "Automations" },
  { value: "rules", label: "Rules" }
]

const CHANGED: Readonly<Record<PolicyChange["change"], string>> = {
  added: "added",
  removed: "removed",
  tighter: "tightened",
  looser: "loosened",
  same: "kept"
}

/**
 * Each time its rules took force or ran out: a session that landed was its first rules, a change of the ones before
 * (the policies that moved) or the same rules renewed; one that expired ran out when it ended. Newest first.
 */
export const rulesMoments = (sessions: ReadonlyArray<AgentSession>): Array<RulesMoment> => {
  const oldestFirst = sessions.toSorted((a, b) =>
    DateTime.toEpochMillis(a.createdAt) - DateTime.toEpochMillis(b.createdAt)
  )

  return oldestFirst.flatMap((session, index): Array<RulesMoment> => {
    if (session.installedAt === null) return []

    const previous = oldestFirst.slice(0, index).findLast((earlier) => earlier.installedAt !== null)
    const moved = previous === undefined ?
      [] :
      compareSpecs(previous.spec, session.spec).policies
        .filter(({ policy }) => !policyOf(policy).hidden)
        .map(({ change, policy }) => `${policyOf(policy).title} ${CHANGED[change]}`)
    const base = {
      _tag: "Rules",
      by: session.createdBy,
      moved,
      stocks: configOf(session.spec.policies, trade)?.stocks ?? []
    } as const

    const took: RulesMoment = {
      ...base,
      id: `${session.id} took`,
      at: session.installedAt,
      change: previous === undefined ? "locked" : moved.length === 0 ? "renewed" : "changed",
      until: session.status === "active" ? session.validUntil : null
    }
    if (session.status !== "expired" || session.endedAt === null) return [took]
    return [took, { ...base, id: `${session.id} ranOut`, at: session.endedAt, change: "ranOut", until: null }]
  }).toSorted((a, b) => DateTime.toEpochMillis(b.at) - DateTime.toEpochMillis(a.at))
}

/**
 * The entries loaded so far, read into their parts, with the rules moments of the same span, newest first: older
 * moments wait for the page that reaches them, unless `complete` (no older entries), when every one is shown. A
 * judgment whose run is loaded too is told inside that run, so the automation is named once.
 */
export const journalLines = (
  entries: ReadonlyArray<JournalEntry>,
  rules: ReadonlyArray<RulesMoment>,
  options: { readonly complete: boolean; readonly nameOf: (symbol: StockSymbol) => string }
): Array<JournalLine> => {
  const oldest = entries.at(-1)?.at
  const reached = options.complete ?
    rules :
    oldest === undefined ?
    [] :
    rules.filter((moment) => DateTime.isGreaterThanOrEqualTo(moment.at, oldest))

  const read = entries.map((entry) => ({ entry, story: storyOf(entry, options.nameOf) }))
  const judged = read.filter((line): line is JudgedEntry => line.story._tag === "Judgment")
  const runs = new Set(
    read.flatMap(({ entry, story }) => story._tag === "Run" && entry.refs.runId !== undefined ? [entry.refs.runId] : [])
  )

  const lines: Array<JournalLine> = [
    ...read.flatMap(({ entry, story }): Array<JournalLine> => {
      const runId = entry.refs.runId
      if (story._tag === "Judgment" && runId !== undefined && runs.has(runId)) return []
      return [{
        _tag: "Entry",
        id: entry.id,
        at: entry.at,
        entry,
        story,
        judgments: story._tag === "Run" && runId !== undefined ?
          judged.filter((line) => line.entry.refs.runId === runId).toReversed() :
          []
      }]
    }),
    ...reached
  ]
  return lines.toSorted((a, b) => DateTime.toEpochMillis(b.at) - DateTime.toEpochMillis(a.at))
}

/** Which filter a line belongs to; a note belongs to the kind of entry it was written for. */
export const filterOf = (line: JournalLine): Exclude<JournalFilter, "all"> => {
  if (line._tag === "Rules") return "rules"
  return line.entry.kind === "intent" ? "trades" : "automations"
}
