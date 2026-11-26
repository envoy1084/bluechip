/**
 * What the bot says on its own: to a chat that isn't linked, after linking, and to its commands (your portfolio,
 * your agents, help). Every number comes from bluechip's records.
 *
 * @since 0.0.0
 */
import type { Agent } from "../agents/Agent.ts"
import type { StockSymbol } from "../market/Market.ts"
import type { Portfolio } from "../portfolio/Portfolio.ts"

/**
 * The only reply a chat that isn't linked gets: how to link it. Never any account's data.
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const NOT_LINKED = "This chat isn't linked to a bluechip account. In bluechip, open Settings, then " +
  "Notifications, and choose Link Telegram: send me the code it shows."

/**
 * The reply to a code that's wrong, used or expired.
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const CODE_REFUSED = "That code didn't work: it may have expired (codes last 10 minutes) or been used. " +
  "Make a new one in bluechip and send it here."

/**
 * The reply once a chat is linked.
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const LINKED = "Linked to your bluechip account. Ask me anything about your portfolio, agents and stocks, " +
  "or send /help. Anything that needs Face ID finishes in the app."

/**
 * The reply to a chat linked only in a private chat: links work one person at a time.
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const PRIVATE_ONLY = "Link bluechip in a private chat with me, not in a group."

/**
 * The reply after unlinking from the chat.
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const UNLINKED = "This chat is unlinked from your bluechip account. Link it again from bluechip's Settings."

/**
 * The reply while the assistant is still answering the chat's last message.
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const BUSY = "I'm still answering your last message. Ask again once I'm done."

/**
 * What the bot can do, for `/help`.
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const HELP = [
  "Ask me anything you'd ask bluechip's assistant: prices, your portfolio, your agents, a trade.",
  "",
  "/portfolio: your cash, stocks and total value",
  "/agents: your agents and how they stand",
  "/pause: pause one agent",
  "/pause_all: pause every agent at once",
  "/unlink: unlink this chat",
  "",
  "An agent trades only inside its policies. Anything beyond them, and anything you sign, finishes in the app with " +
  "Face ID."
].join("\n")

const sharesFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 })

const centsFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

const dollars = (usdc: bigint) => centsFormat.format(Number(usdc) / 1e6)

/**
 * Your portfolio in a message: the total, cash, and each holding with its value.
 *
 * **Example** (Cash only)
 *
 * ```ts import.meta.vitest
 * import { chatPortfolio } from "@bluechip/domain/channels/ChatReplies"
 *
 * chatPortfolio({ value: 120_500_000n, cash: 120_500_000n, holdings: [] } as never, () => "")
 * // => "**Total value: $120.50**\nCash: $120.50\nNo stocks yet."
 * ```
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const chatPortfolio = (
  portfolio: Pick<Portfolio, "value" | "cash" | "holdings">,
  stock: (symbol: StockSymbol) => string
): string => {
  const lines = portfolio.holdings.map((holding) => {
    const shares = Number(holding.shares) / 1e8
    return `${stock(holding.symbol)}: ${sharesFormat.format(shares)} ${shares === 1 ? "share" : "shares"}, ` +
      dollars(holding.value)
  })
  return [
    `**Total value: ${dollars(portfolio.value)}**`,
    `Cash: ${dollars(portfolio.cash)}`,
    ...(lines.length === 0 ? ["No stocks yet."] : lines)
  ].join("\n")
}

/**
 * How an agent stands, in a word or two.
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const agentStanding = (agent: Pick<Agent, "status" | "paused">): string => {
  if (agent.status === "active" && agent.paused) return "paused"
  const words: Readonly<Record<Agent["status"], string>> = {
    draft: "not locked yet",
    locking: "locking on Base",
    active: "trading",
    updating: "changing on Base",
    removing: "being removed",
    expired: "ended, renew it to keep it trading",
    removed: "removed"
  }
  return words[agent.status]
}

/**
 * Your agents in a message, each with how it stands; removed ones are left out.
 *
 * **Example** (Two agents)
 *
 * ```ts import.meta.vitest
 * import { chatAgents } from "@bluechip/domain/channels/ChatReplies"
 *
 * chatAgents([{ name: "Tech picker", status: "active", paused: false }, { name: "Dip buyer", status: "active", paused: true }] as never)
 * // => "**Your agents**\nTech picker: trading\nDip buyer: paused"
 * ```
 *
 * @stability unstable
 * @category replies
 * @since 0.0.0
 */
export const chatAgents = (agents: ReadonlyArray<Pick<Agent, "name" | "status" | "paused">>): string => {
  const shown = agents.filter((agent) => agent.status !== "removed")
  if (shown.length === 0) return "You have no agents yet. Make one in bluechip, or ask me to draft one."
  return ["**Your agents**", ...shown.map((agent) => `${agent.name}: ${agentStanding(agent)}`)].join("\n")
}
