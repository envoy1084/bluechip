// What the preview's assistant answers: a reply that fits what you asked, read from your words. A trade becomes a
// trade card through the conversation's agent (or yours, for Face ID), "make an agent" a draft agent, a rule in words
// an automation, a question about a stock research with citations, and anything else an answer from the help center.
import type { Memory } from "@bluechip/domain/assistant/Memory"
import { limitsOf } from "@bluechip/domain/automations/AgentLimits"
import type { CardId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { type TemplateId, TEMPLATES } from "@bluechip/domain/policies/Templates"
import { AGENT_STATES, type AgentState } from "@bluechip/ui/bluechip/agent-status"
import { TICKERS } from "@bluechip/ui/lib/tickers"
import { agentFor, type CardKind, makeCard, roundOf } from "../../world/assistant/cards.ts"
import { draftAgentCard } from "../../world/assistant/cards/agentCards.ts"
import { automationCard, type DraftKind, draftOf } from "../../world/assistant/cards/automationCards.ts"
import { approvalCard, tradeCard } from "../../world/assistant/cards/tradeCards.ts"
import { draftedAgent, nameOf, priceOf, specOf } from "../../world/assistant/castRecords.ts"
import { memoryOf } from "../../world/assistant/memories.ts"
import type { Mint } from "../../world/assistant/mint.ts"
import {
  checkSpec,
  getQuote,
  listAgents,
  listMemories,
  listTemplates,
  searchHelp
} from "../../world/assistant/reads.ts"
import { own, type Round, say, searched, shows } from "../../world/assistant/rounds.ts"
import type { CastAgent, CastAgentState } from "../../world/cast.ts"

// A cast agent's state in the app's words, as the agents page says it: "Done for today", never "doneForToday".
const SHOWN_STATE: Readonly<Record<CastAgentState, AgentState>> = {
  active: "active",
  doneForToday: "stopped",
  asking: "needs-approval",
  paused: "paused",
  draft: "unlocked",
  locking: "sending",
  updating: "sending",
  removing: "sending",
  expired: "expired",
  removed: "removed"
}

export interface Reply {
  readonly rounds: ReadonlyArray<Round>
  /** Memories the reply made, to keep. */
  readonly memories: ReadonlyArray<Memory>
}

const stocksIn = (text: string): Array<StockSymbol> =>
  TICKERS.flatMap((ticker) =>
    new RegExp(`\\b(${ticker.symbol}|${ticker.name})\\b`, "i").test(text) ? [ticker.symbol as StockSymbol] : []
  )

const dollarsIn = (text: string): number | null => {
  const found = /\$\s?(\d[\d,]*(?:\.\d+)?)/.exec(text)
  return found === null ? null : Number(found[1]!.replaceAll(",", ""))
}

/** "I never want Tesla" as the assistant keeps it: "You never want Tesla." */
const secondPerson = (text: string): string => {
  const said = text.replace(/^(please\s+)?(remember|note)(\s+that)?[:,]?\s*/i, "").trim()
  const swapped = said.replace(/\bI'm\b/gi, "you're").replace(/\bI\b/g, "you").replace(/\bmy\b/gi, "your")
    .replace(/\bme\b/gi, "you")
  const sentence = swapped.charAt(0).toUpperCase() + swapped.slice(1)
  return (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`).slice(0, 280)
}

const fromCard = (mint: Mint, kind: CardKind, focus: CastAgent | null, after: string): Reply => {
  const made = makeCard(mint, kind, "pending", focus)
  return { rounds: [roundOf(mint, made), ...(after === "" ? [] : [[say(after)]])], memories: made.memories }
}

const templateIn = (text: string): TemplateId =>
  /rebalanc|mix|target/i.test(text) ?
    "rebalancer" :
    /stop.?loss|protect|guard|only sell/i.test(text) ?
    "stopLossGuard" :
    /week|every|schedule|monthly|daily/i.test(text) ?
    "weeklyBuyer" :
    "stockPicker"

const draftKindIn = (text: string): DraftKind =>
  /news|headline|story/i.test(text) ?
    "newsSell" :
    /tell me|alert|notify|let me know/i.test(text) ?
    "priceAlert" :
    /drop|fall|stop.?loss|protect/i.test(text) ?
    "stopLoss" :
    "weeklyBuy"

const tradeReply = (mint: Mint, text: string, focus: CastAgent | null): Reply => {
  const symbol = stocksIn(text)[0] ?? focus?.stocks[0] ?? "NVDA"
  const dollars = dollarsIn(text) ?? 50
  const named = mint.cast.agents.find((agent) => text.toLowerCase().includes(agent.name.toLowerCase()))
  const agent = named ?? focus
  const params = { agentId: agent?.id ?? null, symbol, side: "buy", dollars, shares: null, reason: "You asked." }

  if (agent === null || agent === undefined) {
    return {
      rounds: [[getQuote(mint, symbol, dollars)], [
        say(`Here's **$${dollars} of ${nameOf(symbol)}** as your own trade. Nothing happens until you approve it.`),
        shows(mint, "proposeTrade", params, approvalCard(mint, { symbol, dollars, expired: false }))
      ]],
      memories: []
    }
  }

  const largest = Number(limitsOf(specOf(agent))?.maxPerTrade ?? BigInt(100_000_000)) / 1e6
  const over = dollars > largest
  return {
    rounds: [[getQuote(mint, symbol, dollars)], [
      shows(
        mint,
        "proposeTrade",
        params,
        tradeCard(mint, agent, over ? "asking" : "sent", { symbol, dollars })
      )
    ], [
      say(
        over ?
          `$${dollars} is more than ${agent.name}'s largest trade of $${largest}, so it's waiting for your approval ` +
          "with Face ID on the card." :
          `${agent.name} sent it within its policies: about ${
            (dollars / (Number(priceOf(symbol)) / 1e8)).toFixed(2)
          } ` +
          `shares of [[${symbol}]]. Follow it on the card.`
      )
    ]],
    memories: []
  }
}

