/**
 * What the assistant remembers about you: short facts with where they came from, which you can see and delete. Said
 * facts are yours; inferred ones the assistant only keeps for prompts once it is confident or you confirmed them.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { AgentId, ConversationId, MemoryId, MessageId } from "../Ids.ts"

/**
 * What a memory is about: how you like things done, a limit you set, what you are working towards, or a fact.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const MemoryKind = Schema.Literals(["preference", "constraint", "goal", "fact"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type MemoryKind = typeof MemoryKind.Type

/**
 * Where it came from: you said it, or the assistant inferred it from what you said.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const MemorySource = Schema.Literals(["said", "inferred"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type MemorySource = typeof MemorySource.Type

/**
 * The longest memory, in characters: one sentence.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MAX_MEMORY_LENGTH = 300

/**
 * A memory's text: one trimmed sentence.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const MemoryText = Schema.Trimmed.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_MEMORY_LENGTH))

/**
 * A memory as you see it on the memory page.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Memory extends Schema.Class<Memory>("@bluechip/domain/assistant/Memory/Memory")({
  id: MemoryId,
  /** The agent it is about; `null` when it is about you. */
  agentId: Schema.NullOr(AgentId),
  kind: MemoryKind,
  text: MemoryText,
  source: MemorySource,
  /** How sure the assistant was, from 0 to 1 (1 for what you said). */
  confidence: Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  /** Why it is there, when it replaced an older memory that said otherwise. */
  note: Schema.NullOr(Schema.String),
  /** The message it was learned from. */
  messageId: Schema.NullOr(MessageId),
  /** When you confirmed it; an unconfirmed memory never reaches a prompt. */
  confirmedAt: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  /** When it was last recalled for an answer. */
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtc),
  /** How many answers it was recalled for. */
  uses: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
}) {}

/**
 * What a conversation was about up to a point, kept so long conversations and later ones can recall it.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class ConversationSummary
  extends Schema.Class<ConversationSummary>("@bluechip/domain/assistant/Memory/ConversationSummary")({
    conversationId: ConversationId,
    text: Schema.String,
    updatedAt: Schema.DateTimeUtc
  })
{}

/**
 * A conversation is summarised once more than this many messages follow its summary (or its start).
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const SUMMARY_AFTER = 12

/**
 * The latest turns (your messages and the answers to them) a summary never covers: prompts carry them word for word.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const KEEP_TURNS = 4

/**
 * Where a conversation's summary should now end, given its messages' roles in order and how many the summary covers
 * already: the count of messages to cover (up to, not including, the first of the {@link KEEP_TURNS} latest turns),
 * or `undefined` while fewer than {@link SUMMARY_AFTER} messages follow it.
 *
 * **Example** (Sixteen messages, none summarised)
 *
 * ```ts import.meta.vitest
 * import { summaryCut } from "@bluechip/domain/assistant/Memory"
 *
 * summaryCut(Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? "user" : "assistant")), 0) // => 8
 * ```
 *
 * @stability unstable
 * @category decisions
 * @since 0.0.0
 */
export const summaryCut = (
  roles: ReadonlyArray<"user" | "assistant">,
  summarized: number
): number | undefined => {
  if (roles.length - summarized <= SUMMARY_AFTER) return undefined
  const turns = roles.flatMap((role, index) => index >= summarized && role === "user" ? [index] : [])
  if (turns.length <= KEEP_TURNS) return undefined
  const cut = turns[turns.length - KEEP_TURNS]!
  return cut > summarized ? cut : undefined
}

