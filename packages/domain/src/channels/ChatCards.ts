/**
 * The assistant's cards and bluechip's notifications as chat messages: Markdown and the actions under it. Tools keep
 * their risk levels in a chat: a configure card asks for Confirm or Cancel, and a card that needs your passkey (a
 * trade for your Face ID, a draft agent, a change of policies) only links into the app, because nothing is signed in
 * a chat.
 *
 * @since 0.0.0
 */
import type { Card } from "../assistant/Card.ts"
import { describeDecision, describeLeg } from "../intents/Describe.ts"
import type { StockSymbol } from "../market/Market.ts"
import { actionsOf } from "../notifications/Actions.ts"
import { APPROVALS_LINK } from "../notifications/Drafts.ts"
import type { Notification } from "../notifications/Notification.ts"

/**
 * What a chat message offers under its text: Confirm and Cancel for a card that waits for you, a link to a page
 * of the app (a path, made absolute by the server), or a notification's own action (pause every agent, cancel a
 * recovery).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type ChatAction =
  | { readonly _tag: "Answer"; readonly cardId: string }
  | { readonly _tag: "Open"; readonly label: string; readonly path: string }
  | { readonly _tag: "PauseAll" }
  | { readonly _tag: "CancelRecovery" }

/**
 * One chat message: its Markdown and what it offers.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface ChatReply {
  readonly markdown: string
  readonly actions: ReadonlyArray<ChatAction>
}

const reply = (markdown: string, ...actions: ReadonlyArray<ChatAction>): ChatReply => ({ markdown, actions })

const open = (label: string, path: string): ChatAction => ({ _tag: "Open", label, path })

const quoted = (text: string) => `"${text}"`

/**
 * A card as a chat message, `undefined` for cards a chat doesn't show. `conversationPath` is the conversation in the
 * app, where a card that needs your passkey waits with its Face ID button.
 *
 * **Example** (A pause that waits for you)
 *
 * ```ts import.meta.vitest
 * import { chatCard } from "@bluechip/domain/channels/ChatCards"
 *
 * chatCard(
 *   { _tag: "AgentControl", id: "card_01", action: "pause", agentId: "agent_01", agentName: "Tech picker", status: "pending", agents: [] } as never,
 *   { stock: () => "", conversationPath: "/chat/conversation_01" }
 * )
 * // => { markdown: "Pause Tech picker? It stops trading until you resume it.", actions: [{ _tag: "Answer", cardId: "card_01" }] }
 * ```
 *
 * @stability unstable
 * @category rendering
 * @since 0.0.0
 */
