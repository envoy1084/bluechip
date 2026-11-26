// The domain records the assistant's cards carry, made from the cast: its agents as `Agent`s, quotes, trades and
// automations, with stock names and prices fixed so a card reads the same on every load.
import { Agent, type AgentStatus } from "@bluechip/domain/agents/Agent"
import { Automation, type AutomationDraft, describeAutomation } from "@bluechip/domain/automations/Automation"
import type {
  Address,
  AgentId,
  AutomationId,
  IntentId,
  MessageId,
  SigningRequestId,
  TradeId
} from "@bluechip/domain/Ids"
import { type Decision, Intent, IntentRequest, type IntentStatus, type Leg } from "@bluechip/domain/intents/Intent"
import { Quote, ReferencePrice, type StockSymbol } from "@bluechip/domain/market/Market"
import { Price, Shares, sharesFor, Usdc } from "@bluechip/domain/market/Units"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { describeSpec, type SpecDescription } from "@bluechip/domain/policies/Catalog"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { TICKERS } from "@bluechip/ui/lib/tickers"
import * as DateTime from "effect/DateTime"
import type { CastAgent, CastAgentState } from "../cast.ts"
import type { Mint } from "./mint.ts"

/** A stock's name, as the app shows it. */
export const nameOf = (symbol: StockSymbol): string =>
  TICKERS.find((ticker) => ticker.symbol === symbol)?.name ?? symbol

// Dollars a share: close enough to the market's for a card, never read as the real price.
const DOLLARS: Readonly<Record<StockSymbol, number>> = {
  AAPL: 232.18,
  AMZN: 221.4,
  ANT: 410,
  CRCL: 128.6,
  GOOGL: 246.75,
  INTC: 24.9,
  META: 712.3,
  MSFT: 512.06,
  MSTR: 342.5,
  NVDA: 178.42,
  SNDK: 96.3,
  SPCX: 185,
  TSLA: 341.9
}

export const priceOf = (symbol: StockSymbol): Price => Price.make(BigInt(Math.round(DOLLARS[symbol] * 1e8)))

export const usdc = (dollars: number): Usdc => Usdc.make(BigInt(Math.round(dollars * 1e6)))

export const shares = (count: number): Shares => Shares.make(BigInt(Math.round(count * 1e8)))

const AGENT_STATUS: Readonly<Record<CastAgentState, { readonly status: AgentStatus; readonly paused: boolean }>> = {
  active: { status: "active", paused: false },
  doneForToday: { status: "active", paused: false },
  asking: { status: "active", paused: false },
  paused: { status: "active", paused: true },
  draft: { status: "draft", paused: false },
  locking: { status: "locking", paused: false },
  updating: { status: "updating", paused: false },
  removing: { status: "removing", paused: false },
  expired: { status: "expired", paused: false },
  removed: { status: "removed", paused: false }
}

export const specOf = (agent: Pick<CastAgent, "template" | "preset" | "stocks" | "targets">): AgentSpec =>
  draftSpec({ template: agent.template, preset: agent.preset, stocks: agent.stocks, targets: agent.targets })

export const describe = (spec: AgentSpec): SpecDescription => describeSpec(spec, nameOf)

/** A cast agent as the API shows it, in the state the cast gives it (or `status`). */
export const agentOf = (mint: Mint, agent: CastAgent, status?: AgentStatus): Agent => {
  const standing = AGENT_STATUS[agent.state]
  const created = mint.at(agent.ageDays * 24)
  const live = (status ?? standing.status) !== "draft"
  return new Agent({
    id: agent.id,
    name: agent.name,
    template: agent.template,
    status: status ?? standing.status,
    paused: standing.paused,
    spec: specOf(agent),
    pendingSpec: (status ?? standing.status) === "updating" ?
      specOf({ ...agent, preset: agent.preset === "active" ? "balanced" : "active" }) :
      null,
    lockedUntil: live ? DateTime.add(created, { days: 90 }) : null,
    createdAt: created
  })
}

/** An agent the assistant drafts in chat, not in the cast (a new person has none). */
export const draftedAgent = (
  mint: Mint,
  draft: Pick<CastAgent, "name" | "template" | "preset" | "stocks" | "targets">,
  status: AgentStatus = "draft"
): Agent =>
  new Agent({
    id: mint.id("agent") as AgentId,
    name: draft.name,
    template: draft.template,
    status,
    paused: false,
    spec: specOf(draft),
    pendingSpec: null,
    lockedUntil: status === "draft" ? null : DateTime.add(mint.at(0), { days: 90 }),
    createdAt: mint.at(0.1)
  })

