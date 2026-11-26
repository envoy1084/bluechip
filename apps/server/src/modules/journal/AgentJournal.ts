import { importanceOf } from "@bluechip/domain/assistant/Recall"
import { NotFound } from "@bluechip/domain/Errors"
import { type AgentId, JournalEntryId, type UserId } from "@bluechip/domain/Ids"
import { JournalEntry, type JournalKind, type JournalRefs } from "@bluechip/domain/journal/Journal"
import { and, desc, eq, lt } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { agents } from "../agents/tables.ts"
import { RecallIndex } from "../memory/RecallIndex.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { agentJournal } from "./tables.ts"

/** An entry to write: whose agent, what kind, the words and what it points at. */
export interface JournalWrite {
  readonly userId: UserId
  readonly agentId: AgentId
  readonly kind: JournalKind
  readonly entry: string
  readonly refs: JournalRefs
}

/**
 * Each agent's journal, written by the services where things happen (intents as they move, automation runs as they
 * end, judgments as they are answered) and read by the assistant (`getAgentJournal`); every entry is also indexed for
 * recall, embedded in the background so a trade never waits for the embedder.
 */
export class AgentJournal extends Context.Service<AgentJournal, {
  readonly write: (entry: JournalWrite) => Effect.Effect<void>
  /** The agent's latest entries, newest first (20 unless `limit` says otherwise). */
  readonly read: (owner: Owner, agentId: AgentId, options?: {
    readonly limit?: number | undefined
  }) => Effect.Effect<ReadonlyArray<JournalEntry>, NotFound>
  /** A page of the agent's entries, newest first (25 unless `pageSize` says otherwise). */
  readonly page: (owner: Owner, agentId: AgentId, query: {
    readonly pageSize?: number | undefined
    readonly pageToken?: string | undefined
  }) => Effect.Effect<{ readonly items: ReadonlyArray<JournalEntry>; readonly nextPageToken: string | null }, NotFound>
}>()("@bluechip/server/AgentJournal") {
  static readonly layer = Layer.effect(
    AgentJournal,
    Effect.gen(function*() {
      const db = yield* Database
      const recallIndex = yield* RecallIndex

      const write = Effect.fn("AgentJournal.write")(function*(entry: JournalWrite) {
        const at = yield* DateTime.now
        const [row] = yield* db.insert(agentJournal).values({
          id: typeid("journal").toString() as `journal_${string}`,
          userId: entry.userId as `user_${string}`,
          agentId: entry.agentId as `agent_${string}`,
          at,
          kind: entry.kind,
          entry: entry.entry,
          refs: entry.refs
        }).returning().pipe(Effect.orDie)

        yield* recallIndex.index([{
          kind: "journal",
          sourceId: row!.id,
          userId: entry.userId,
          agentId: entry.agentId,
          conversationId: null,
          text: entry.entry,
          importance: importanceOf({ kind: "journal" }),
          at
        }], { background: true })
      })

      const entries = Effect.fnUntraced(function*(owner: Owner, agentId: AgentId, options: {
        readonly limit: number
        readonly before?: string | undefined
      }) {
        const [agent] = yield* db.select({ id: agents.id }).from(agents).where(and(
          eq(agents.id, agentId as `agent_${string}`),
          eq(agents.userId, owner.id as `user_${string}`)
        )).pipe(Effect.orDie)
        if (agent === undefined) return yield* new NotFound({ resource: "agent", id: agentId })

        const rows = yield* db.select().from(agentJournal).where(and(
          eq(agentJournal.agentId, agent.id),
          options.before === undefined ? undefined : lt(agentJournal.id, options.before as `journal_${string}`)
        )).orderBy(desc(agentJournal.id)).limit(options.limit).pipe(Effect.orDie)
        return rows.map((row) =>
          new JournalEntry({
            id: row.id as JournalEntryId,
            agentId,
            at: row.at,
            kind: row.kind,
            entry: row.entry,
            refs: row.refs
          })
        )
      })

      const read = Effect.fn("AgentJournal.read")(function*(owner: Owner, agentId: AgentId, options: {
        readonly limit?: number | undefined
      } = {}) {
        return yield* entries(owner, agentId, { limit: options.limit ?? 20 })
      })

      const page = Effect.fn("AgentJournal.page")(function*(owner: Owner, agentId: AgentId, query: {
        readonly pageSize?: number | undefined
        readonly pageToken?: string | undefined
      }) {
        const size = query.pageSize ?? 25
        const found = yield* entries(owner, agentId, {
          limit: size + 1,
          before: Schema.is(JournalEntryId)(query.pageToken) ? query.pageToken : undefined
        })
        const items = found.slice(0, size)
        return { items, nextPageToken: found.length > size ? items.at(-1)!.id as string : null }
      })

      return AgentJournal.of({ write, read, page })
    })
  )
}
