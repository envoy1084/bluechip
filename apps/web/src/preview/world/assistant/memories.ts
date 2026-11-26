// What the assistant remembers in each scenario: facts you said, guesses it keeps only once you confirm them, some
// about an agent, some replacing older ones, with how often answers used them.
import { ConversationSummary, Memory, type MemoryKind, type MemorySource } from "@bluechip/domain/assistant/Memory"
import type { AgentId, ConversationId, MemoryId, MessageId } from "@bluechip/domain/Ids"
import type { Cast } from "../cast.ts"
import type { Mint } from "./mint.ts"

export interface MemoryDraft {
  readonly kind: MemoryKind
  readonly text: string
  readonly source: MemorySource
  readonly confidence: number
  readonly agentId?: AgentId | null
  /** `null`: not confirmed yet. */
  readonly confirmedHoursAgo: number | null
  readonly hoursAgo: number
  readonly uses?: number
  readonly note?: string | null
  readonly messageId?: MessageId | null
}

export const memoryOf = (mint: Mint, draft: MemoryDraft): Memory => {
  const uses = draft.confirmedHoursAgo === null ? 0 : draft.uses ?? 0
  return new Memory({
    id: mint.id("memory") as MemoryId,
    agentId: draft.agentId ?? null,
    kind: draft.kind,
    text: draft.text,
    source: draft.source,
    confidence: draft.confidence,
    note: draft.note ?? null,
    messageId: draft.messageId ?? null,
    confirmedAt: draft.confirmedHoursAgo === null ? null : mint.at(draft.confirmedHoursAgo),
    createdAt: mint.at(draft.hoursAgo),
    lastUsedAt: uses === 0 ? null : mint.at(Math.max(0.2, draft.hoursAgo / 8)),
    uses
  })
}

/** Guesses the panel adds for you to confirm. */
export const GUESSES: ReadonlyArray<Omit<MemoryDraft, "hoursAgo" | "confirmedHoursAgo">> = [
  { kind: "preference", text: "You prefer to buy on Monday mornings.", source: "inferred", confidence: 0.64 },
  { kind: "goal", text: "You're building a long-term position in chip makers.", source: "inferred", confidence: 0.58 },
  { kind: "constraint", text: "You keep at least $1,000 in cash.", source: "inferred", confidence: 0.71 }
]

const said = (kind: MemoryKind, text: string, hoursAgo: number, uses: number): MemoryDraft => ({
  kind,
  text,
  source: "said",
  confidence: 1,
  confirmedHoursAgo: hoursAgo,
  hoursAgo,
  uses
})

const guess = (kind: MemoryKind, text: string, confidence: number, hoursAgo: number): MemoryDraft => ({
  kind,
  text,
  source: "inferred",
  confidence,
  confirmedHoursAgo: null,
  hoursAgo
})

/** The scenario's memories, newest first. */
export const memoriesOf = (mint: Mint, cast: Cast): Array<Memory> => {
  if (cast.scenario === "newPerson") return []
  const [picker, weekly, keeper, guard] = cast.agents

  const typical: ReadonlyArray<MemoryDraft> = [
    { ...guess("preference", "You prefer to buy on Monday mornings.", 0.66, 30) },
    said("constraint", "You never want to own Tesla.", 52, 9),
    { ...said("goal", "You're saving for a house deposit by 2028.", 120, 4) },
    {
      ...said("constraint", "Tech picker should stick to Nvidia, Apple and Microsoft.", 160, 6),
      agentId: picker?.id ?? null
    },
    {
      kind: "fact",
      text: "You're new to investing.",
      source: "inferred",
      confidence: 0.86,
      confirmedHoursAgo: 330,
      hoursAgo: 340,
      uses: 12
    }
  ]
  if (cast.scenario === "typical") return typical.map((draft) => memoryOf(mint, draft))

  const heavy: ReadonlyArray<MemoryDraft> = [
    guess("preference", "You like to hear about trades in Telegram rather than email.", 0.62, 1),
    guess("goal", "You want Nvidia to stay under a fifth of your portfolio.", 0.74, 5),
    { ...guess("constraint", "Tesla guard should never sell more than half at once.", 0.69, 26), agentId: guard?.id },
    said("constraint", "You keep at least $5,000 in cash.", 48, 31),
    {
      ...said("constraint", "You don't want to own more than 40 Nvidia shares.", 72, 14),
      note: "Replaces \"You don't want to own more than 60 Nvidia shares.\""
    },
    { ...said("preference", "Index keeper should rebalance on weekends only.", 96, 8), agentId: keeper?.id ?? null },
    said("goal", "You're aiming for $250,000 by the time you're 45.", 150, 22),
    said("fact", "You hold more Apple in a pension outside bluechip.", 200, 5),
    {
      kind: "preference",
      text: "You like short answers with a table when there are numbers.",
      source: "inferred",
      confidence: 0.91,
      confirmedHoursAgo: 260,
      hoursAgo: 262,
      uses: 47
    },
    { ...said("preference", "Weekly buyer buys on Tuesdays.", 300, 11), agentId: weekly?.id ?? null },
    said("constraint", "You never trade on earnings day.", 420, 3),
    said("fact", "You live in London, so New York's open is 2:30 pm for you.", 640, 19),
    said("goal", "You want to learn how rebalancing works before using it more.", 880, 2),
    {
      kind: "fact",
      text: "You first heard about bluechip from a friend at work.",
      source: "inferred",
      confidence: 0.83,
      confirmedHoursAgo: 900,
      hoursAgo: 900,
      uses: 0
    }
  ]
  return heavy.map((draft) => memoryOf(mint, draft))
}

/** What the long conversations were about, as the memory export shows. */
export const summariesOf = (mint: Mint, cast: Cast): Array<ConversationSummary> =>
  cast.conversations.filter((conversation) => conversation.kind === "longThread" || conversation.kind === "research")
    .map((conversation) =>
      new ConversationSummary({
        conversationId: conversation.id as ConversationId,
        text: conversation.kind === "longThread" ?
          "Planned a mix of 60% large tech, 20% Amazon and Alphabet and 20% cash; renewed the Microsoft buyer, " +
          "removed the retired trader and paused every agent once over a news scare." :
          "Read up on Microsoft's quarter and Azure growth; tightened Tech picker's daily budget.",
        updatedAt: mint.at(conversation.hoursAgo)
      })
    )
