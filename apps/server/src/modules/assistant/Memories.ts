import { Memory, type MemoryCandidate, type MemoryKind, planMemoryWrite } from "@bluechip/domain/assistant/Memory"
import { NotFound } from "@bluechip/domain/Errors"
import { type AgentId, MemoryId, type MessageId } from "@bluechip/domain/Ids"
import { and, desc, eq, isNotNull } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { memories } from "./tables.ts"

type MemoryRow = typeof memories.$inferSelect

const toMemory = (row: MemoryRow) =>
  new Memory({
    id: row.id as MemoryId,
    agentId: row.agentId as AgentId | null,
    kind: row.kind,
    text: row.text,
    source: row.source,
    confidence: row.confidence,
    note: row.note,
    messageId: row.messageId as MessageId | null,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt
  })

/**
 * What the assistant remembers about each user. Confirmed memories go into its prompts; unconfirmed ones (inferences
 * it isn't sure of) wait for the user, and deleted ones are gone.
 */
export class Memories extends Context.Service<Memories, {
  /** Every memory, newest first, confirmed or not. */
  readonly list: (owner: Owner) => Effect.Effect<ReadonlyArray<Memory>>
  /** The memories a prompt may use, marked as used now. */
  readonly forPrompt: (owner: Owner) => Effect.Effect<ReadonlyArray<Memory>>
  /** What the user asked to be remembered: confirmed at once. */
  readonly remember: (owner: Owner, input: {
    readonly kind: MemoryKind
    readonly text: string
    readonly agentId: AgentId | null
    readonly messageId: MessageId | null
  }) => Effect.Effect<Memory>
  /** Writes what the small model proposed after a turn; returns the memory added or changed, if any. */
  readonly learn: (owner: Owner, candidate: MemoryCandidate, messageId: MessageId | null) => Effect.Effect<
    Memory | undefined
  >
  readonly confirm: (owner: Owner, id: string) => Effect.Effect<Memory, NotFound>
  /** Deletes a memory; returns it as it was. */
  readonly remove: (owner: Owner, id: string) => Effect.Effect<Memory, NotFound>
  readonly removeAll: (owner: Owner) => Effect.Effect<void>
}>()("@bluechip/server/Memories") {
  static readonly layer = Layer.effect(
    Memories,
    Effect.gen(function*() {
      const db = yield* Database

      const ofOwner = (owner: Owner) => eq(memories.userId, owner.id as `user_${string}`)
      const byId = (owner: Owner, id: string) => and(ofOwner(owner), eq(memories.id, id as `memory_${string}`))

      const list = Effect.fn("Memories.list")(function*(owner: Owner) {
        const rows = yield* db.select().from(memories).where(ofOwner(owner)).orderBy(desc(memories.id))
          .pipe(Effect.orDie)
        return rows.map(toMemory)
      })

      const forPrompt = Effect.fn("Memories.forPrompt")(function*(owner: Owner) {
        const rows = yield* db.update(memories).set({ lastUsedAt: yield* DateTime.now })
          .where(and(ofOwner(owner), isNotNull(memories.confirmedAt))).returning().pipe(Effect.orDie)
        return rows.map(toMemory).sort((a, b) => a.id.localeCompare(b.id))
      })

      const insert = Effect.fnUntraced(function*(owner: Owner, memory: {
        readonly agentId: AgentId | null
        readonly kind: MemoryKind
        readonly text: string
        readonly source: "said" | "inferred"
        readonly confidence: number
        readonly note: string | null
        readonly messageId: MessageId | null
        readonly confirmed: boolean
      }) {
        const now = yield* DateTime.now
        const [row] = yield* db.insert(memories).values({
          id: typeid("memory").toString() as `memory_${string}`,
          userId: owner.id as `user_${string}`,
          agentId: memory.agentId as `agent_${string}` | null,
          kind: memory.kind,
          text: memory.text,
          source: memory.source,
          confidence: memory.confidence,
          note: memory.note,
          messageId: memory.messageId as `message_${string}` | null,
          confirmedAt: memory.confirmed ? now : null,
          createdAt: now,
          lastUsedAt: null
        }).returning().pipe(Effect.orDie)
        return toMemory(row!)
      })

      const remember = Effect.fn("Memories.remember")(function*(owner: Owner, input: {
        readonly kind: MemoryKind
        readonly text: string
        readonly agentId: AgentId | null
        readonly messageId: MessageId | null
      }) {
        return yield* insert(owner, { ...input, source: "said", confidence: 1, note: null, confirmed: true })
      })

      const confirm = Effect.fn("Memories.confirm")(function*(owner: Owner, id: string) {
        const [row] = Schema.is(MemoryId)(id) ?
          yield* db.update(memories).set({ confirmedAt: yield* DateTime.now }).where(byId(owner, id)).returning()
            .pipe(Effect.orDie) :
          []
        if (row === undefined) return yield* new NotFound({ resource: "memory", id })
        return toMemory(row)
      })

      const remove = Effect.fn("Memories.remove")(function*(owner: Owner, id: string) {
        const [row] = Schema.is(MemoryId)(id) ?
          yield* db.delete(memories).where(byId(owner, id)).returning().pipe(Effect.orDie) :
          []
        if (row === undefined) return yield* new NotFound({ resource: "memory", id })
        return toMemory(row)
      })

      const learn = Effect.fn("Memories.learn")(function*(
        owner: Owner,
        candidate: MemoryCandidate,
        messageId: MessageId | null
      ) {
        const existing = yield* list(owner)
        const write = planMemoryWrite(existing, candidate)
        const fields = { ...candidate, text: candidate.text.trim(), agentId: null, messageId }

        switch (write._tag) {
          case "Skip":
            return undefined
          case "Add":
            return yield* insert(owner, { ...fields, note: null, confirmed: write.confirmed })
          case "Refresh":
            return yield* Effect.orDie(confirm(owner, write.memoryId))
          case "Replace": {
            yield* Effect.orDie(remove(owner, write.memoryId))
            return yield* insert(owner, { ...fields, note: write.note, confirmed: write.confirmed })
          }
        }
      })

      return Memories.of({
        list,
        forPrompt,
        remember,
        learn,
        confirm,
        remove,
        removeAll: Effect.fn("Memories.removeAll")(function*(owner: Owner) {
          yield* db.delete(memories).where(ofOwner(owner)).pipe(Effect.orDie)
        })
      })
    })
  )
}
