// Made-up notifications in the domain's own words: a draft of every kind, built with the drafts the server uses from
// records named after the cast (its agents, automations and stocks), and the list each scenario starts with.
import { baseDeployment } from "@bluechip/chain/deployments/Base"
import { Agent } from "@bluechip/domain/agents/Agent"
import { AutomationRun } from "@bluechip/domain/automations/Run"
import type {
  AutomationId,
  AutomationRunId,
  IntentId,
  JudgmentId,
  NotificationId,
  TransferId
} from "@bluechip/domain/Ids"
import { type Decision, Intent, type Leg } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import {
  digestOf,
  notificationOfAgent,
  notificationOfChatLink,
  notificationOfExpiring,
  notificationOfIntent,
  notificationOfRun,
  notificationOfSessionEnding,
  notificationOfTransfer,
  notificationOfWaiting
} from "@bluechip/domain/notifications/Drafts"
import { kindOf } from "@bluechip/domain/notifications/Kinds"
import { notificationOfAdjustment } from "@bluechip/domain/notifications/LedgerDrafts"
import {
  Notification,
  type NotificationDraft,
  type NotificationKind
} from "@bluechip/domain/notifications/Notification"
import {
  notificationOfDevice,
  notificationOfPasskey,
  notificationOfRecovery,
  notificationOfRecoveryKey
} from "@bluechip/domain/notifications/SecurityDrafts"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { Transfer } from "@bluechip/domain/portfolio/Transfer"
import * as DateTime from "effect/DateTime"
import { ACCOUNT_ADDRESS, type Cast, type CastAgent, type CastAutomation, castOf } from "../cast.ts"
import { previewId } from "../ids.ts"
import { minutesAgo } from "./security.ts"

/** A stock's company name, as the app shows it. */
export const stockName = (symbol: StockSymbol): string =>
  baseDeployment.stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol

/** Where money comes from and goes to in the preview: a wallet of the person's own. */
export const OWN_WALLET = "0x71c7656ec7ab88b098defb751b7401b5f6d8976f"

// A new person has no agents or automations yet; a notification about one names the typical person's.
const agentOf = (cast: Cast, states: ReadonlyArray<CastAgent["state"]>): CastAgent =>
  cast.agents.find((agent) => states.includes(agent.state)) ?? cast.agents[0] ?? castOf("typical").agents[0]!

const automationOf = (cast: Cast, kinds: ReadonlyArray<CastAutomation["kind"]>): CastAutomation =>
  cast.automations.find((automation) => kinds.includes(automation.kind)) ?? cast.automations[0] ??
    castOf("typical").automations[0]!

const usdc = (dollars: number) => Usdc.make(BigInt(Math.round(dollars * 1_000_000)))

const intentOf = (
  n: number,
  at: DateTime.Utc,
  agent: CastAgent,
  leg: Leg,
  status: Intent["status"],
  decision: Decision | null
) =>
  new Intent({
    id: previewId("intent", 90_000 + n) as IntentId,
    agentId: agent.id,
    source: "automation",
    executor: "agent",
    leg,
    reason: "Its plan for today.",
    status,
    decision,
    batch: null,
    tradeId: null,
    expiresAt: DateTime.add(at, { hours: 1 }),
    createdAt: at,
    updatedAt: at
  })

const agentRecord = (agent: CastAgent, now: Date) =>
  new Agent({
    id: agent.id,
    name: agent.name,
    template: agent.template,
    status: "active",
    paused: agent.state === "paused",
    spec: draftSpec({ template: agent.template, preset: agent.preset, stocks: agent.stocks, targets: agent.targets }),
    pendingSpec: null,
    lockedUntil: minutesAgo(now, -(90 - agent.ageDays) * 24 * 60),
    createdAt: minutesAgo(now, agent.ageDays * 24 * 60)
  })

const runOf = (
  n: number,
  at: DateTime.Utc,
  automation: CastAutomation,
  outcome: AutomationRun["outcome"],
  summary: string,
  reason: string
) =>
  new AutomationRun({
    id: previewId("run", 90_000 + n) as AutomationRunId,
    automationId: automation.id as AutomationId,
    windowKey: `preview:${n}`,
    firedAt: at,
    trigger: { summary, symbol: null, price: null, newsItemId: null },
    conditions: outcome === "skipped" ?
      [{
        type: "judgment",
        pass: false,
        reason: "The story is about a product delay, not the earnings it asked about.",
        judgmentId: previewId("judgment", 90_000 + n) as JudgmentId
      }] :
      [],
    outcome,
    reason,
    intentIds: [],
    result: outcome === "proposed" ? "traded" : outcome,
    blockedBy: []
  })