export const chatCard = (
  card: Card,
  context: { readonly stock: (symbol: StockSymbol) => string; readonly conversationPath: string }
): ChatReply | undefined => {
  const answer: ChatAction = { _tag: "Answer", cardId: card.id }
  const inApp = open("Open in bluechip", context.conversationPath)

  switch (card._tag) {
    case "Trade": {
      const { intent } = card
      const trade = `**${describeLeg(intent.leg, context.stock)}**`
      switch (intent.status) {
        case "sending":
        case "confirming":
          return reply(`${trade}: sent within the agent's policies.`)
        case "filled":
          return reply(`${trade}: filled.`)
        case "needsApproval":
          return reply(
            `${trade}. ${intent.decision === null ? "" : describeDecision(intent.decision)} ` +
              "Approve it in bluechip.",
            open("Approve in bluechip", APPROVALS_LINK)
          )
        case "blocked":
        case "waiting":
          return reply(`${trade}. ${intent.decision === null ? "" : describeDecision(intent.decision)}`.trim())
        default:
          return reply(`${trade}: ${intent.status}.`)
      }
    }
    case "Approval":
      return reply(
        `**${describeLeg(card.intent.leg, context.stock)}** is ready for your Face ID. Nothing happens until you ` +
          "approve it in bluechip.",
        inApp
      )
    case "DraftAgent": {
      const automations = card.automations ?? []
      const comes = automations.length === 0 ?
        "" :
        `\n\nIt comes with ${automations.length === 1 ? "an automation" : `${automations.length} automations`}, ` +
        `kept or left out in bluechip before you lock it:\n${
          automations.map((automation) => `- ${automation.sentence}`).join("\n")
        }`
      return reply(
        `**${card.agent.name}** is drafted. It runs only once you lock it with Face ID in bluechip.${comes}`,
        inApp
      )
    }
    case "PolicyChange":
      return card.request === null ?
        reply(`The draft **${card.agent.name}** was removed.`) :
        reply(
          `Ready to ${card.action} **${card.agent.name}**. It happens once you approve it with Face ID in bluechip.`,
          inApp
        )
    case "AgentControl": {
      if (card.status !== "pending") return reply(controlResult(card))
      const asked = card.action === "pauseAll" ?
        "Pause every agent? They stop trading until you resume them." :
        card.action === "pause" ?
        `Pause ${card.agentName}? It stops trading until you resume it.` :
        `Resume ${card.agentName}? It trades again inside its policies.`
      return reply(asked, answer)
    }
    case "SaveTemplate":
      return card.status === "pending" ?
        reply(`Save ${quoted(card.name)} as a template?`, answer) :
        reply(card.status === "applied" ? `Saved the template ${quoted(card.name)}.` : "Not saved.")
    case "Automation":
      return card.status === "pending" ?
        reply(
          `${card.action === "create" ? "Create this automation" : "Change the automation"}? ` +
            card.description.sentence,
          answer
        ) :
        reply(card.status === "applied" ? `Saved: ${card.description.sentence}` : "Not saved.")
    case "AutomationControl":
      return card.status === "pending" ?
        reply(`${card.action === "pause" ? "Pause" : "Resume"} ${card.automationName}?`, answer) :
        reply(
          card.status === "applied" ?
            `${card.automationName} is ${card.action === "pause" ? "paused" : "running again"}.` :
            "Nothing changed."
        )
    case "Memory":
      if (card.action === "confirm") {
        return card.status === "pending" ?
          reply(`Remember this? ${quoted(card.memory.text)}`, answer) :
          reply(card.status === "applied" ? `Remembered: ${quoted(card.memory.text)}` : "Not kept.")
      }
      return reply(`${card.action === "saved" ? "Remembered" : "Forgotten"}: ${quoted(card.memory.text)}`)
    case "Research":
      return card.citations.length === 0 ?
        undefined :
        reply(["Sources:", ...card.citations.map((citation) => `- [${citation.title}](${citation.url})`)].join("\n"))
    case "Error":
      return reply(card.message)
  }
}

const controlResult = (card: Extract<Card, { readonly _tag: "AgentControl" }>): string => {
  if (card.status === "dismissed") return "Nothing changed."
  if (card.action === "pauseAll") return "Every agent is paused."
  return `${card.agentName} is ${card.action === "pause" ? "paused" : "running again"}.`
}

/**
 * A notification as a chat message: its title in bold, its sentence, and a link to its page.
 *
 * **Example** (A trade waiting for your approval)
 *
 * ```ts import.meta.vitest
 * import { chatNotification } from "@bluechip/domain/channels/ChatCards"
 *
 * chatNotification({ kind: "approvalNeeded", title: "Tech picker needs your approval", body: "Buy $150.00 of NVIDIA.", link: "/home?sheet=approvals" } as never)
 * // => { markdown: "**Tech picker needs your approval**\nBuy $150.00 of NVIDIA.", actions: [{ _tag: "Open", label: "Approve in bluechip", path: "/home?sheet=approvals" }] }
 * ```
 *
 * @stability unstable
 * @category rendering
 * @since 0.0.0
 */
export const chatNotification = (
  notification: Pick<Notification, "kind" | "title" | "body" | "link">
): ChatReply => {
  const markdown = `**${notification.title}**\n${notification.body}`
  // Review is the link itself ("Approve in bluechip"): a chat never signs.
  const own = actionsOf(notification.kind).flatMap((action): Array<ChatAction> =>
    action === "pauseAll" ? [{ _tag: "PauseAll" }] : action === "cancelRecovery" ? [{ _tag: "CancelRecovery" }] : []
  )
  if (notification.link === null) return reply(markdown, ...own)
  const label = notification.kind === "approvalNeeded" || notification.kind === "approvalExpiring" ?
    "Approve in bluechip" :
    "Open in bluechip"
  return reply(markdown, open(label, notification.link), ...own)
}
