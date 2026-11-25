import { type Card, isPending } from "@bluechip/domain/assistant/Card"
import type { Memory } from "@bluechip/domain/assistant/Memory"
import { Conflict, type InvalidSpec, NotFound } from "@bluechip/domain/Errors"
import { CardId, type ConversationId } from "@bluechip/domain/Ids"
import { and, eq, sql } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { Agents } from "../agents/Agents.ts"
import { SavedTemplates } from "../policies/SavedTemplates.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { Memories } from "./Memories.ts"
import { assistantCards } from "./tables.ts"

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
  readonly confirm: (owner: Owner, id: string) => Effect.Effect<Card, NotFound | Conflict | InvalidSpec>
  /**
   * Confirms a memory from the memory page, and applies the cards still asking about it, so a conversation doesn't
   * ask again.
   */
  readonly confirmMemory: (owner: Owner, memoryId: string) => Effect.Effect<Memory, NotFound>
  /** Dismisses a pending card: nothing is applied. */
  readonly dismiss: (owner: Owner, id: string) => Effect.Effect<Card, NotFound | Conflict>
}>()("@bluechip/server/Cards") {
  static readonly layer = Layer.effect(
    Cards,
    Effect.gen(function*() {
      const db = yield* Database
      const agents = yield* Agents
      const templates = yield* SavedTemplates
      const memories = yield* Memories

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
        yield* db.update(assistantCards).set({ card, updatedAt: yield* DateTime.now })
          .where(byId(owner, card.id)).pipe(Effect.orDie)
        return card
      })

      const pending = Effect.fnUntraced(function*(owner: Owner, id: string) {
        const card = yield* find(owner, id)
        if (!isPending(card)) return yield* new Conflict({ reason: "cardClosed" })
        return card
      })

      const confirm = Effect.fn("Cards.confirm")(function*(owner: Owner, id: string) {
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
          yield* memories.remove(owner, card.memory.id).pipe(Effect.catchTag("NotFound", () => Effect.void))
        }
        return yield* save(owner, { ...card, status: "dismissed" })
      })

      return Cards.of({ create, find, confirm, confirmMemory, dismiss })
    })
  )
}