const transferOf = (n: number, at: DateTime.Utc, kind: Transfer["kind"], dollars: number, status: Transfer["status"]) =>
  new Transfer({
    id: previewId("transfer", 90_000 + n) as TransferId,
    kind,
    asset: "USDC",
    amount: usdc(dollars),
    from: (kind === "deposit" ? OWN_WALLET : ACCOUNT_ADDRESS) as Transfer["from"],
    to: (kind === "deposit" ? ACCOUNT_ADDRESS : OWN_WALLET) as Transfer["to"],
    status,
    txHash: null,
    createdAt: at
  })

const names = (agent: CastAgent | null) => ({ agent: agent?.name ?? null, stock: stockName })

/**
 * A notification of `kind` as the server would word it, about the cast's own agents, automations and stocks. `n`
 * picks a variant and keeps the records it names apart.
 */
export const sampleDraft = (kind: NotificationKind, cast: Cast, when: Date, n: number): NotificationDraft => {
  const at = DateTime.fromDateUnsafe(when)
  const variant = n % 2

  switch (kind) {
    case "intentFilled": {
      const agent = agentOf(cast, ["active", "doneForToday"])
      const symbol = agent.stocks[n % agent.stocks.length]!
      const leg: Leg = variant === 0 ?
        { symbol, side: "buy", amount: { usdc: usdc(25 + (n % 4) * 25) } } :
        { symbol, side: "sell", amount: { shares: Shares.make(BigInt(50_000_000)) } }
      return notificationOfIntent(intentOf(n, at, agent, leg, n % 5 === 4 ? "failed" : "filled", null), names(agent))!
    }
    case "intentBlocked": {
      const agent = agentOf(cast, ["doneForToday", "active"])
      const leg: Leg = { symbol: agent.stocks[0]!, side: "buy", amount: { usdc: usdc(50) } }
      const decision: Decision = variant === 0 ?
        {
          _tag: "Refused",
          policy: "tradesPerDay",
          error: null,
          stock: null,
          message: "it made its trades for today."
        } :
        {
          _tag: "Refused",
          policy: "stockCap",
          error: null,
          stock: agent.stocks[0]!,
          message: `${stockName(agent.stocks[0]!)} would pass 30% of your portfolio.`
        }
      return notificationOfIntent(intentOf(n, at, agent, leg, "blocked", decision), names(agent))!
    }
    case "intentWaiting": {
      const agent = agentOf(cast, ["active"])
      const leg: Leg = { symbol: agent.stocks[0]!, side: "buy", amount: { usdc: usdc(40) } }
      const decision: Decision = { _tag: "Wait", reason: "pricesPaused", until: DateTime.add(at, { hours: 2 }) }
      return notificationOfWaiting(intentOf(n, at, agent, leg, "waiting", decision), names(agent))
    }
    case "approvalNeeded": {
      const agent = agentOf(cast, ["asking"])
      const leg: Leg = { symbol: agent.stocks[0]!, side: "buy", amount: { usdc: usdc(180) } }
      const decision: Decision = { _tag: "OverLargestTrade", maxPerTrade: usdc(100) }
      return notificationOfIntent(intentOf(n, at, agent, leg, "needsApproval", decision), names(agent))!
    }
    case "approvalExpiring": {
      const agent = agentOf(cast, ["asking"])
      const leg: Leg = { symbol: agent.stocks[1] ?? agent.stocks[0]!, side: "sell", amount: { usdc: usdc(120) } }
      return notificationOfExpiring(intentOf(n, at, agent, leg, "needsApproval", { _tag: "Ask" }), names(agent))
    }
    case "automationFired": {
      const automation = automationOf(cast, ["weeklyBuy", "rebalance"])
      return notificationOfRun(
        runOf(n, at, automation, automation.asks ? "asked" : "proposed", "It's Monday, 09:30 in New York", ""),
        automation.name
      )!
    }
    case "automationMessage": {
      const automation = automationOf(cast, ["priceAlert"])
      return notificationOfRun(
        runOf(n, at, automation, "notified", "Apple fell under $200", "Apple is at $198.40, under the $200 you set."),
        automation.name
      )!
    }
    case "automationSkipped": {
      const automation = automationOf(cast, ["newsSell", "stopLoss"])
      return notificationOfRun(
        runOf(n, at, automation, "skipped", "A story about Tesla", "The news wasn't bad enough to sell."),
        automation.name
      )!
    }
    case "sessionEnding": {
      const agent = agentOf(cast, ["active", "asking"])
      return notificationOfSessionEnding(agent, {
        sessionId: previewId("agentsession", 90_000 + n),
        validUntil: DateTime.add(at, { days: variant === 0 ? 7 : 1 }),
        days: variant === 0 ? 7 : 1
      })
    }
    case "sessionRenewed":
      return notificationOfAgent(agentRecord(agentOf(cast, ["active"]), when), "renewed", `${n}`)
    case "agentPaused":
      return notificationOfAgent(agentRecord(agentOf(cast, ["paused", "active"]), when), "paused", `${n}`)
    case "passkeyAdded":
      return notificationOfPasskey({ id: previewId("passkey", 90_000 + n), label: "iCloud Keychain on iPhone" }, true)
    case "passkeyRemoved":
      return notificationOfPasskey({ id: previewId("passkey", 90_000 + n), label: "YubiKey 5C" }, false)
    case "newDevice":
      return notificationOfDevice({ id: previewId("session", 90_000 + n), device: "Firefox on Windows" })
    case "recoveryKeyChanged":
      return notificationOfRecoveryKey(
        { id: previewId("recoverykey", 90_000 + n), label: "YubiKey 5 NFC" },
        variant === 0
      )
    case "recoveryRequested":
      return notificationOfRecovery(
        { id: previewId("recovery", 90_000 + n), executableAt: DateTime.add(at, { hours: 48 }) },
        { _tag: "Requested" }
      )
    case "recoveryCancelled":
      return notificationOfRecovery(
        { id: previewId("recovery", 90_000 + n), executableAt: null },
        { _tag: "Cancelled", from: variant === 0 ? "app" : "telegram" }
      )
    case "recoveryCompleted":
      return notificationOfRecovery({ id: previewId("recovery", 90_000 + n), executableAt: null }, {
        _tag: "Completed"
      })
    case "chatLinked":
      return notificationOfChatLink(
        { id: previewId("channellink", 90_000 + n), platform: "telegram", name: cast.displayName },
        "linked"
      )
    case "chatUnlinked":
      return notificationOfChatLink(
        { id: previewId("channellink", 90_000 + n), platform: "telegram", name: cast.displayName },
        variant === 0 ? "unlinked" : "blocked"
      )
    case "deposit":
      return notificationOfTransfer(
        transferOf(n, at, "deposit", cast.scenario === "starter" ? 200 : 500 + (n % 3) * 250, "confirmed"),
        stockName
      )!
    case "withdrawal":
      return notificationOfTransfer(
        transferOf(n, at, "withdrawal", 200, variant === 0 ? "confirmed" : "failed"),
        stockName
      )!
    case "balanceUnexplained":
      return notificationOfAdjustment(
        variant === 0 ?
          {
            id: previewId("adjustment", 90_000 + n),
            asset: "MSFT",
            amount: BigInt(100_000_000),
            reason: "transferIn"
          } :
          {
            id: previewId("adjustment", 90_000 + n),
            asset: "USDC",
            amount: BigInt(-12_500_000),
            reason: "unexplained"
          },
        stockName("MSFT")
      )!
    case "dailyDigest": {
      const agent = agentOf(cast, ["active"])
      const automation = automationOf(cast, ["newsSell", "stopLoss"])
      return digestOf(`digest-${n}`, [
        { title: `${agent.name} bought $50.00 of ${stockName(agent.stocks[0]!)}` },
        { title: `A judgment held back ${automation.name}` },
        { title: `${automation.name} ran` }
      ])!
    }
  }
}

