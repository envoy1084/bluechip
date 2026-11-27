import type { ServerEvent } from "@bluechip/domain/analytics/ServerEvents"
import { type Card, isPending } from "@bluechip/domain/assistant/Card"
import type { Memory } from "@bluechip/domain/assistant/Memory"
import { Conflict, type InvalidAutomation, type InvalidSpec, NotFound } from "@bluechip/domain/Errors"
import { CardId, type ConversationId } from "@bluechip/domain/Ids"
import { and, eq, sql } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { AssistantCards, count } from "../../platform/telemetry/Metrics.ts"
import { Agents } from "../agents/Agents.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { Automations } from "../automations/Automations.ts"
import { Memories } from "../memory/Memories.ts"
import { SavedTemplates } from "../policies/SavedTemplates.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { assistantCards, conversations } from "./tables.ts"

/** A card before it is stored: everything but its id. */
export type CardInput = Card extends infer C ? C extends Card ? Omit<C, "id"> : never : never

/**
 * The assistant's cards as they stand now. Configure cards (pausing, resuming, saving a template, a memory to confirm)
 * change nothing until the user confirms them here; every other card only shows what already happened or what the
 * user's Face ID will do.
 */
export class Cards extends Context.Service<Cards, {
  /** Stores a new card, in the conversation it was shown in (`null` outside one). */
  readonly create: (owner: Owner, conversationId: ConversationId | null, card: CardInput) => Effect.Effect<Card>
  readonly find: (owner: Owner, id: string) => Effect.Effect<Card, NotFound>
  /** Applies a pending card; `Conflict` when it is no longer pending. */
  readonly confirm: (
    owner: Owner,
    id: string
  ) => Effect.Effect<Card, NotFound | Conflict | InvalidSpec | InvalidAutomation>
  /**
   * Confirms a memory from the memory page, and applies the cards still asking about it, so a conversation doesn't
   * ask again.
   */
  readonly confirmMemory: (owner: Owner, memoryId: string) => Effect.Effect<Memory, NotFound>
  /** Dismisses a pending card: nothing is applied. */
  readonly dismiss: (owner: Owner, id: string) => Effect.Effect<Card, NotFound | Conflict>
  /**
   * Keeps or leaves out one of a draft agent card's automations; `Conflict` once the agent is no longer a draft (its
   * automations were decided when it was locked).
   */
  readonly keepAutomation: (
    owner: Owner,
    id: string,
    requestId: string,
    kept: boolean
  ) => Effect.Effect<Card, NotFound | Conflict>
  /**
   * Saves a draft agent card's kept automations for its agent, once the agent is live: each once (by its request id),
   * so asking again changes nothing. `Conflict` while the agent isn't live.
   */
  readonly startAutomations: (owner: Owner, id: string) => Effect.Effect<Card, NotFound | Conflict | InvalidAutomation>
}>()("@bluechip/server/Cards") {
  static readonly layer = Layer.effect(
    Cards,
    Effect.gen(function*() {
      const db = yield* Database
      const agents = yield* Agents
      const templates = yield* SavedTemplates
      const memories = yield* Memories
      const automations = yield* Automations
      const analytics = yield* Analytics

      // A card's moment told to analytics, with its conversation and where it was (a card outside one is the web's).
      const tell = Effect.fnUntraced(function*(
        owner: Owner,
        card: Card,
        event: "card_shown" | "card_confirmed" | "card_dismissed",
        conversationId: string | null
      ) {
        if (conversationId === null) return
        const [conversation] = yield* db.select({ surface: conversations.surface }).from(conversations)
          .where(eq(conversations.id, conversationId as `conversation_${string}`)).pipe(Effect.orDie)
        yield* analytics.capture(owner.id, {
          _tag: event,
          kind: card._tag,
          conversation_id: conversationId,
          surface: conversation?.surface ?? "web"
        } as Extract<ServerEvent, { readonly _tag: typeof event }>, { id: card.id })
      })

      const byId = (owner: Owner, id: string) =>
        and(eq(assistantCards.id, id as `card_${string}`), eq(assistantCards.userId, owner.id as `user_${string}`))

      const create = Effect.fn("Cards.create")(function*(
        owner: Owner,
        conversationId: ConversationId | null,
        input: CardInput
      ) {
        const card = { ...input, id: CardId.make(typeid("card").toString()) } as Card
        const now = yield* DateTime.now
        yield* db.insert(assistantCards).values({
          id: card.id as `card_${string}`,
          userId: owner.id as `user_${string}`,
          conversationId: conversationId as `conversation_${string}` | null,
          card,
          createdAt: now,
          updatedAt: now
        }).pipe(Effect.orDie)
        yield* count(AssistantCards, { kind: card._tag, outcome: "shown" })
        yield* tell(owner, card, "card_shown", conversationId)
        return card
      })

      const find = Effect.fn("Cards.find")(function*(owner: Owner, id: string) {
        const [row] = Schema.is(CardId)(id) ?
          yield* db.select().from(assistantCards).where(byId(owner, id)).pipe(Effect.orDie) :
          []
        if (row === undefined) return yield* new NotFound({ resource: "card", id })
        return row.card
      })

      const save = Effect.fnUntraced(function*(owner: Owner, card: Card) {
        const [saved] = yield* db.update(assistantCards).set({ card, updatedAt: yield* DateTime.now })
          .where(byId(owner, card.id)).returning({ conversationId: assistantCards.conversationId }).pipe(Effect.orDie)
        const status = (card as { readonly status?: string }).status
        if (status === "applied" || status === "dismissed") {
          yield* count(AssistantCards, { kind: card._tag, outcome: status === "applied" ? "confirmed" : "dismissed" })
          yield* tell(
            owner,
            card,
            status === "applied" ? "card_confirmed" : "card_dismissed",
            saved?.conversationId ?? null
          )
        }
        return card
      })

      const pending = Effect.fnUntraced(function*(owner: Owner, id: string) {
        const card = yield* find(owner, id)
        if (!isPending(card)) return yield* new Conflict({ reason: "cardClosed" })
        return card
      })

      const confirm = Effect.fn("Cards.confirm")(function*(owner: Owner, id: string) {
        yield* Effect.annotateCurrentSpan("card.id", id)
        const card = yield* pending(owner, id)

        switch (card._tag) {
          case "AgentControl": {
            const changed = card.action === "pauseAll" ?
              yield* agents.pauseAll(owner) :
              [yield* (card.action === "pause" ? agents.pause : agents.resume)(owner, card.agentId!)]
            return yield* save(owner, { ...card, status: "applied", agents: changed })
          }
          case "SaveTemplate": {
            const template = yield* templates.save(owner, { name: card.name, basedOn: card.basedOn, spec: card.spec })
            return yield* save(owner, { ...card, status: "applied", template })
          }
          case "Automation": {
            const automation = card.automationId === null ?
              yield* automations.create(owner, {
                // The card's id makes confirming it twice (a retry) save one automation.
                requestId: card.id,
                draft: card.draft,
                createdBy: "assistant"
              }) :
              yield* automations.update(owner, card.automationId, { draft: card.draft })
            return yield* save(owner, { ...card, status: "applied", automation })
          }
          case "AutomationControl": {
            const automation = yield* automations.update(owner, card.automationId, {
              status: card.action === "pause" ? "paused" : "active"
            })
            return yield* save(owner, { ...card, status: "applied", automation })
          }
          case "Memory": {
            const memory = yield* memories.confirm(owner, card.memory.id)
            return yield* save(owner, { ...card, status: "applied", memory })
          }
        }
      })

      const confirmMemory = Effect.fn("Cards.confirmMemory")(function*(owner: Owner, memoryId: string) {
        const memory = yield* memories.confirm(owner, memoryId)

        const rows = yield* db.select().from(assistantCards).where(and(
          eq(assistantCards.userId, owner.id as `user_${string}`),
          sql`${assistantCards.card}->>'_tag' = 'Memory' and ${assistantCards.card}->'memory'->>'id' = ${memory.id}`
        )).pipe(Effect.orDie)
        for (const { card } of rows) {
          if (card._tag === "Memory" && isPending(card)) yield* save(owner, { ...card, status: "applied", memory })
        }
        return memory
      })

      const dismiss = Effect.fn("Cards.dismiss")(function*(owner: Owner, id: string) {
        const card = yield* pending(owner, id)
        // An inferred memory the user turns down is not kept; one already deleted needs nothing more.
        if (card._tag === "Memory") {
          yield* memories.discard(owner, card.memory.id).pipe(Effect.catchTag("NotFound", () => Effect.void))
        }
        return yield* save(owner, { ...card, status: "dismissed" })
      })

      const draftAgentCard = Effect.fnUntraced(function*(owner: Owner, id: string) {
        const card = yield* find(owner, id)
        if (card._tag !== "DraftAgent") return yield* new NotFound({ resource: "card", id })
        return { card, agent: yield* agents.find(owner, card.agent.id) }
      })

      const keepAutomation = Effect.fn("Cards.keepAutomation")(
        function*(owner: Owner, id: string, requestId: string, kept: boolean) {
          const { agent, card } = yield* draftAgentCard(owner, id)
          const list = card.automations ?? []
          if (!list.some((automation) => automation.requestId === requestId)) {
            return yield* new NotFound({ resource: "automation", id: requestId })
          }
          if (agent.status !== "draft") return yield* new Conflict({ reason: "cardClosed" })
          return yield* save(owner, {
            ...card,
            agent,
            automations: list.map((automation) =>
              automation.requestId === requestId ? { ...automation, kept } : automation
            )
          })
        }
      )

      const startAutomations = Effect.fn("Cards.startAutomations")(function*(owner: Owner, id: string) {
        const { agent, card } = yield* draftAgentCard(owner, id)
        if (agent.status !== "active") return yield* new Conflict({ reason: "agentBusy" })

        const started = []
        for (const automation of card.automations ?? []) {
          if (!automation.kept || automation.automationId !== null) {
            started.push(automation)
            continue
          }
          const saved = yield* automations.create(owner, {
            requestId: automation.requestId,
            draft: automation.draft,
            createdBy: "template"
          })
          started.push({ ...automation, automationId: saved.id })
        }
        return yield* save(owner, { ...card, agent, automations: started })
      })

      return Cards.of({ create, find, confirm, confirmMemory, dismiss, keepAutomation, startAutomations })
    })
  )
}