const agentReply = (mint: Mint, text: string): Reply => {
  const template = templateIn(text)
  const stocks = stocksIn(text)
  const picked: ReadonlyArray<StockSymbol> = stocks.length > 0 ? stocks : TEMPLATES[template].defaultStocks.length > 0 ?
    TEMPLATES[template].defaultStocks :
    ["AAPL"]
  const first = nameOf(picked[0]!)
  const name = template === "weeklyBuyer" ?
    `Weekly ${first} buyer` :
    template === "stopLossGuard" ?
    `${first} guard` :
    template === "rebalancer" ?
    "Mix keeper" :
    `${first} picker`
  const targets = template !== "rebalancer" ? [] : [
    ...picked.map((asset) => ({ asset, weight: Math.floor(8000 / picked.length) })),
    { asset: "USDC" as const, weight: 10_000 - Math.floor(8000 / picked.length) * picked.length }
  ]
  const draft = { name, template, preset: "balanced" as const, stocks: picked, targets }
  const agent = draftedAgent(mint, draft)

  return {
    rounds: [
      [listTemplates(mint), checkSpec(mint, specOf(draft))],
      [
        say(`A **${TEMPLATES[template].title}** fits: ${TEMPLATES[template].summary.toLowerCase()} Here's the draft.`),
        shows(
          mint,
          "draftAgent",
          { name, draft: { template, preset: "balanced", stocks: picked } },
          draftAgentCard(mint, agent)
        )
      ],
      [
        say(
          "Look over what it can and can never do. Customize changes any of it; Lock with Face ID puts its rules " +
            "onchain, and it starts."
        )
      ]
    ],
    memories: []
  }
}

const automationReply = (mint: Mint, text: string, focus: CastAgent | null): Reply => {
  const kind = draftKindIn(text)
  const agent = kind === "priceAlert" ? null : agentFor(mint, focus)
  const draft = draftOf(kind, agent)
  return {
    rounds: [[
      say("Here it is in words. Nothing runs until you save it."),
      shows(mint, "createAutomation", { automationId: null }, automationCard(mint, draft, { status: "pending" }))
    ]],
    memories: []
  }
}

const researchReply = (mint: Mint, text: string, symbol: StockSymbol): Reply => {
  const name = nameOf(symbol)
  const citations = [
    {
      url: `https://www.reuters.com/markets/companies/${symbol}.O`,
      title: `${name} shares edge higher as investors weigh the next quarter`,
      citedText: `${name} rose 1.8% on the week.`
    },
    { url: `https://www.ft.com/stream/${symbol.toLowerCase()}`, title: `${name}: the latest coverage`, citedText: null }
  ]
  return {
    rounds: [[
      searched(mint, text, citations),
      say(
        `[[${symbol}]] is at **$${(Number(priceOf(symbol)) / 1e8).toFixed(2)}**. From what I read:\n\n` +
          `- Shares rose about **1.8%** this week ([Reuters](${citations[0]!.url})).\n` +
          `- Analysts are focused on next quarter's guidance ([FT](${citations[1]!.url})).\n\n` +
          "These are other people's views, not advice."
      ),
      own({ _tag: "Research", id: mint.id("card") as CardId, query: text, citations })
    ]],
    memories: []
  }
}