/** The notification a draft makes, stored at `createdAt`. */
export const notificationOf = (
  draft: NotificationDraft,
  n: number,
  createdAt: DateTime.Utc,
  readAt: DateTime.Utc | null
): Notification =>
  new Notification({
    id: previewId("notification", n) as NotificationId,
    kind: draft.kind,
    severity: kindOf(draft.kind).severity,
    title: draft.title,
    body: draft.body,
    link: draft.link,
    subjectType: draft.subjectType,
    subjectId: draft.subjectId,
    createdAt,
    readAt
  })

const HOUR = 60

// What each scenario was told, newest first: [kind, minutes ago, read].
const STARTER: ReadonlyArray<readonly [NotificationKind, number, boolean]> = [
  ["intentFilled", 14.5 * HOUR, false],
  ["deposit", 33.5 * HOUR, true]
]

const TYPICAL: ReadonlyArray<readonly [NotificationKind, number, boolean]> = [
  ["approvalNeeded", 20, false],
  ["intentFilled", 2 * HOUR, false],
  ["intentBlocked", 3 * HOUR, false],
  ["dailyDigest", 14 * HOUR, true],
  ["automationFired", 26 * HOUR, true],
  ["deposit", 5 * 24 * HOUR, true],
  ["sessionRenewed", 9 * 24 * HOUR, true],
  ["passkeyAdded", 30 * 24 * HOUR, true]
]

