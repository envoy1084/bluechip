import { stocks } from "@bluechip/chain/Contracts"
import { AgentRequest } from "@bluechip/domain/agents/Agent"
import type { Card } from "@bluechip/domain/assistant/Card"
import { AutomationDraft } from "@bluechip/domain/automations/Automation"
import { type Address, type AgentId, SavedTemplateId } from "@bluechip/domain/Ids"
import { describeDecision } from "@bluechip/domain/intents/Describe"
import { type Intent, IntentRequest, type Leg } from "@bluechip/domain/intents/Intent"
import { rebalanceLegs } from "@bluechip/domain/intents/RebalanceLegs"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { catalogInfo, compareSpecs, complete, describeSpec, SpecCheck } from "@bluechip/domain/policies/Catalog"
import { formatDollars } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import { Caller, ToolProblem } from "@bluechip/domain/tools/Caller"
import { applyPatch, draftAgentSpec, type PatchedSpec, type SpecDraft } from "@bluechip/domain/tools/SpecPatch"
import { BluechipToolkit } from "@bluechip/domain/tools/Toolkit"
import * as AnthropicTool from "@effect/ai-anthropic/AnthropicTool"
import * as Toolkit from "effect/ai/Toolkit"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { randomUUID } from "node:crypto"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { Activity } from "../activity/Activity.ts"
import { AgentRequests } from "../agents/AgentRequests.ts"
import { Agents } from "../agents/Agents.ts"
import { Automations } from "../automations/Automations.ts"
import { Intents } from "../intents/Intents.ts"
import { AgentJournal } from "../journal/AgentJournal.ts"
import { Knowledge } from "../knowledge/Knowledge.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { Quoter } from "../market/Quoter.ts"
import { Stocks } from "../market/Stocks.ts"
import { Memories } from "../memory/Memories.ts"
import { Recall } from "../memory/Recall.ts"
import { SavedTemplates } from "../policies/SavedTemplates.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { valueHoldings } from "../portfolio/Valuation.ts"
import { Cards } from "./Cards.ts"

/**
 * The toolkit the assistant runs: bluechip's tools and Anthropic's web search (`research`), which Anthropic runs and
 * whose results are untrusted text.
 */
export const AssistantToolkit = Toolkit.merge(
  BluechipToolkit,
  Toolkit.make(AnthropicTool.WebSearch_20250305({ maxUses: 3 }))
)

type Failure =
  | ToolProblem
  | { readonly _tag: "NotFound"; readonly resource: string; readonly id: string }
  | { readonly _tag: "Conflict"; readonly reason: string }
  | { readonly _tag: "InvalidSpec"; readonly problems: ReadonlyArray<{ readonly message: string }> }
  | { readonly _tag: "InvalidAutomation"; readonly problems: ReadonlyArray<{ readonly message: string }> }
  | { readonly _tag: "InsufficientCash"; readonly available: bigint }
  | { readonly _tag: "InsufficientShares"; readonly symbol: string }
  | { readonly _tag: "NotTradable"; readonly symbol: string }
  | { readonly _tag: "QuoteUnavailable"; readonly symbol: string; readonly reason: string }
  | { readonly _tag: "PriceCheckFailed"; readonly symbol: string }
  | { readonly _tag: "Unavailable" | "ChainError" | "AlpacaError" }

