import { stocks } from "@bluechip/chain/Contracts"
import { fuseRanks } from "@bluechip/domain/assistant/Recall"
import type { Address, DocumentId } from "@bluechip/domain/Ids"
import {
  anchorOf,
  Citation,
  describeStockFacts,
  type DocumentKind,
  parseArticle,
  Passage,
  StockFacts
} from "@bluechip/domain/knowledge/Knowledge"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import { and, cosineDistance, desc, eq, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import { createHash } from "node:crypto"
import * as Path from "node:path"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { fullTextQuery } from "../../platform/db/FullText.ts"
import { Embeddings } from "../../platform/embeddings/Embeddings.ts"
import { chunks, documents } from "./tables.ts"

/** The help center's articles, one Markdown file each (`content/help/` at the repository's root). */
export const HELP_FOLDER = Path.join(import.meta.dirname, "../../../../../content/help")

interface Source {
  readonly kind: DocumentKind
  readonly slug: string
  readonly title: string
  readonly url: string
  readonly chunks: ReadonlyArray<{ readonly section: string | null; readonly text: string }>
}

// How many each search (words, meaning) brings before they are fused.
const CANDIDATES = 16

const factsOf = (stock: (typeof stocks)[number]) =>
  new StockFacts({
    symbol: stock.symbol as StockSymbol,
    name: stock.name,
    token: stock.token as Address,
    feed: stock.feed as Address,
    pool: stock.pool === null ? null : { address: stock.pool.address as Address, tickSpacing: stock.pool.tickSpacing },
    facts: describeStockFacts(stock),
    url: `https://basescan.org/token/${stock.token}`
  })

/**
 * bluechip's knowledge: the help articles and every stock's facts, as documents chunked by section and embedded.
 * `refresh` brings them in line with their sources (at start and every day); `search` finds passages by words and
 * meaning, each with its citation.
 */
export class Knowledge extends Context.Service<Knowledge, {
  /** Writes what changed in the sources and embeds what isn't yet; returns how many documents changed. */
  readonly refresh: Effect.Effect<number>
  readonly search: (text: string, options?: {
    readonly kinds?: ReadonlyArray<DocumentKind> | undefined
    readonly limit?: number | undefined
  }) => Effect.Effect<ReadonlyArray<Passage>>
  /** A stock's facts, from the stock list; `undefined` for one bluechip doesn't list. */
  readonly stockFacts: (symbol: StockSymbol) => StockFacts | undefined
}>()("@bluechip/server/Knowledge") {
  static readonly layer = Layer.effect(
    Knowledge,
    Effect.gen(function*() {
      const db = yield* Database
      const embeddings = yield* Embeddings
      const fs = yield* FileSystem.FileSystem

      const sources = Effect.gen(function*() {
        const files = (yield* fs.readDirectory(HELP_FOLDER)).filter((file) => file.endsWith(".md")).sort()
        const articles = yield* Effect.forEach(
          files,
          (file) =>
            Effect.map(fs.readFileString(Path.join(HELP_FOLDER, file)), (markdown): Source => {
              const slug = file.slice(0, -3)
              const article = parseArticle(markdown)
              return {
                kind: "help",
                slug,
                title: article.title,
                url: `/help/${slug}`,
                chunks: article.sections.map((section) => ({
                  section: section.heading,
                  text: `${article.title}${section.heading === null ? "" : `: ${section.heading}`}\n\n${section.text}`
                }))
              }
            })
        )
        const facts = stocks.map((stock): Source => {
          const stockFacts = factsOf(stock)
          return {
            kind: "stock",
            slug: `stock-${stock.symbol.toLowerCase()}`,
            title: `${stock.name} (${stock.symbol})`,
            url: stockFacts.url,
            chunks: [{ section: null, text: stockFacts.facts }]
          }
        })
        return [...articles, ...facts]
      }).pipe(Effect.orDie)

      const embedPending = Effect.gen(function*() {
        const pending = yield* db.select({ id: chunks.id, text: chunks.text }).from(chunks)
          .where(or(isNull(chunks.model), ne(chunks.model, embeddings.model))).pipe(Effect.orDie)
        if (pending.length === 0) return
        const vectors = yield* embeddings.documents(pending.map((chunk) => chunk.text))
        yield* Effect.forEach(
          pending,
          (chunk, index) =>
            db.update(chunks).set({ embedding: [...vectors[index]!], model: embeddings.model })
              .where(eq(chunks.id, chunk.id)),
          { concurrency: 8, discard: true }
        ).pipe(Effect.orDie)
      }).pipe(
        Effect.catchTag("AiError", (error) => Effect.logWarning("Embedding knowledge failed", error))
      )

      const refresh = Effect.gen(function*() {
        const wanted = yield* sources
        const now = yield* DateTime.now

        // One refresh writes at a time (each server instance and test worker refreshes when it starts).
        const changed = yield* db.transaction((tx) =>
          Effect.gen(function*() {
            yield* tx.execute(sql`select pg_advisory_xact_lock(hashtext('knowledge.refresh'))`)
            const existing = new Map(
              (yield* tx.select({ slug: documents.slug, hash: documents.hash }).from(documents))
                .map((row) => [row.slug, row.hash])
            )

            let written = 0
            for (const source of wanted) {
              const hash = createHash("sha256").update(JSON.stringify(source)).digest("hex")
              if (existing.get(source.slug) === hash) continue

              const [document] = yield* tx.insert(documents).values({
                id: typeid("document").toString() as `document_${string}`,
                kind: source.kind,
                slug: source.slug,
                title: source.title,
                url: source.url,
                hash,
                updatedAt: now
              }).onConflictDoUpdate({
                target: documents.slug,
                set: { kind: source.kind, title: source.title, url: source.url, hash, updatedAt: now }
              }).returning({ id: documents.id })
              yield* tx.delete(chunks).where(eq(chunks.documentId, document!.id))
              if (source.chunks.length > 0) {
                yield* tx.insert(chunks).values(source.chunks.map((chunk, position) => ({
                  id: typeid("chunk").toString() as `chunk_${string}`,
                  documentId: document!.id,
                  position,
                  section: chunk.section,
                  text: chunk.text,
                  model: null,
                  embedding: null
                })))
              }
              written++
            }
            yield* tx.delete(documents).where(notInArray(documents.slug, wanted.map((source) => source.slug)))
            return written
          })
        ).pipe(Effect.orDie)

        yield* embedPending
        return changed
      }).pipe(Effect.withSpan("Knowledge.refresh"))

      const columns = {
        id: chunks.id,
        section: chunks.section,
        text: chunks.text,
        documentId: documents.id,
        kind: documents.kind,
        title: documents.title,
        url: documents.url
      }

      const search = Effect.fn("Knowledge.search")(function*(text: string, options: {
        readonly kinds?: ReadonlyArray<DocumentKind> | undefined
        readonly limit?: number | undefined
      } = {}) {
        const query = fullTextQuery(chunks.textSearch, text)
        if (query === undefined) return []
        const ofKinds = options.kinds === undefined ? undefined : inArray(documents.kind, [...options.kinds])

        const byWords = db.select(columns).from(chunks).innerJoin(documents, eq(documents.id, chunks.documentId))
          .where(and(ofKinds, query.matches)).orderBy(desc(query.rank)).limit(CANDIDATES).pipe(Effect.orDie)
        const byMeaning = Effect.flatMap(embeddings.query(text), (vector) => {
          const distance = cosineDistance(chunks.embedding, [...vector])
          return db.select(columns).from(chunks).innerJoin(documents, eq(documents.id, chunks.documentId))
            .where(and(ofKinds, eq(chunks.model, embeddings.model), sql`${distance} <= ${1 - embeddings.relevance}`))
            .orderBy(distance).limit(CANDIDATES).pipe(Effect.orDie)
        }).pipe(
          Effect.catchTag(
            "AiError",
            (error) => Effect.as(Effect.logWarning("Embedding a help search failed", error), [])
          )
        )
        const [found, meant] = yield* Effect.all([byWords, byMeaning], { concurrency: 2 })

        const rows = new Map([...found, ...meant].map((row) => [row.id as string, row]))
        const fused = fuseRanks([found.map((row) => row.id), meant.map((row) => row.id)])
        return [...rows.values()].sort((a, b) => (fused.get(b.id) ?? 0) - (fused.get(a.id) ?? 0))
          .slice(0, options.limit ?? 5).map((row) =>
            new Passage({
              citation: new Citation({
                documentId: row.documentId as DocumentId,
                kind: row.kind,
                title: row.title,
                section: row.section,
                url: row.kind === "help" && row.section !== null ? `${row.url}#${anchorOf(row.section)}` : row.url
              }),
              text: row.text
            })
          )
      })

      return Knowledge.of({
        refresh,
        search,
        stockFacts: (symbol) => {
          const stock = stocks.find((candidate) => candidate.symbol === symbol)
          return stock === undefined ? undefined : factsOf(stock)
        }
      })
    })
  ).pipe(Layer.provide(NodeFileSystem.layer))

  /** Refreshes the knowledge once the server starts, in the background. */
  static readonly refreshOnStart = Layer.effectDiscard(
    Effect.forkScoped(Knowledge.use((knowledge) => knowledge.refresh))
  )
}
