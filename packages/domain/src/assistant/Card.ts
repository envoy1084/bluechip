/**
 * Cards: what the assistant's actions look like in the conversation, built from real data (an intent, an agent, a
 * signing request). The model is told what each card says, in words, so its answer states the same facts.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Agent, AgentRequest } from "../agents/Agent.ts"
import { Automation, AutomationDescription, AutomationDraft } from "../automations/Automation.ts"
import { AgentId, AutomationId, CardId, RequestId } from "../Ids.ts"
import { describeDecision, describeLeg } from "../intents/Describe.ts"
import { Intent, IntentRequest } from "../intents/Intent.ts"
import type { Quote } from "../market/Market.ts"
import { AgentSpec } from "../policies/AgentSpec.ts"
import { policyOf, SpecChanges, SpecDescription } from "../policies/Catalog.ts"
import { SavedTemplate } from "../policies/Templates.ts"
import { price, shares, usd } from "../tools/Words.ts"
import type { TradeWarning } from "../trading/Trade.ts"
import { Memory } from "./Memory.ts"

/**
 * Where a card that waits for you stands: `pending` until you confirm (`applied`) or dismiss it.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const CardStatus = Schema.Literals(["pending", "applied", "dismissed"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type CardStatus = typeof CardStatus.Type

/**
 * A web page the research cited.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const Citation = Schema.Struct({
  url: Schema.String,
  title: Schema.String,
  /** The passage the answer quotes, when it quotes one. */
  citedText: Schema.NullOr(Schema.String)
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Citation = typeof Citation.Type

/**
 * One automation a drafted agent's template comes with, as its card offers it: kept or left out while the agent is a
 * draft, saved for the agent once it is live.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const DraftAutomation = Schema.Struct({
  /** Saves it once, however often it is asked for. */
  requestId: RequestId,
  draft: AutomationDraft,
  /** What it does, in a sentence. */
  sentence: Schema.String,
  kept: Schema.Boolean,
  /** The automation it became once the agent was live; `null` before (or when left out). */
  automationId: Schema.NullOr(AutomationId)
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type DraftAutomation = typeof DraftAutomation.Type

/**
 * Every card:
 *
 * - `Trade`: an agent's trade, decided by its policies: follow it with `IntentChanged` (sent, waiting for your
 *   approval, or blocked with the policy that refused it).
 * - `Approval`: your own trade, prepared for your Face ID (`request`; prepare it again with `POST /api/intents`
 *   once it expires).
 * - `DraftAgent`: an agent drafted from policies, locked with your Face ID (`request`; `POST /api/agents/:id/lock`
 *   prepares it again), with the automations its template comes with (`automations`), kept or left out while it is
 *   a draft and saved once it is live.
 * - `PolicyChange`: a change, renewal or removal of an agent, signed with your Face ID (`request`; `null` when a
 *   draft was removed outright).
 * - `AgentControl`: pausing or resuming an agent (or every agent), applied when you confirm.
 * - `SaveTemplate`: a set of policies to save as a template, saved when you confirm.
 * - `Automation`: an automation drafted from your words (or a change to one, `automationId`), read back in sentences,
 *   saved when you confirm (`automation`, once saved).
 * - `AutomationControl`: pausing or resuming an automation, applied when you confirm.
 * - `Memory`: a memory saved or forgotten, or one the assistant inferred and keeps only if you confirm.
 * - `Research`: web pages the assistant read, untrusted, with citations.
 * - `Error`: why the assistant stopped early: the day's budget, too many steps in one turn, you cancelled, the
 *   connection to you dropped mid-answer (`interrupted`: what it had written so far is kept above the card), or the
 *   model can't answer right now (`unavailable`, after its retries).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Card = Schema.TaggedUnion({
  Trade: { id: CardId, intent: Intent },
  Approval: { id: CardId, intent: Intent, request: IntentRequest },
  DraftAgent: {
    id: CardId,
    agent: Agent,
    request: AgentRequest,
    description: SpecDescription,
    /** Absent on cards drafted before automations came with them. */
    automations: Schema.optionalKey(Schema.Array(DraftAutomation))
  },
  PolicyChange: {
    id: CardId,
    action: Schema.Literals(["update", "renew", "remove"]),
    agent: Agent,
    request: Schema.NullOr(AgentRequest),
    /** What an update changes, policy by policy. */
    changes: Schema.NullOr(SpecChanges),
    /** What the agent can and never does after an update. */
    description: Schema.NullOr(SpecDescription)
  },
  AgentControl: {
    id: CardId,
    action: Schema.Literals(["pause", "resume", "pauseAll"]),
    /** The agent; `null` for every agent. */
    agentId: Schema.NullOr(AgentId),
    agentName: Schema.NullOr(Schema.String),
    status: CardStatus,
    /** The agents as they were left, once applied. */
    agents: Schema.Array(Agent)
  },
  SaveTemplate: {
    id: CardId,
    name: Schema.String,
    basedOn: Schema.NullOr(Schema.String),
    spec: AgentSpec,
    description: SpecDescription,
    status: CardStatus,
    /** The template, once saved. */
    template: Schema.NullOr(SavedTemplate)
  },
  Automation: {
    id: CardId,
    action: Schema.Literals(["create", "edit"]),
    /** The automation an edit changes; `null` for a new one. */
    automationId: Schema.NullOr(AutomationId),
    draft: AutomationDraft,
    description: AutomationDescription,
    status: CardStatus,
    automation: Schema.NullOr(Automation)
  },
  AutomationControl: {
    id: CardId,
    action: Schema.Literals(["pause", "resume"]),
    automationId: AutomationId,
    automationName: Schema.String,
    status: CardStatus,
    automation: Schema.NullOr(Automation)
  },
  Memory: {
    id: CardId,
    action: Schema.Literals(["saved", "forgotten", "confirm"]),
    memory: Memory,
    status: CardStatus
  },
  Research: {
    id: CardId,
    query: Schema.String,
    citations: Schema.Array(Citation)
  },
  Error: {
    id: CardId,
    reason: Schema.Literals(["budget", "rounds", "cancelled", "interrupted", "unavailable"]),
    message: Schema.String
  }
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Card = typeof Card.Type

