/**
 * Notifications in words, from what happened: an intent reaching a step worth telling, an agent paused or renewed,
 * a session about to end, money moving, an automation's run, a chat linked. Pure, so every sentence is tested.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import type { Agent } from "../agents/Agent.ts"
import type { AutomationRun } from "../automations/Run.ts"
import { describeDecision, describeLeg } from "../intents/Describe.ts"
import type { Intent } from "../intents/Intent.ts"
import type { StockSymbol } from "../market/Market.ts"
import { formatShareCount } from "../policies/Format.ts"
import type { Transfer } from "../portfolio/Transfer.ts"
import type { NotificationDraft } from "./Notification.ts"

/**
 * What the words need: the name of the agent an intent trades through (`null` for your own) and stock names.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Names {
  readonly agent: string | null
  readonly stock: (symbol: StockSymbol) => string
}

/**
 * Where the approvals sheet opens, from any page.
 *
 * @stability unstable
 * @category links
 * @since 0.0.0
 */
export const APPROVALS_LINK = "/home?sheet=approvals"

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

const centsFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

const intentDraft = (
  intent: Intent,
  draft: Omit<NotificationDraft, "subjectType" | "subjectId" | "dedupeKey">
): NotificationDraft => ({
  ...draft,
  subjectType: "intent",
  subjectId: intent.id,
  dedupeKey: `${draft.kind}:${intent.id}:${intent.status}`
})

