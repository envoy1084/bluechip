// What a preview agent's journal says: its trades in the server's words (`journalOfIntent`), varied the way a real
// agent's are (filled, sent, blocked by a policy, waiting for you or for prices, approved, failed, declined, expired,
// cancelled) and sized by its limits, plus its automations' runs and judgments.
import type { AgentLimits } from "@bluechip/domain/automations/AgentLimits"
import type { AutomationRun, Judgment } from "@bluechip/domain/automations/Run"
import type { AgentId, AutomationId, JournalEntryId } from "@bluechip/domain/Ids"
import type { Decision, Intent, Leg } from "@bluechip/domain/intents/Intent"
import { JournalEntry, journalOfIntent, journalOfJudgment, journalOfRun } from "@bluechip/domain/journal/Journal"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"
import { type AgentRecord, type IdCounter, nextId } from "./AgentRecord.ts"
import { stockName } from "./stockName.ts"

const WHY: Readonly<Record<Leg["side"], ReadonlyArray<string>>> = {
  buy: [
    "Momentum after a strong earnings week.",
    "Back toward its target mix.",
    "A dip under its 20-day average.",
    "Its scheduled buy."
  ],
  sell: [
    "Taking some profit after a run-up.",
    "Back toward its target mix.",
    "It fell 10% from its high."
  ]
}

const refused = (policy: "trade" | "cashReserve", message: string): Decision => ({
  _tag: "Refused",
  policy,
  error: null,
  stock: null,
  message
})

