// A journal entry read back into its parts. The server writes each entry as one sentence (`journalOfIntent`,
// `journalOfRun`, `journalOfJudgment` in the domain) and keeps only its kind and the records it points at, so the
// trade, its moment, the policy that refused it and the reason are read from that sentence's fixed wording. An entry
// that doesn't read as its kind (older wording) stays a note, shown as written.
import type { RunOutcome } from "@bluechip/domain/automations/Run"
import type { JournalEntry } from "@bluechip/domain/journal/Journal"
import { StockSymbol } from "@bluechip/domain/market/Market"
import { POLICIES } from "@bluechip/domain/policies/AgentSpec"

/** The moment of a trade an entry tells. */
export type TradeMoment =
  | "filled"
  | "sent"
  | "blocked"
  | "needsApproval"
  | "waiting"
  | "approved"
  | "failed"
  | "declined"
  | "expired"
  | "cancelled"

export type JournalStory =
  | {
    readonly _tag: "Trade"
    /** "Buy $500.00 of Apple", as the server wrote it. */
    readonly trade: string
    readonly side: "buy" | "sell"
    /** Its stock, when its name is one bluechip knows. */
    readonly symbol: StockSymbol | null
    readonly moment: TradeMoment
    /** The refusing policy's title, for a blocked trade. */
    readonly policy: string | null
    /** What was decided: the policy's words, the limit it went over, or what it waits for. */
    readonly decision: string | null
    readonly why: string | null
  }
  | { readonly _tag: "Run"; readonly automation: string; readonly outcome: RunOutcome; readonly reason: string }
  | {
    readonly _tag: "Judgment"
    readonly automation: string
    readonly headline: string
    readonly verdict: boolean
    readonly confidence: number
    readonly reason: string
  }
  | { readonly _tag: "Note"; readonly text: string }

const ENDINGS: ReadonlyArray<readonly [string, TradeMoment]> = [
  [": filled.", "filled"],
  [": failed onchain, nothing was traded.", "failed"],
  [": you declined it.", "declined"],
  [": expired before it was answered.", "expired"],
  [": cancelled before it was sent.", "cancelled"],
  [": you approved it, and it waits for your Face ID.", "approved"],
  [", sent within its policies.", "sent"]
]

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// The trade, then how its sentence goes on: a fixed ending, a refusal, or a decision ("Over its $100 limit…",
// "It asks you first…", "Waiting: …") or nothing before the reason. The stock's name is matched lazily, so it ends
// at the first of these.
const TRADE = new RegExp(
  `^(Buy|Sell) (.+?) of (.+?)(${ENDINGS.map(([ending]) => escape(ending)).join("|")}|, blocked by (.+)|\\.\\s*` +
    `((?:Over its|It asks you first|Waiting:).*)?)$`,
  "s"
)

const RUN = /^Automation "(.*)" (proposed trades|asked you first|let you know|skipped|failed): (.*)$/s

const RUN_OUTCOMES: Readonly<Record<string, RunOutcome>> = {
  "proposed trades": "proposed",
  "asked you first": "asked",
  "let you know": "notified",
  skipped: "skipped",
  failed: "failed"
}

const JUDGMENT = /^Automation "(.*?)" judged "(.*)": (yes|no), (\d+)% sure\.\s*(.*)$/s

const tradeOf = (sentence: string, nameOf: (symbol: StockSymbol) => string): JournalStory | null => {
  const split = sentence.indexOf(" Why: ")
  const head = split === -1 ? sentence : sentence.slice(0, split)
  const why = split === -1 ? null : sentence.slice(split + " Why: ".length).trim() || null

  const match = TRADE.exec(head)
  if (match === null) return null
  const [, verb, amount, name, ending, refusal, decided] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
    string | undefined,
    string | undefined
  ]

  const trade = `${verb} ${amount} of ${name}`
  const side = verb === "Buy" ? "buy" : "sell"
  const symbol = StockSymbol.literals.find((symbol) => nameOf(symbol) === name || symbol === name) ?? null
  const fixed = ENDINGS.find(([text]) => text === ending)
  if (fixed !== undefined) {
    return { _tag: "Trade", trade, side, symbol, moment: fixed[1], policy: null, decision: null, why }
  }

  if (refusal !== undefined) {
    const policy = POLICIES.map((entry) => entry.title).find((title) => refusal.startsWith(`${title}: `))
    return {
      _tag: "Trade",
      trade,
      side,
      symbol,
      moment: "blocked",
      policy: policy ?? null,
      decision: policy === undefined ? refusal : refusal.slice(policy.length + 2),
      why
    }
  }

  const moment = decided?.startsWith("Waiting:") ? "waiting" : "needsApproval"
  return { _tag: "Trade", trade, side, symbol, moment, policy: null, decision: decided?.trim() || null, why }
}

/** An entry's parts: its trade and moment, its automation's run or judgment, or the sentence as a note. */
export const storyOf = (
  entry: Pick<JournalEntry, "kind" | "entry">,
  nameOf: (symbol: StockSymbol) => string
): JournalStory => {
  const note: JournalStory = { _tag: "Note", text: entry.entry }

  switch (entry.kind) {
    case "intent":
      return tradeOf(entry.entry, nameOf) ?? note
    case "automation": {
      const match = RUN.exec(entry.entry)
      if (match === null) return note
      return { _tag: "Run", automation: match[1]!, outcome: RUN_OUTCOMES[match[2]!]!, reason: match[3]!.trim() }
    }
    case "judgment": {
      const match = JUDGMENT.exec(entry.entry)
      if (match === null) return note
      return {
        _tag: "Judgment",
        automation: match[1]!,
        headline: match[2]!,
        verdict: match[3] === "yes",
        confidence: Number(match[4]) / 100,
        reason: match[5]!.trim()
      }
    }
  }
}