/**
 * The notification an intent's new status makes, or `undefined` for steps that say nothing new (proposed, deciding,
 * sending, confirming, waiting, a decline or a cancel you made). Your own trades in the app tell you on the page;
 * only trades someone else started (an agent, the assistant, Telegram, an automation) notify.
 *
 * **Example** (An agent's buy filled)
 *
 * ```ts import.meta.vitest
 * import { notificationOfIntent } from "@bluechip/domain/notifications/Drafts"
 *
 * const draft = notificationOfIntent({
 *   id: "intent_01",
 *   agentId: "agent_01",
 *   source: "automation",
 *   status: "filled",
 *   leg: { symbol: "NVDA", side: "buy", amount: { usdc: 50_000_000n } }
 * } as never, { agent: "Tech picker", stock: () => "NVIDIA" })
 * draft?.title // => "Tech picker bought $50.00 of NVIDIA"
 * ```
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfIntent = (intent: Intent, names: Names): NotificationDraft | undefined => {
  if (intent.agentId === null && intent.source === "owner") return undefined
  const trade = describeLeg(intent.leg, names.stock)
  const who = names.agent ?? "Your trade"
  const agentLink = intent.agentId === null ? "/activity" : `/agents/${intent.agentId}`

  switch (intent.status) {
    case "filled": {
      const done = trade.replace(/^Buy/, "bought").replace(/^Sell/, "sold")
      return intentDraft(intent, {
        kind: "intentFilled",
        title: names.agent === null ? `You ${done}` : `${names.agent} ${done}`,
        body: "It filled. The receipt is in Activity.",
        link: "/activity"
      })
    }
    case "failed":
      return intentDraft(intent, {
        kind: "intentFilled",
        title: `${who}: ${lower(trade)} failed`,
        body: "It failed onchain, so nothing was traded.",
        link: agentLink
      })
    case "blocked":
      return intentDraft(intent, {
        kind: "intentBlocked",
        title: `A policy stopped ${names.agent ?? "a trade"}`,
        body: `${trade}. ${intent.decision === null ? "" : describeDecision(intent.decision)}`.trim(),
        link: agentLink
      })
    case "needsApproval":
      return intentDraft(intent, {
        kind: "approvalNeeded",
        title: `${names.agent ?? "A trade"} needs your approval`,
        body: `${trade}. Approve or decline it with Face ID.`,
        link: APPROVALS_LINK
      })
    case "expired":
      return intentDraft(intent, {
        kind: "intentBlocked",
        title: `${who}: ${lower(trade)} expired`,
        body: "It wasn't answered in time, so nothing was traded.",
        link: agentLink
      })
    default:
      return undefined
  }
}

/**
 * An agent's trade still waiting after an hour, and why.
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfWaiting = (intent: Intent, names: Names): NotificationDraft => ({
  kind: "intentWaiting",
  title: `${names.agent ?? "A trade"} is still waiting`,
  body: `${describeLeg(intent.leg, names.stock)}. ${
    intent.decision === null ? "It hasn't been decided yet." : describeDecision(intent.decision)
  }`,
  link: intent.agentId === null ? "/activity" : `/agents/${intent.agentId}`,
  subjectType: "intent",
  subjectId: intent.id,
  dedupeKey: `intentWaiting:${intent.id}`
})

/**
 * A trade waiting for your approval that expires within the hour.
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfExpiring = (intent: Intent, names: Names): NotificationDraft => ({
  kind: "approvalExpiring",
  title: `${names.agent ?? "A trade"} expires within the hour`,
  body: `${describeLeg(intent.leg, names.stock)} waits for your approval. Approve or decline it in bluechip.`,
  link: APPROVALS_LINK,
  subjectType: "intent",
  subjectId: intent.id,
  dedupeKey: `approvalExpiring:${intent.id}`
})

/**
 * What an agent's change tells you: paused, or renewed for another 90 days (`validUntil`, its new end).
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfAgent = (
  agent: Agent,
  change: "paused" | "renewed",
  at: string
): NotificationDraft =>
  change === "paused" ?
    {
      kind: "agentPaused",
      title: `${agent.name} is paused`,
      body: "It can't trade until you resume it. Nothing was sold.",
      link: `/agents/${agent.id}`,
      subjectType: "agent",
      subjectId: agent.id,
      dedupeKey: `agentPaused:${agent.id}:${at}`
    } :
    {
      kind: "sessionRenewed",
      title: `${agent.name} was renewed`,
      body: "Its policies hold for another 90 days.",
      link: `/agents/${agent.id}`,
      subjectType: "agent",
      subjectId: agent.id,
      dedupeKey: `sessionRenewed:${agent.id}:${at}`
    }

/**
 * An agent's session ending in 7 days or in 1 day.
 *
 * **Example** (A day left)
 *
 * ```ts import.meta.vitest
 * import { notificationOfSessionEnding } from "@bluechip/domain/notifications/Drafts"
 * import * as DateTime from "effect/DateTime"
 *
 * notificationOfSessionEnding(
 *   { id: "agent_01", name: "Tech picker" } as never,
 *   { sessionId: "agentsession_01", validUntil: DateTime.makeUnsafe("2027-02-24T10:00:00Z"), days: 1 }
 * ).body
 * // => "It stops trading on 24 Feb unless you renew it with Face ID."
 * ```
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfSessionEnding = (
  agent: Pick<Agent, "id" | "name">,
  session: { readonly sessionId: string; readonly validUntil: DateTime.Utc; readonly days: 1 | 7 }
): NotificationDraft => ({
  kind: "sessionEnding",
  title: session.days === 1 ? `${agent.name} stops tomorrow` : `${agent.name} stops in a week`,
  body: `It stops trading on ${
    dateFormat.format(DateTime.toDateUtc(session.validUntil))
  } unless you renew it with Face ID.`,
  link: `/agents/${agent.id}`,
  subjectType: "agent",
  subjectId: agent.id,
  dedupeKey: `sessionEnding:${session.sessionId}:${session.days}`
})

const amountOf = (transfer: Transfer, stock: (symbol: StockSymbol) => string) =>
  transfer.asset === "USDC" ?
    `${centsFormat.format(Number(transfer.amount) / 1e6)} of USDC` :
    `${formatShareCount(Number(transfer.amount) / 1e8)} of ${stock(transfer.asset)}`

/**
 * Money that arrived, or a withdrawal that landed or failed; `undefined` while a withdrawal is on its way.
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfTransfer = (
  transfer: Transfer,
  stock: (symbol: StockSymbol) => string
): NotificationDraft | undefined => {
  if (transfer.status === "pending") return undefined
  const amount = amountOf(transfer, stock)
  const base = {
    link: "/portfolio",
    subjectType: "transfer",
    subjectId: transfer.id,
    dedupeKey: `${transfer.kind}:${transfer.id}:${transfer.status}`
  }
  if (transfer.kind === "deposit") {
    return { ...base, kind: "deposit", title: `${amount} arrived`, body: "It's in your account, ready to trade." }
  }
  return transfer.status === "confirmed" ?
    { ...base, kind: "withdrawal", title: `${amount} withdrawn`, body: "It landed at the address you chose." } :
    { ...base, kind: "withdrawal", title: "A withdrawal failed", body: `${amount} stayed in your account.` }
}

/**
 * What an automation's run tells you: it traded or asked you (`automationFired`), it has a message for you
 * (`automationMessage`, a `notify` action), or a model's judgment held it back (`automationSkipped`); `undefined` for
 * a run skipped for any other reason. One notification per run.
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfRun = (run: AutomationRun, automationName: string): NotificationDraft | undefined => {
  const base = {
    link: `/automations/${run.automationId}`,
    subjectType: "automation",
    subjectId: run.automationId,
    dedupeKey: `run:${run.id}`
  }
  if (run.outcome === "skipped") {
    const held = run.conditions.some((condition) => condition.judgmentId !== null && !condition.pass)
    return held ?
      { ...base, kind: "automationSkipped", title: `A judgment held back ${automationName}`, body: run.reason } :
      undefined
  }
  if (run.outcome === "notified") {
    return { ...base, kind: "automationMessage", title: automationName, body: run.reason }
  }
  // Watchers write the summary as a sentence ("Its scheduled time came.") or without its stop (a headline).
  const summary = run.trigger.summary.replace(/\.$/, "")
  const said = {
    proposed: `${summary}. It proposed trades to its agent.`,
    asked: `${summary}. It asks you first: approve it in bluechip.`,
    failed: `It failed: ${run.reason}`
  } as const
  return { ...base, kind: "automationFired", title: `${automationName} ran`, body: said[run.outcome] }
}

/**
 * A chat on a platform linked to your account, unlinked from it, or unlinked by bluechip because the bot was blocked
 * there (`blocked`).
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfChatLink = (
  link: { readonly id: string; readonly platform: string; readonly name: string | null },
  change: "linked" | "unlinked" | "blocked"
): NotificationDraft => {
  const platform = link.platform.charAt(0).toUpperCase() + link.platform.slice(1)
  const chat = link.name === null ? `A ${platform} chat` : `${platform} (${link.name})`
  const about = { link: "/settings/notifications", subjectType: "channelLink", subjectId: link.id }
  switch (change) {
    case "linked":
      return {
        ...about,
        kind: "chatLinked",
        title: `${platform} is linked`,
        body: `${chat} can now talk to the assistant about your account. Unlink it in Settings if this wasn't you.`,
        dedupeKey: `chatLinked:${link.id}`
      }
    case "unlinked":
      return {
        ...about,
        kind: "chatUnlinked",
        title: `${platform} is unlinked`,
        body: `${chat} can no longer reach your account.`,
        dedupeKey: `chatUnlinked:${link.id}`
      }
    case "blocked":
      return {
        ...about,
        kind: "chatUnlinked",
        title: `${platform} is unlinked`,
        body: `The bot was blocked in ${link.name === null ? `a ${platform} chat` : chat}, so bluechip unlinked it. ` +
          "Link it again in Settings to hear from bluechip there.",
        dedupeKey: `chatUnlinked:${link.id}`
      }
  }
}

/**
 * The daily digest of `day` (`2026-11-26`): how many notifications the day held, by title, or `undefined` when it
 * held none.
 *
 * **Example** (Two held back)
 *
 * ```ts import.meta.vitest
 * import { digestOf } from "@bluechip/domain/notifications/Drafts"
 *
 * digestOf("2026-11-26", [{ title: "A judgment held back Dip buyer" }, { title: "Tech picker bought $50.00 of NVIDIA" }])?.body
 * // => "A judgment held back Dip buyer.\nTech picker bought $50.00 of NVIDIA."
 * ```
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const digestOf = (
  day: string,
  notifications: ReadonlyArray<{ readonly title: string }>
): NotificationDraft | undefined => {
  if (notifications.length === 0) return undefined
  const shown = notifications.slice(0, 12).map((notification) => `${notification.title}.`)
  const more = notifications.length - shown.length
  return {
    kind: "dailyDigest",
    title: notifications.length === 1 ? "Your day: 1 update" : `Your day: ${notifications.length} updates`,
    body: [...shown, ...(more > 0 ? [`And ${more} more in bluechip.`] : [])].join("\n"),
    link: "/home",
    subjectType: null,
    subjectId: null,
    dedupeKey: `dailyDigest:${day}`
  }
}