/** The reply to `text`, in a conversation about `focus` (if any). */
export const replyTo = (
  mint: Mint,
  text: string,
  focus: CastAgent | null,
  memories: ReadonlyArray<Memory>
): Reply => {
  const symbols = stocksIn(text)

  if (/\b(pause|stop)\b.*\b(all|every|everything)\b/i.test(text)) return fromCard(mint, "pauseAll", focus, "")
  if (/\b(resume|unpause|restart)\b/i.test(text)) return fromCard(mint, "resumeAgent", focus, "")
  if (/\bpause\b/i.test(text)) return fromCard(mint, "pauseAgent", focus, "")
  if (/\brenew\b/i.test(text)) return fromCard(mint, "policyRenew", focus, "")
  if (/\b(remove|delete)\b.*\bagent\b/i.test(text)) return fromCard(mint, "policyRemove", focus, "")
  if (/\b(tighten|lower|raise|change)\b.*\b(budget|limit|rules|policies|cap)\b/i.test(text)) {
    return fromCard(mint, "policyUpdate", focus, "Approve with Face ID and the new rules are locked onchain.")
  }
  if (/\btemplate\b/i.test(text)) return fromCard(mint, "saveTemplate", focus, "Confirm on the card and it's saved.")
  if (/\bforget\b/i.test(text)) return fromCard(mint, "memoryForgotten", focus, "")
  if (/\b(what do you (know|remember)|memories)\b/i.test(text)) {
    return {
      rounds: [[listMemories(mint, memories)], [
        say(
          memories.length === 0 ?
            "Nothing yet. Tell me what matters to you, like \"I never want to own Tesla\", and I'll remember it." :
            `${memories.length} things, all on the [memory page](/memory), where you can delete any of them.`
        )
      ]],
      memories: []
    }
  }
  if (/\b(remember|i never|i always|i prefer)\b/i.test(text)) {
    const memory = memoryOf(mint, {
      kind: /never|only/i.test(text) ? "constraint" : /saving|goal|aim/i.test(text) ? "goal" : "preference",
      text: secondPerson(text),
      source: "said",
      confidence: 1,
      confirmedHoursAgo: 0,
      hoursAgo: 0
    })
    return {
      rounds: [[
        say("Got it, I'll remember that."),
        shows(mint, "remember", { kind: memory.kind, text: memory.text }, {
          _tag: "Memory",
          id: mint.id("card") as CardId,
          action: "saved",
          memory,
          status: "applied"
        })
      ]],
      memories: [memory]
    }
  }
  if (/\bagent\b/i.test(text) && /\b(make|create|set up|setup|build|new|draft|start)\b/i.test(text)) {
    return agentReply(mint, text)
  }
  if (
    /\b(automation|every|weekly|daily|monthly|alert|notify|tell me when|stop.?loss)\b/i.test(text) ||
    /\b(if|when)\b.*\b(falls?|drops?|rises?|goes|crosses|news)\b/i.test(text)
  ) {
    return automationReply(mint, text, focus)
  }
  if (/\b(buy|sell)\b/i.test(text)) return tradeReply(mint, text, focus)
  if (symbols.length > 0 && /\b(news|research|latest|how is|how's|doing|happening)\b/i.test(text)) {
    return researchReply(mint, text, symbols[0]!)
  }
  if (/\b(my agents|agents do|today|activity|this week)\b/i.test(text)) {
    const rows = mint.cast.agents.filter((agent) => agent.state !== "removed").map((agent) =>
      `| ${agent.name} | ${agent.stocks.map((symbol) => `[[${symbol}]]`).join(" ")} | ${
        AGENT_STATES[SHOWN_STATE[agent.state]].label
      } |`
    )
    return {
      rounds: [[listAgents(mint)], [
        say(
          rows.length === 0 ?
            "You don't have any agents yet. Want me to draft one? Tell me what it should buy and how much." :
            `Here's where your agents stand:\n\n| Agent | Stocks | State |\n| --- | --- | --- |\n${
              rows.join("\n")
            }\n\n` +
            "Open any of them from the Agents page for its trades and why it made them."
        )
      ]],
      memories: []
    }
  }

  return {
    rounds: [
      [searchHelp(mint, text, [
        ["agents", "How agents work", "Policies", "An agent can only do what its policies allow, checked onchain."],
        ["approvals", "Approvals", "When you're asked", "Trades over an agent's largest trade wait for your Face ID."]
      ])],
      [
        say(
          "Good question. In short:\n\n" +
            "1. **Agents trade inside rules you lock.** Each one has policies onchain, like a daily budget, a cap " +
            "per stock and a largest trade.\n" +
            "2. **Anything outside them is refused**, by Base itself, not just by bluechip.\n" +
            "3. **Bigger trades ask you first**, with Face ID.\n\n" +
            "More in [How agents work](/help/agents#policies) and [Approvals](/help/approvals#when-youre-asked)."
        )
      ]
    ],
    memories: []
  }
}