const HEAVY: ReadonlyArray<readonly [NotificationKind, number, boolean]> = [
  ["recoveryRequested", 14 * HOUR, false],
  ["approvalNeeded", 8, false],
  ["approvalExpiring", 25, false],
  ["intentFilled", 50, false],
  ["intentBlocked", 70, false],
  ["intentWaiting", 95, false],
  ["automationMessage", 2 * HOUR, false],
  ["intentFilled", 3 * HOUR, false],
  ["automationFired", 4 * HOUR, false],
  ["agentPaused", 5 * HOUR, false],
  ["withdrawal", 7 * HOUR, false],
  ["balanceUnexplained", 9 * HOUR, false],
  ["dailyDigest", 13 * HOUR, true],
  ["automationSkipped", 18 * HOUR, true],
  ["intentFilled", 20 * HOUR, true],
  ["sessionEnding", 22 * HOUR, true],
  ["deposit", 26 * HOUR, true],
  ["intentFilled", 28 * HOUR, true],
  ["newDevice", 30 * HOUR, true],
  ["intentBlocked", 33 * HOUR, true],
  ["automationFired", 36 * HOUR, true],
  ["dailyDigest", 37 * HOUR, true],
  ["intentFilled", 44 * HOUR, true],
  ["sessionEnding", 46 * HOUR, true],
  ["withdrawal", 50 * HOUR, true],
  ["intentFilled", 52 * HOUR, true],
  ["chatUnlinked", 60 * HOUR, true],
  ["chatLinked", 61 * HOUR, true],
  ["dailyDigest", 61.5 * HOUR, true],
  ["passkeyRemoved", 70 * HOUR, true],
  ["recoveryCancelled", 80 * HOUR, true],
  ["recoveryRequested", 90 * HOUR, true],
  ["intentFilled", 96 * HOUR, true],
  ["automationMessage", 100 * HOUR, true],
  ["sessionRenewed", 120 * HOUR, true],
  ["recoveryKeyChanged", 150 * HOUR, true],
  ["passkeyAdded", 200 * HOUR, true],
  ["deposit", 240 * HOUR, true],
  ["recoveryCompleted", 300 * HOUR, true],
  ["intentFilled", 320 * HOUR, true],
  ["approvalExpiring", 330 * HOUR, true],
  ["approvalNeeded", 331 * HOUR, true],
  ["balanceUnexplained", 400 * HOUR, true],
  ["intentWaiting", 410 * HOUR, true],
  ["automationSkipped", 450 * HOUR, true],
  ["deposit", 500 * HOUR, true]
]

/** The notifications a scenario starts with, newest first. */
export const makeNotifications = (cast: Cast, now: Date): Array<Notification> => {
  const told = { newPerson: [], starter: STARTER, typical: TYPICAL, heavy: HEAVY }[cast.scenario]
  return told.map(([kind, minutes, read], index) => {
    const createdAt = minutesAgo(now, minutes)
    const draft = sampleDraft(kind, cast, DateTime.toDateUtc(createdAt), index)
    return notificationOf(draft, told.length - index, createdAt, read ? DateTime.add(createdAt, { minutes: 4 }) : null)
  })
}