/**
 * Everything the assistant remembers about you, to download: your memories (with how often each was used) and the
 * summaries of your conversations.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class MemoryExport extends Schema.Class<MemoryExport>("@bluechip/domain/assistant/Memory/MemoryExport")({
  exportedAt: Schema.DateTimeUtc,
  memories: Schema.Array(Memory),
  summaries: Schema.Array(ConversationSummary)
}) {}

/**
 * A memory the model proposes after a turn: `replaces` names a memory it contradicts. Its text is a plain string, not
 * {@link MemoryText}: a trimmed, length-bounded string held Anthropic's constrained decoding in a loop, so the bounds
 * are checked by {@link planMemoryWrite} instead.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const MemoryCandidate = Schema.Struct({
  kind: MemoryKind,
  text: Schema.String.annotate({ description: "One short sentence in the second person, e.g. 'You avoid Tesla.'" }),
  source: MemorySource.annotate({
    description: "`said` when the user stated it outright, `inferred` when you concluded it from what they said."
  }),
  confidence: Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 1 })).annotate({
    description: "How sure you are that this is true and worth remembering, from 0 to 1."
  }),
  replaces: Schema.NullOr(Schema.String).annotate({
    description: "The id of an existing memory this one contradicts, or null."
  })
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type MemoryCandidate = typeof MemoryCandidate.Type

/**
 * Below this confidence a candidate is dropped.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MIN_CONFIDENCE = 0.5

/**
 * Inferred candidates below this confidence are kept unconfirmed and shown as a card to confirm.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const CONFIRM_CONFIDENCE = 0.8

/**
 * A guess left unconfirmed this many days is stale, and dropped.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const STALE_GUESS_DAYS = 30

/**
 * What to do with one candidate: nothing, keep it (confirmed or waiting for you), refresh the memory it repeats, or
 * replace the memory it contradicts (the new one keeps a note of the old).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type MemoryWrite =
  | { readonly _tag: "Skip"; readonly reason: "unsure" | "duplicate" | "invalid" }
  | { readonly _tag: "Add"; readonly confirmed: boolean }
  | { readonly _tag: "Refresh"; readonly memoryId: MemoryId; readonly confirm: boolean }
  | { readonly _tag: "Replace"; readonly memoryId: MemoryId; readonly confirmed: boolean; readonly note: string }

const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()

/**
 * Decides a candidate against the memories you have: blank or overlong text and unsure ones are dropped; a repeat of a memory (same kind, same
 * words) refreshes it, and confirms it when the repeat is confident; a contradiction replaces the memory it names;
 * anything else is added, confirmed unless it is a guess the assistant isn't sure of.
 *
 * **Example** (A repeat)
 *
 * ```ts import.meta.vitest
 * import { planMemoryWrite } from "@bluechip/domain/assistant/Memory"
 *
 * const existing = [{ id: "memory_01jd8v4t5m6n7a8q9r0s1t2v3w", kind: "preference", text: "You avoid Tesla.", confirmedAt: null }] as never
 * planMemoryWrite(existing, { kind: "preference", text: "You avoid tesla", source: "said", confidence: 0.9, replaces: null })
 * // => { _tag: "Refresh", memoryId: "memory_01jd8v4t5m6n7a8q9r0s1t2v3w", confirm: true }
 * ```
 *
 * @stability unstable
 * @category decisions
 * @since 0.0.0
 */
export const planMemoryWrite = (
  existing: ReadonlyArray<Pick<Memory, "id" | "kind" | "text" | "confirmedAt">>,
  candidate: MemoryCandidate
): MemoryWrite => {
  const text = candidate.text.trim()
  if (text.length === 0 || text.length > MAX_MEMORY_LENGTH) return { _tag: "Skip", reason: "invalid" }
  if (candidate.confidence < MIN_CONFIDENCE) return { _tag: "Skip", reason: "unsure" }
  const confirmed = candidate.source === "said" || candidate.confidence >= CONFIRM_CONFIDENCE

  const repeat = existing.find((memory) => memory.kind === candidate.kind && normalize(memory.text) === normalize(text))
  if (repeat !== undefined) {
    if (repeat.confirmedAt !== null || !confirmed) return { _tag: "Skip", reason: "duplicate" }
    return { _tag: "Refresh", memoryId: repeat.id, confirm: true }
  }

  const replaced = existing.find((memory) => memory.id === candidate.replaces)
  if (replaced !== undefined) {
    return { _tag: "Replace", memoryId: replaced.id, confirmed, note: `Replaces "${replaced.text}"` }
  }
  return { _tag: "Add", confirmed }
}
