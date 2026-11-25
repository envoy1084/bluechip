/**
 * Cards: what the assistant's actions look like in the conversation. Every number you see comes from a card built
 * from real data (an intent, an agent, a signing request), never from the model's words; the model is only told
 * what the card says.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Agent, AgentRequest } from "../agents/Agent.ts"
import { AgentId, CardId } from "../Ids.ts"
import { describeDecision } from "../intents/Describe.ts"
import { Intent, IntentRequest } from "../intents/Intent.ts"
import { AgentSpec } from "../policies/AgentSpec.ts"
import { SpecChanges, SpecDescription } from "../policies/Catalog.ts"
import { SavedTemplate } from "../policies/Templates.ts"
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
 * Every card:
 *
 * - `Trade`: an agent's trade, decided by its policies: follow it with `IntentChanged` (sent, waiting for your
 *   approval, or blocked with the policy that refused it).
 * - `Approval`: your own trade, prepared for your Face ID (`request`; prepare it again with `POST /api/intents`
 *   once it expires).
 * - `DraftAgent`: an agent drafted from policies, locked with your Face ID (`request`; `POST /api/agents/:id/lock`
 *   prepares it again).
 * - `PolicyChange`: a change, renewal or removal of an agent, signed with your Face ID (`request`; `null` when a
 *   draft was removed outright).
 * - `AgentControl`: pausing or resuming an agent (or every agent), applied when you confirm.
 * - `SaveTemplate`: a set of policies to save as a template, saved when you confirm.
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
  DraftAgent: { id: CardId, agent: Agent, request: AgentRequest, description: SpecDescription },
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

const tradeOutcome = (intent: Intent): string => {
  switch (intent.status) {
    case "proposed":
    case "deciding":
      return "Its policies are deciding it now; the card shows the outcome."
    case "needsApproval":
    case "awaitingSignature":
      return "It waits for the user's approval with Face ID on the card."
    case "blocked":
    case "waiting":
      return intent.decision === null ? `It is ${intent.status}.` : describeDecision(intent.decision)
    case "sending":
    case "confirming":
      return "The agent is sending it."
    default:
      return `It is ${intent.status}.`
  }
}

/**
 * What the model is told about a card it produced: what the user sees and what happens next, never a number the card
 * doesn't show. The model refers to the card instead of repeating it.
 *
 * @stability unstable
 * @category cards
 * @since 0.0.0
 */
export const describeCard = (card: Card): string => {
  switch (card._tag) {
    case "Trade":
      return `Shown as a trade card for intent ${card.intent.id} (${card.intent.leg.side} ${card.intent.leg.symbol}). ` +
        tradeOutcome(card.intent)
    case "Approval":
      return `Shown as a trade card for intent ${card.intent.id}, prepared for the user's Face ID. ` +
        "Nothing happens unless they approve it on the card."
    case "DraftAgent":
      return `Shown as a draft agent card for "${card.agent.name}" (${card.agent.id}). ` +
        "It is locked only when the user approves it with Face ID on the card."
    case "PolicyChange":
      return card.request === null ?
        `The draft agent ${card.agent.id} was removed.` :
        `Shown as a card to ${card.action} ${card.agent.name} (${card.agent.id}). ` +
        "It happens only when the user approves it with Face ID on the card."
    case "AgentControl":
    case "SaveTemplate":
      return card.status === "pending" ?
        "Shown as a card. Nothing changes until the user confirms it on the card." :
        `The card is ${card.status}.`
    case "Memory":
      return card.action === "confirm" ?
        `Shown as a card asking the user to confirm the memory "${card.memory.text}".` :
        `Memory ${card.action}: "${card.memory.text}" (${card.memory.id}).`
    case "Research":
      return `Shown as a research card citing ${card.citations.length} pages.`
    case "Error":
      return card.message
  }
}