/**
 * The cards you confirm or dismiss with `POST /api/assistant/cards/:id/confirm` (or `/dismiss`) while `pending`.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type ConfirmableCard = Extract<Card, { readonly status: CardStatus }>

/**
 * Whether a card is waiting for you.
 *
 * @stability unstable
 * @category cards
 * @since 0.0.0
 */
export const isPending = (card: Card): card is ConfirmableCard => "status" in card && card.status === "pending"

// What became of a trade, in words the model can pass on.
const tradeOutcome = (intent: Intent): string => {
  const decided = intent.decision === null ? "" : `${describeDecision(intent.decision)} `
  switch (intent.status) {
    case "proposed":
    case "deciding":
      return "Its policies are still deciding it; nothing has been sent yet."
    case "needsApproval":
      return `${decided}It waits for the user to approve it with Face ID; nothing is sent until they do.`
    case "awaitingSignature":
      return "It waits for the user's Face ID; nothing is sent until they approve it."
    case "waiting":
      return `${decided}Nothing was sent; it is decided again later.`
    case "blocked":
      return `${decided}Nothing was sent.`
    case "sending":
    case "confirming":
      return "Within its policies, so it is being sent now; it isn't filled yet."
    case "filled":
      return "It is filled (getActivity has the fill)."
    case "failed":
      return "It failed on Base, so nothing moved."
    case "declined":
      return "The user declined it; nothing was sent."
    case "expired":
      return "It expired before it was approved; nothing was sent."
    case "cancelled":
      return "It was cancelled; nothing was sent."
  }
}

const tradeOf = (intent: Intent): string => `${describeLeg(intent.leg, (symbol) => symbol)} (intent ${intent.id})`

const quoteOf = (quote: Quote): string =>
  `${quote.side === "buy" ? "about " : ""}${shares(quote.shares)} ${quote.symbol} for ${
    quote.side === "sell" ? "about " : ""
  }${usd(quote.usdc)}, at ${price(quote.price)} a share, ${Math.abs(quote.gapBps) / 100}% ${
    quote.gapBps >= 0 ? "worse" : "better"
  } than Chainlink's ${price(quote.reference.price)}`

const WARNINGS: Readonly<Record<TradeWarning, string>> = {
  pricesPaused: "The market is closed, so prices are paused and it trades at the pool's price.",
  marketApart: "The pool's price is further from Chainlink's than usual."
}

const policiesOf = (description: SpecDescription): string =>
  `It can: ${description.can.join("; ")}. It never: ${description.never.join("; ")}.`

const changesOf = (changes: SpecChanges): string =>
  `Overall it is ${changes.overall}: ${
    changes.policies.map((change) => `${policyOf(change.policy).title} ${change.change}`).join(", ")
  }.`

const answered = (status: CardStatus, done: string): string =>
  status === "applied" ? done : "The user left it as it was; nothing changed."