// What a service's failure means to the model, in words it can pass on.
const problemOf = (failure: Failure): ToolProblem => {
  switch (failure._tag) {
    case "ToolProblem":
      return failure
    case "NotFound":
      return new ToolProblem({ problem: `There is no ${failure.resource} ${failure.id} for this user.` })
    case "Conflict":
      return new ToolProblem({
        problem: failure.reason === "agentBusy" ?
          "The agent can't do that now: it isn't active, is paused, or has a change on its way." :
          `That can't be done now (${failure.reason}).`
      })
    case "InvalidSpec":
      return new ToolProblem({
        problem: `The policies have problems: ${failure.problems.map((p) => p.message).join(" ")}`
      })
    case "InvalidAutomation":
      return new ToolProblem({
        problem: `The automation has problems: ${failure.problems.map((p) => p.message).join(" ")}`
      })
    case "InsufficientCash":
      return new ToolProblem({ problem: `Not enough cash: ${formatDollars(failure.available)} available.` })
    case "InsufficientShares":
      return new ToolProblem({ problem: `The user doesn't hold that many ${failure.symbol} shares.` })
    case "NotTradable":
      return new ToolProblem({ problem: `${failure.symbol} has no pool to trade in.` })
    case "QuoteUnavailable":
      return new ToolProblem({ problem: `No quote for ${failure.symbol} right now (${failure.reason}).` })
    case "PriceCheckFailed":
      return new ToolProblem({ problem: `${failure.symbol}'s pool price is too far from Chainlink's to trade now.` })
    default:
      return new ToolProblem({ problem: "Base or a price source isn't answering; try again in a moment." })
  }
}

const problem = (text: string) => new ToolProblem({ problem: text })

const nameOf = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol

const legOf = (input: {
  readonly symbol: StockSymbol
  readonly side: "buy" | "sell"
  readonly dollars: number | null
  readonly shares: number | null
}): Effect.Effect<Leg, ToolProblem> => {
  if (input.side === "buy") {
    if (input.dollars === null || input.dollars <= 0) {
      return Effect.fail(problem("A buy needs a positive number of dollars."))
    }
    const usdc = Usdc.make(BigInt(Math.round(input.dollars * 1e6)))
    return Effect.succeed({ symbol: input.symbol, side: "buy", amount: { usdc } })
  }
  if (input.shares === null || input.shares <= 0) {
    return Effect.fail(problem("A sell needs a positive number of shares."))
  }
  const shares = Shares.make(BigInt(Math.round(input.shares * 1e8)))
  return Effect.succeed({ symbol: input.symbol, side: "sell", amount: { shares } })
}

const fromPatch = ({ problems, spec }: PatchedSpec): Effect.Effect<AgentSpec, ToolProblem> =>
  problems.length === 0 ?
    Effect.succeed(spec) :
    Effect.fail(problem(`The policies have problems: ${problems.map((p) => `${p.policy}: ${p.message}`).join(" ")}`))

/**
 * The toolkit's handlers on bluechip's services, for the user in `Caller`. Read tools read; propose tools create
 * intents (the desk decides them); configure tools store a pending card; sign tools prepare a signing request and stop
 * there, so only the user's passkey completes them.
 */
