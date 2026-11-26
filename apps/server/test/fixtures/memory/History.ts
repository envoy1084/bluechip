// Two users' memories, and what recall should bring back for each question one of them asks: the right memory first,
// and never one of the other user's.
import type { MemoryKind } from "@bluechip/domain/assistant/Memory"

export interface Remembered {
  readonly kind: MemoryKind
  readonly text: string
}

/** What Ana told the assistant. */
export const ANA: ReadonlyArray<Remembered> = [
  { kind: "constraint", text: "You never want to own Tesla." },
  { kind: "fact", text: "You live in Lisbon." },
  { kind: "goal", text: "You're saving for a house deposit." },
  { kind: "preference", text: "You like chip makers such as Nvidia." },
  { kind: "preference", text: "You prefer small trades under $100." }
]

/** What Ben told it. */
export const BEN: ReadonlyArray<Remembered> = [
  { kind: "constraint", text: "You never want to own Apple." },
  { kind: "fact", text: "You live in Toronto." },
  { kind: "goal", text: "You're saving for retirement." }
]

export interface RecallCase {
  readonly name: string
  /** What Ana asks. */
  readonly query: string
  /** The memory recalled first, or `null` when nothing of hers fits. */
  readonly first: string | null
}

export const RECALL_CASES: ReadonlyArray<RecallCase> = [
  { name: "a stock she avoids", query: "Should I buy Tesla?", first: "You never want to own Tesla." },
  { name: "where she lives", query: "Which city do I live in?", first: "You live in Lisbon." },
  {
    name: "a goal, by another form of its word",
    query: "How are my savings going?",
    first: "You're saving for a house deposit."
  },
  { name: "a preference", query: "Any chip makers worth a look?", first: "You like chip makers such as Nvidia." },
  { name: "a limit she set", query: "Can I make a small trade?", first: "You prefer small trades under $100." },
  { name: "only Ben avoids Apple", query: "Should I buy Apple?", first: null },
  { name: "only Ben lives in Toronto", query: "Toronto", first: null }
]