/**
 * What the model is told about a card it produced: the facts the user sees on it (amounts, prices, names, what was
 * decided), in words it can repeat, and what happens next. The user may not see the card at all (a chat shows only a
 * short message), so the model says the substance itself.
 *
 * @stability unstable
 * @category cards
 * @since 0.0.0
 */
export const describeCard = (card: Card): string => {
  switch (card._tag) {
    case "Trade":
      return `${card.intent.agentId === null ? "The user's own trade" : `Agent ${card.intent.agentId}'s trade`}: ` +
        `${tradeOf(card.intent)}. ${tradeOutcome(card.intent)}`
    case "Approval": {
      const { request } = card
      const together = request.together.length === 0 ?
        "" :
        ` The same Face ID also sends: ${
          request.together.map((other) => `${tradeOf(other.intent)}, ${quoteOf(other.quote)}`).join("; ")
        }.`
      return `The user's own trade, prepared for their Face ID: ${tradeOf(card.intent)}, ${quoteOf(request.quote)}.` +
        together +
        (request.deploysAccount ? " It also sets up their account onchain, in the same Face ID." : "") +
        request.warnings.map((warning) => ` ${WARNINGS[warning]}`).join("") +
        " Nothing happens until they approve it with Face ID."
    }
    case "DraftAgent": {
      const automations = card.automations ?? []
      return `Drafted the agent "${card.agent.name}" (${card.agent.id}), not live yet. ${
        policiesOf(card.description)
      }` +
        (automations.length === 0 ?
          "" :
          ` It comes with these automations, each kept or left out by the user before it's locked and started once ` +
          `it's live: ${automations.map((automation) => automation.sentence).join(" ")}`) +
        " It is locked onchain only when the user approves it with Face ID."
    }
    case "PolicyChange": {
      const agent = `${card.agent.name} (${card.agent.id})`
      if (card.request === null) return `Removed the draft agent ${agent}; it was never live, so no Face ID was needed.`
      switch (card.action) {
        case "update":
          return `Prepared a change to ${agent}'s policies. ` +
            (card.changes === null ? "" : `${changesOf(card.changes)} `) +
            (card.description === null ? "" : `After it: ${policiesOf(card.description)} `) +
            "Nothing changes until the user approves it with Face ID."
        case "renew":
          return `Prepared a renewal of ${agent}: a new key with the same policies for 90 more days, once the user ` +
            "approves it with Face ID."
        case "remove":
          return `Prepared the removal of ${agent}: once the user approves it with Face ID its key is revoked onchain ` +
            "and it stops for good. Their stocks and cash stay in their account."
      }
    }
    case "AgentControl": {
      const name = card.agentName ?? "every agent"
      if (card.status === "pending") {
        return card.action === "resume" ?
          `Waiting for the user to confirm resuming ${name}: it trades again inside its policies.` :
          `Waiting for the user to confirm pausing ${name}: trading stops at once, and nothing is sold.`
      }
      return answered(
        card.status,
        card.action === "pauseAll" ?
          "Every agent is paused." :
          `${name} is ${card.action === "pause" ? "paused" : "running again"}.`
      )
    }
    case "SaveTemplate":
      return card.status === "pending" ?
        `Waiting for the user to confirm saving the template "${card.name}". ${policiesOf(card.description)}` :
        answered(card.status, `Saved the template "${card.name}".`)
    case "Automation":
      return card.status === "pending" ?
        `Waiting for the user to confirm ${
          card.action === "create" ? "a new automation" : "a change to an automation"
        }: ` +
        `"${card.description.sentence}" Nothing is saved until they do.` :
        answered(card.status, `Saved the automation: "${card.description.sentence}"`)
    case "AutomationControl":
      return card.status === "pending" ?
        `Waiting for the user to confirm ${card.action === "pause" ? "pausing" : "resuming"} the automation ` +
        `${card.automationName}.` :
        answered(
          card.status,
          `The automation ${card.automationName} is ${card.action === "pause" ? "paused" : "running again"}.`
        )
    case "Memory":
      if (card.action !== "confirm") return `Memory ${card.action}: "${card.memory.text}" (${card.memory.id}).`
      return card.status === "pending" ?
        `Asking the user whether to remember: "${card.memory.text}"` :
        card.status === "applied" ?
        `The user kept the memory "${card.memory.text}".` :
        `The user chose not to keep "${card.memory.text}".`
    case "Research":
      return card.citations.length === 0 ?
        `Searched the web for "${card.query}"; nothing was cited.` :
        `Searched the web for "${card.query}" and cited: ${
          card.citations.map((citation) => `${citation.title} (${citation.url})`).join("; ")
        }.`
    case "Error":
      return card.message
  }
}