export const AssistantToolsLive = BluechipToolkit.toLayer(Effect.gen(function*() {
  const balances = yield* AccountBalances
  const market = yield* MarketPrices
  const stockList = yield* Stocks
  const quoter = yield* Quoter
  const activity = yield* Activity
  const agents = yield* Agents
  const requests = yield* AgentRequests
  const intents = yield* Intents
  const templates = yield* SavedTemplates
  const memories = yield* Memories
  const recall = yield* Recall
  const journal = yield* AgentJournal
  const knowledge = yield* Knowledge
  const cards = yield* Cards
  const live = yield* LiveEvents
  const automations = yield* Automations

  const card = (input: Parameters<typeof cards.create>[2]) =>
    Effect.flatMap(Caller, (caller) => cards.create(caller, caller.conversationId, input))

  const portfolio = Effect.gen(function*() {
    const caller = yield* Caller
    const holdings = yield* balances.of(caller.account as Address & `0x${string}`)
    return valueHoldings(holdings, yield* market.prices, yield* DateTime.now)
  })

  const agentSpec = Effect.fnUntraced(function*(agentId: AgentId) {
    const agent = yield* agents.find(yield* Caller, agentId)
    return { agent, spec: complete(agent.pendingSpec ?? agent.spec) }
  })

  // Creates an intent and, for an agent's trade, waits briefly for its policies to decide it, so the card and the
  // model see the outcome. A decision that takes longer arrives as `IntentChanged`.
  const propose = Effect.fnUntraced(function*(agentId: AgentId | null, leg: Leg, reason: string) {
    const caller = yield* Caller
    const changes = yield* live.subscribe(caller.id)
    const created = yield* intents.create(caller, {
      requestId: randomUUID(),
      agentId,
      leg,
      reason,
      source: caller.source,
      sourceId: caller.conversationId ?? undefined
    })
    if (created instanceof IntentRequest) {
      return yield* card({ _tag: "Approval", intent: created.intent, request: created })
    }

    const decided = yield* changes.pipe(
      Stream.filter((event): event is Extract<typeof event, { _tag: "IntentChanged" }> =>
        event._tag === "IntentChanged" && event.intent.id === created.id &&
        event.intent.status !== "proposed" && event.intent.status !== "deciding"
      ),
      Stream.map((event): Intent => event.intent),
      Stream.runHead,
      Effect.timeoutOption("10 seconds")
    )
    const intent = decided._tag === "Some" && decided.value._tag === "Some" ? decided.value.value : created
    return yield* card({ _tag: "Trade", intent })
  }, Effect.scoped)

  // A draft's spec, from a built-in template or one of the user's saved ones.
  const draftedSpec = Effect.fnUntraced(function*(draft: SpecDraft) {
    if (!Schema.is(SavedTemplateId)(draft.template)) return draftAgentSpec(draft)
    const saved = yield* templates.find(yield* Caller, draft.template)
    return draftAgentSpec(draft, saved.spec)
  })

  const asProblem = Effect.mapError(problemOf)

  return BluechipToolkit.of({
    getPortfolio: Effect.fn("AssistantTools.getPortfolio")(function*() {
      return yield* portfolio
    }, asProblem),
    getPrices: Effect.fn("AssistantTools.getPrices")(function*({ symbols }) {
      const all = yield* stockList.list
      return symbols.length === 0 ? all : all.filter((stock) => symbols.includes(stock.symbol))
    }),
    getStock: Effect.fn("AssistantTools.getStock")(function*({ symbol }) {
      const stock = (yield* stockList.list).find((candidate) => candidate.symbol === symbol)
      if (stock === undefined) return yield* problem(`bluechip doesn't list ${symbol}.`)
      return stock
    }),
    getStockFacts: Effect.fn("AssistantTools.getStockFacts")(function*({ symbol }) {
      const facts = knowledge.stockFacts(symbol)
      if (facts === undefined) return yield* problem(`bluechip doesn't list ${symbol}.`)
      return facts
    }),
    searchHelp: Effect.fn("AssistantTools.searchHelp")(function*({ query }) {
      return yield* knowledge.search(query)
    }),
    getQuote: Effect.fn("AssistantTools.getQuote")(function*(params) {
      const leg = yield* legOf(params)
      return yield* quoter.quote(
        "usdc" in leg.amount ?
          { symbol: leg.symbol, side: "buy", usdc: leg.amount.usdc } :
          { symbol: leg.symbol, side: "sell", shares: leg.amount.shares }
      )
    }, asProblem),
    getActivity: Effect.fn("AssistantTools.getActivity")(function*({ kind, period }) {
      const caller = yield* Caller
      return (yield* activity.list(caller.id, { kind, period, pageSize: 20 })).items
    }),

    listAgents: Effect.fn("AssistantTools.listAgents")(function*() {
      return yield* agents.list(yield* Caller)
    }),
    getAgent: Effect.fn("AssistantTools.getAgent")(function*({ agentId }) {
      const agent = yield* agents.find(yield* Caller, agentId)
      return { agent, description: describeSpec(agent.spec, nameOf) }
    }, asProblem),
    getAgentUsage: Effect.fn("AssistantTools.getAgentUsage")(function*({ agentId }) {
      return yield* agents.usage(yield* Caller, agentId)
    }, asProblem),
    getAgentHistory: Effect.fn("AssistantTools.getAgentHistory")(function*({ agentId }) {
      const caller = yield* Caller
      const sessions = yield* agents.sessions(caller, agentId)
      const page = yield* intents.list(caller, { agentId, pageSize: 10 })
      return { sessions, intents: page.items }
    }, asProblem),
    getAgentJournal: Effect.fn("AssistantTools.getAgentJournal")(function*({ agentId, limit }) {
      return yield* journal.read(yield* Caller, agentId, { limit: limit ?? undefined })
    }, asProblem),
    explainDecision: Effect.fn("AssistantTools.explainDecision")(function*({ intentId }) {
      const intent = yield* intents.find(yield* Caller, intentId)
      const explanation = intent.decision === null ?
        `It is ${intent.status} and hasn't been decided by policies.` :
        describeDecision(intent.decision)
      return { intent, explanation }
    }, asProblem),

    listPolicies: Effect.fn("AssistantTools.listPolicies")(function*() {
      return catalogInfo()
    }),
    listTemplates: Effect.fn("AssistantTools.listTemplates")(function*() {
      return yield* templates.list(yield* Caller)
    }),
    checkAgentSpec: Effect.fn("AssistantTools.checkAgentSpec")(function*({ agentId, changes, draft }) {
      if (agentId === null) {
        if (draft === null) return yield* problem("Give a draft for a new agent, or an agent to change.")
        const { problems, spec } = yield* draftedSpec(draft)
        return new SpecCheck({ problems, description: describeSpec(spec, nameOf), changes: null })
      }
      const current = yield* agentSpec(agentId)
      const { problems, spec } = applyPatch(current.spec, changes ?? {})
      return new SpecCheck({
        problems,
        description: describeSpec(spec, nameOf),
        changes: compareSpecs(current.spec, spec)
      })
    }, asProblem),

    proposeTrade: Effect.fn("AssistantTools.proposeTrade")(function*(params) {
      const leg = yield* legOf(params)
      return yield* propose(params.agentId, leg, params.reason.trim())
    }, asProblem),
    proposeRebalance: Effect.fn("AssistantTools.proposeRebalance")(function*({ agentId, reason }) {
      const { spec } = yield* agentSpec(agentId)
      const config = configOf(spec.policies, rebalance)
      if (config === undefined) return yield* problem("This agent doesn't keep a target mix.")

      const prices = new Map([...(yield* market.prices)].map(([symbol, price]) => [symbol, price.price]))
      const legs = rebalanceLegs(yield* portfolio, config, prices)
      const proposed: Array<Card> = []
      for (const leg of legs) proposed.push(yield* propose(agentId, leg, reason.trim()))
      return proposed
    }, asProblem),

    pauseAgent: Effect.fn("AssistantTools.pauseAgent")(function*({ agentId }) {
      const agent = yield* agents.find(yield* Caller, agentId)
      return yield* card({
        _tag: "AgentControl",
        action: "pause",
        agentId,
        agentName: agent.name,
        status: "pending",
        agents: []
      })
    }, asProblem),
    resumeAgent: Effect.fn("AssistantTools.resumeAgent")(function*({ agentId }) {
      const agent = yield* agents.find(yield* Caller, agentId)
      return yield* card({
        _tag: "AgentControl",
        action: "resume",
        agentId,
        agentName: agent.name,
        status: "pending",
        agents: []
      })
    }, asProblem),
    pauseAll: Effect.fn("AssistantTools.pauseAll")(function*() {
      return yield* card({
        _tag: "AgentControl",
        action: "pauseAll",
        agentId: null,
        agentName: null,
        status: "pending",
        agents: []
      })
    }),
    saveTemplate: Effect.fn("AssistantTools.saveTemplate")(function*({ agentId, draft, name }) {
      const source = agentId !== null ?
        yield* Effect.map(agentSpec(agentId), ({ agent, spec }) => ({ basedOn: agent.template, spec })) :
        draft !== null ?
        { basedOn: draft.template as string, spec: yield* fromPatch(yield* draftedSpec(draft)) } :
        yield* problem("Give an agent or a draft to save.")
      return yield* card({
        _tag: "SaveTemplate",
        name,
        basedOn: source.basedOn,
        spec: source.spec,
        description: describeSpec(source.spec, nameOf),
        status: "pending",
        template: null
      })
    }, asProblem),

    draftAgent: Effect.fn("AssistantTools.draftAgent")(function*({ draft, name }) {
      const spec = yield* fromPatch(yield* draftedSpec(draft))
      const request = yield* requests.create(yield* Caller, {
        requestId: randomUUID(),
        name,
        template: draft.template,
        spec
      })
      return yield* card({
        _tag: "DraftAgent",
        agent: request.agent,
        request,
        description: describeSpec(spec, nameOf)
      })
    }, asProblem),
    changeAgentPolicies: Effect.fn("AssistantTools.changeAgentPolicies")(function*({ agentId, changes }) {
      const current = yield* agentSpec(agentId)
      const spec = yield* fromPatch(applyPatch(current.spec, changes))
      const request = yield* requests.change(yield* Caller, agentId, { requestId: randomUUID(), spec })
      return yield* card({
        _tag: "PolicyChange",
        action: "update",
        agent: request.agent,
        request,
        changes: compareSpecs(current.spec, spec),
        description: describeSpec(spec, nameOf)
      })
    }, asProblem),
    renewAgent: Effect.fn("AssistantTools.renewAgent")(function*({ agentId }) {
      const request = yield* requests.renew(yield* Caller, agentId, randomUUID())
      return yield* card({
        _tag: "PolicyChange",
        action: "renew",
        agent: request.agent,
        request,
        changes: null,
        description: null
      })
    }, asProblem),
    removeAgent: Effect.fn("AssistantTools.removeAgent")(function*({ agentId }) {
      const removed = yield* requests.remove(yield* Caller, agentId, randomUUID())
      // A draft is removed outright (nothing onchain); a locked agent's removal waits for the passkey.
      const signed = removed instanceof AgentRequest
      return yield* card({
        _tag: "PolicyChange",
        action: "remove",
        agent: signed ? removed.agent : removed,
        request: signed ? removed : null,
        changes: null,
        description: null
      })
    }, asProblem),

    remember: Effect.fn("AssistantTools.remember")(function*({ agentId, kind, text }) {
      const caller = yield* Caller
      if (agentId !== null) yield* agents.find(caller, agentId)
      const memory = yield* memories.remember(caller, { kind, text, agentId, messageId: caller.messageId })
      return yield* card({ _tag: "Memory", action: "saved", memory, status: "applied" })
    }, asProblem),
    forget: Effect.fn("AssistantTools.forget")(function*({ memoryId }) {
      const memory = yield* memories.remove(yield* Caller, memoryId)
      return yield* card({ _tag: "Memory", action: "forgotten", memory, status: "applied" })
    }, asProblem),
    listMemories: Effect.fn("AssistantTools.listMemories")(function*() {
      return yield* memories.list(yield* Caller)
    }),
    searchMemory: Effect.fn("AssistantTools.searchMemory")(function*({ query }) {
      return yield* recall.search(yield* Caller, { text: query, limit: 10 })
    }),

    listAutomations: Effect.fn("AssistantTools.listAutomations")(function*({ agentId }) {
      return yield* automations.list(yield* Caller, agentId ?? undefined)
    }),
    createAutomation: Effect.fn("AssistantTools.createAutomation")(function*({ automationId, draft }) {
      const caller = yield* Caller
      const automation = new AutomationDraft(draft)
      if (automationId !== null) {
        const { automation: saved } = yield* automations.detail(caller, automationId)
        if (saved.agentId !== automation.agentId) return yield* problem("An automation's agent can't change.")
      }
      const check = yield* automations.check(caller, automation)
      if (check.problems.length > 0) {
        return yield* problem(
          `The automation has problems: ${
            check.problems.map((found) =>
              `${found.part}${found.field === null ? "" : `.${found.field}`}: ${found.message}`
            )
              .join(" ")
          }`
        )
      }
      return yield* card({
        _tag: "Automation",
        action: automationId === null ? "create" : "edit",
        automationId,
        draft: automation,
        description: check.description,
        status: "pending",
        automation: null
      })
    }, asProblem),
    pauseAutomation: Effect.fn("AssistantTools.pauseAutomation")(function*({ automationId, resume }) {
      const { automation } = yield* automations.detail(yield* Caller, automationId)
      return yield* card({
        _tag: "AutomationControl",
        action: resume ? "resume" : "pause",
        automationId,
        automationName: automation.name,
        status: "pending",
        automation: null
      })
    }, asProblem)
  })
}))
