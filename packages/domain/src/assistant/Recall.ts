/**
 * What the assistant recalls for a message: your memories, earlier conversations (their messages and summaries) and
 * your agents' journals, found by words and by meaning, merged by reciprocal rank and weighed by importance and
 * recency, then fitted into the prompt's budget.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { AgentId } from "../Ids.ts"
import type { Memory, MemoryKind } from "./Memory.ts"

/**
 * What a recalled entry is: a memory, a message of an earlier conversation, a conversation's summary, or an entry of
 * an agent's journal.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const RecallKind = Schema.Literals(["memory", "message", "summary", "journal"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type RecallKind = typeof RecallKind.Type

/**
 * One thing recalled for a query, with the id of what it came from (a memory, message, summary or journal entry).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class RecallHit extends Schema.Class<RecallHit>("@bluechip/domain/assistant/Recall/RecallHit")({
  kind: RecallKind,
  sourceId: Schema.String,
  /** The agent it is about, if any. */
  agentId: Schema.NullOr(AgentId),
  text: Schema.String,
  /** When it was said, written or done. */
  at: Schema.DateTimeUtc,
  /** Its rank after fusing and weighing; only the order means something. */
  score: Schema.Number
}) {}

/**
 * Reciprocal rank fusion's constant: a hit's share is `1 / (RRF_K + rank)`, so lists agree more than they compete.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const RRF_K = 60

/**
 * Fuses ranked lists of ids (best first) into one score per id: the sum over lists of `1 / (RRF_K + rank)`, ranks from
 * 1.
 *
 * **Example** (A hit in both lists beats one in one)
 *
 * ```ts import.meta.vitest
 * import { fuseRanks } from "@bluechip/domain/assistant/Recall"
 *
 * const scores = fuseRanks([["a", "b"], ["b"]])
 * scores.get("b")! > scores.get("a")! // => true
 * ```
 *
 * @stability unstable
 * @category decisions
 * @since 0.0.0
 */
export const fuseRanks = (lists: ReadonlyArray<ReadonlyArray<string>>): Map<string, number> => {
  const scores = new Map<string, number>()
  for (const list of lists) {
    list.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + index + 1)))
  }
  return scores
}

/**
 * After this many days unused, an entry's recency counts half; it never falls below half its weight.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const RECENCY_HALF_LIFE_DAYS = 60

/**
 * A fused score weighed by importance (0 to 1: halves the score at 0) and recency (days since it was made or last
 * used: halves it after {@link RECENCY_HALF_LIFE_DAYS}, down to half at most).
 *
 * @stability unstable
 * @category decisions
 * @since 0.0.0
 */
export const weigh = (entry: {
  readonly fused: number
  readonly importance: number
  readonly ageDays: number
}): number =>
  entry.fused * (0.5 + 0.5 * entry.importance) *
  (0.5 + 0.5 * Math.pow(2, -Math.max(0, entry.ageDays) / RECENCY_HALF_LIFE_DAYS))

const MEMORY_IMPORTANCE: Record<MemoryKind, number> = { constraint: 1, goal: 0.8, preference: 0.8, fact: 0.7 }

/**
 * How much an entry matters when recalled: a memory by its kind (a limit you set most) and how sure the assistant
 * was, a summary more than one message, a journal entry in between.
 *
 * @stability unstable
 * @category decisions
 * @since 0.0.0
 */
export const importanceOf = (
  entry:
    | { readonly kind: "memory"; readonly memory: Pick<Memory, "kind" | "confidence"> }
    | { readonly kind: "message" | "summary" | "journal" }
): number => {
  switch (entry.kind) {
    case "memory":
      return MEMORY_IMPORTANCE[entry.memory.kind] * entry.memory.confidence
    case "summary":
      return 0.6
    case "journal":
      return 0.5
    case "message":
      return 0.4
  }
}

/**
 * The prompt's budgets, in characters (about four to a token): what you told it, and what it recalls from earlier.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const PROMPT_BUDGET = { memories: 4000, recalled: 3000 } as const

/**
 * Takes items in order while they fit `budget` characters in all; one too long is skipped and the next tried.
 *
 * @stability unstable
 * @category decisions
 * @since 0.0.0
 */
export const fitBudget = <A extends { readonly text: string }>(items: ReadonlyArray<A>, budget: number): Array<A> => {
  const kept: Array<A> = []
  let left = budget
  for (const item of items) {
    if (item.text.length > left) continue
    kept.push(item)
    left -= item.text.length
  }
  return kept
}

/**
 * The confirmed memories a prompt carries, within the budget: every limit you set first (constraints are rules, never
 * left out while they fit), then the memories recalled for this message, best first, then the rest, newest first.
 * Unconfirmed memories never reach a prompt.
 *
 * @stability unstable
 * @category decisions
 * @since 0.0.0
 */
export const selectMemories = (
  memories: ReadonlyArray<Memory>,
  relevant: ReadonlyArray<string>,
  budget: number
): Array<Memory> => {
  const confirmed = memories.filter((memory) => memory.confirmedAt !== null)
  const rank = (memory: Memory) => {
    const index = relevant.indexOf(memory.id)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }
  const ordered = [...confirmed].sort((a, b) =>
    Number(b.kind === "constraint") - Number(a.kind === "constraint") || rank(a) - rank(b) || b.id.localeCompare(a.id)
  )
  return fitBudget(ordered, budget)
}