/** The moments of a trade the journal tells, and how the panel names them. */
export const TRADE_MOMENTS = [
  { value: "filled", label: "Filled" },
  { value: "sent", label: "Sent" },
  { value: "blocked", label: "Blocked" },
  { value: "approval", label: "Needs approval" },
  { value: "waiting", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "failed", label: "Failed" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" }
] as const

export type TradeMoment = (typeof TRADE_MOMENTS)[number]["value"]

// What the intent was at that moment; a trade over its largest one needs your approval, and a refusal comes from one
// of two policies (`turn` picks which).
const momentOf = (
  moment: TradeMoment,
  options: { readonly maxPerTrade: Usdc; readonly at: DateTime.Utc; readonly turn: number }
): Pick<Intent, "status" | "decision"> => {
  switch (moment) {
    case "filled":
      return { status: "filled", decision: null }
    case "sent":
      return { status: "sending", decision: { _tag: "Passes", callGasLimit: BigInt(420_000) } }
    case "blocked":
      return {
        status: "blocked",
        decision: options.turn % 2 === 0 ?
          refused("cashReserve", "It keeps some of your money in cash.") :
          refused("trade", "It has used today's budget.")
      }
    case "approval":
      return { status: "needsApproval", decision: { _tag: "OverLargestTrade", maxPerTrade: options.maxPerTrade } }
    case "waiting":
      return {
        status: "waiting",
        decision: { _tag: "Wait", reason: "pricesStale", until: DateTime.add(options.at, { minutes: 5 }) }
      }
    case "approved":
      return { status: "awaitingSignature", decision: null }
    case "failed":
      return { status: "failed", decision: null }
    case "declined":
      return { status: "declined", decision: null }
    case "expired":
      return { status: "expired", decision: null }
    case "cancelled":
      return { status: "cancelled", decision: null }
  }
}

const CYCLE: ReadonlyArray<readonly [TradeMoment, Leg["side"]]> = [
  ["filled", "buy"],
  ["filled", "buy"],
  ["sent", "buy"],
  ["filled", "sell"],
  ["blocked", "buy"],
  ["filled", "buy"],
  ["approval", "buy"],
  ["filled", "sell"],
  ["declined", "buy"],
  ["waiting", "buy"],
  ["filled", "buy"],
  ["blocked", "buy"],
  ["approved", "buy"],
  ["filled", "sell"],
  ["expired", "sell"],
  ["failed", "buy"],
  ["filled", "buy"],
  ["cancelled", "sell"]
]

/** One journal entry. */
const journalEntry = (
  ids: IdCounter,
  agentId: AgentId,
  at: DateTime.Utc,
  entry: Pick<JournalEntry, "kind" | "entry" | "refs">
): JournalEntry => new JournalEntry({ id: nextId(ids, "journal") as JournalEntryId, agentId, at, ...entry })

/**
 * The entry for one of its trades at `moment`, on a side its direction allows: a share of its largest trade, or
 * half as much again when it needs your approval.
 */
export const tradeEntry = (
  ids: IdCounter,
  record: Pick<AgentRecord, "id">,
  options: {
    readonly moment: TradeMoment
    readonly side: Leg["side"]
    readonly symbol: StockSymbol
    readonly limits: AgentLimits
    readonly share: number
    readonly at: DateTime.Utc
  }
): JournalEntry => {
  const { direction } = options.limits
  const side = direction === "buy" ? "buy" : direction === "sell" ? "sell" : options.side
  const largest = Usdc.make(options.limits.maxPerTrade ?? BigInt(100_000_000))
  const share = options.moment === "approval" || options.moment === "approved" ? 1.5 : options.share
  const amount = Usdc.make(BigInt(Math.round(Number(largest) * share / 1_000_000)) * BigInt(1_000_000))
  const why = WHY[side]

  return journalEntry(ids, record.id, options.at, {
    kind: "intent",
    entry: journalOfIntent({
      ...momentOf(options.moment, { maxPerTrade: largest, at: options.at, turn: ids.next }),
      leg: { symbol: options.symbol, side, amount: { usdc: amount } },
      reason: why[ids.next % why.length]!
    }, stockName)!,
    refs: {}
  })
}

/**
 * Its trades over the days it traded, about one a day (at most 30) up to `until` (when it stopped), cycling through
 * the moments over its stocks, newest first.
 */
export const tradeHistory = (
  ids: IdCounter,
  record: Pick<AgentRecord, "id">,
  options: {
    readonly limits: AgentLimits
    readonly from: DateTime.Utc
    readonly until: DateTime.Utc
  }
): Array<JournalEntry> => {
  const { stocks } = options.limits
  const hours = (DateTime.toEpochMillis(options.until) - DateTime.toEpochMillis(options.from)) / 3_600_000
  if (stocks.length === 0 || hours < 24) return []

  const count = Math.min(30, Math.floor(hours / 20))
  return Array.from({ length: count }, (_, index) => {
    const [moment, side] = CYCLE[index % CYCLE.length]!
    return tradeEntry(ids, record, {
      moment,
      side,
      symbol: stocks[index % stocks.length]!,
      limits: options.limits,
      share: [1, 0.5, 0.8, 0.4, 0.6][index % 5]!,
      at: DateTime.subtract(options.until, { hours: 2 + Math.round((index * hours) / (count + 1)) })
    })
  })
}

/** Keeps the journal newest first. */
export const sortJournal = (record: AgentRecord) => {
  record.journal.sort((a, b) => DateTime.toEpochMillis(b.at) - DateTime.toEpochMillis(a.at))
}

/** The entries a run of one of its automations writes: the run, and each judgment a model answered in it. */
export const runEntries = (
  ids: IdCounter,
  agentId: AgentId,
  automation: { readonly id: AutomationId; readonly name: string },
  run: AutomationRun,
  judgments: ReadonlyArray<Judgment>
): Array<JournalEntry> => [
  ...judgments.filter((judgment) => judgment.runId === run.id).map((judgment) =>
    journalEntry(ids, agentId, judgment.at, {
      kind: "judgment",
      entry: journalOfJudgment({
        automationName: automation.name,
        headline: judgment.inputs.headline,
        answer: judgment.answer
      }),
      refs: { automationId: automation.id, runId: run.id, judgmentId: judgment.id }
    })
  ),
  journalEntry(ids, agentId, run.firedAt, {
    kind: "automation",
    entry: journalOfRun({ automationName: automation.name, outcome: run.outcome, reason: run.reason }),
    refs: { automationId: automation.id, runId: run.id }
  })
]