const POOL = "0x4e962bb3889bf030368f56810a9c96b83cb3e778" as Address

/** What buying `dollars` of `symbol` (or selling `sold` shares) gets in its pool now. */
export const quoteOf = (mint: Mint, leg: Leg): Quote => {
  const price = priceOf(leg.symbol)
  const spent = "usdc" in leg.amount ? leg.amount.usdc : usdc(Number(leg.amount.shares) / 1e8 * DOLLARS[leg.symbol])
  const got = "shares" in leg.amount ? leg.amount.shares : sharesFor(spent, price)
  return new Quote({
    symbol: leg.symbol,
    side: leg.side,
    usdc: spent,
    shares: got,
    price: Price.make(price + price / BigInt(500)),
    reference: new ReferencePrice({ symbol: leg.symbol, price, updatedAt: mint.at(0.01), status: "live" }),
    gapBps: 20,
    minimumOut: (leg.side === "buy" ? got : spent) * BigInt(995) / BigInt(1000),
    pool: POOL,
    quotedAt: mint.at(0),
    expiresAt: DateTime.add(mint.at(0), { minutes: 2 })
  })
}

/** A trade as an intent: an agent's (decided by its policies) or your own (waiting for your Face ID). */
export const intentOf = (mint: Mint, options: {
  readonly agentId: AgentId | null
  readonly leg: Leg
  readonly reason: string
  readonly status: IntentStatus
  readonly decision: Decision | null
  readonly hoursAgo?: number
}): Intent => {
  const at = mint.at(options.hoursAgo ?? 0)
  return new Intent({
    id: mint.id("intent") as IntentId,
    agentId: options.agentId,
    source: "assistant",
    executor: options.agentId === null ? "owner" : "agent",
    leg: options.leg,
    reason: options.reason,
    status: options.status,
    decision: options.decision,
    batch: null,
    tradeId: options.status === "filled" ? mint.id("trade") as TradeId : null,
    expiresAt: options.status === "needsApproval" || options.status === "awaitingSignature" ?
      DateTime.add(at, { hours: 24 }) :
      null,
    createdAt: at,
    updatedAt: at
  })
}

/** The WebAuthn request Face ID signs in preview: any answer is accepted. */
export const CEREMONY = {
  challenge: "cHJldmlldy1jaGFsbGVuZ2U",
  rpId: "localhost",
  timeout: 60_000,
  userVerification: "required",
  allowCredentials: []
}

/** Your own trade prepared for Face ID; `expired` when its two minutes ran out. */
export const intentRequestOf = (mint: Mint, intent: Intent, expired: boolean): IntentRequest => {
  const quote = quoteOf(mint, intent.leg)
  return new IntentRequest({
    id: mint.id("signing") as SigningRequestId,
    options: CEREMONY,
    intent,
    quote,
    warnings: [],
    together: [],
    deploysAccount: mint.cast.holdings.length === 0,
    expiresAt: expired ? mint.at(0.5) : DateTime.add(mint.at(0), { minutes: 2 })
  })
}

/** A saved automation from a draft, as confirming its card left it. */
export const automationOf = (
  mint: Mint,
  draft: AutomationDraft,
  options: {
    readonly createdFrom: MessageId | null
    readonly status?: Automation["status"]
    /** A saved automation's own id and name, for a change to it. */
    readonly id?: AutomationId
    readonly name?: string
  }
): Automation => {
  const at = mint.at(0)
  return new Automation({
    id: options.id ?? mint.id("automation") as AutomationId,
    name: options.name ?? draft.name,
    agentId: draft.agentId,
    trigger: draft.trigger,
    conditions: draft.conditions,
    action: draft.action,
    settings: draft.settings,
    status: options.status ?? "active",
    fires: 0,
    lastFiredAt: null,
    nextRunAt: draft.trigger.type === "schedule" ? DateTime.add(at, { days: 3 }) : null,
    createdBy: "assistant",
    createdFrom: options.createdFrom,
    description: describeAutomation(draft, nameOf),
    createdAt: at,
    updatedAt: at
  })
}
