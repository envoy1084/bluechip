import { NewsItem } from "@bluechip/domain/automations/Run"
import type { NewsItemId } from "@bluechip/domain/Ids"
import { desc, eq } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { newsItems } from "./tables.ts"

/** A story as a source reports it, before it is stored. */
export interface Story {
  readonly source: string
  readonly sourceId: string
  readonly symbols: ReadonlyArray<string>
  readonly headline: string
  readonly summary: string
  readonly url: string | null
  readonly publishedAt: DateTime.Utc
}

const toNewsItem = (row: typeof newsItems.$inferSelect): NewsItem =>
  new NewsItem({
    id: row.id as NewsItemId,
    source: row.source,
    symbols: row.symbols,
    headline: row.headline,
    summary: row.summary,
    url: row.url,
    publishedAt: row.publishedAt
  })

/** The news stories bluechip read: each stored once per source and id, and read back for judgments. */
export class NewsItems extends Context.Service<NewsItems, {
  /** Stores the stories not seen before and returns those, in the order given. */
  readonly ingest: (stories: ReadonlyArray<Story>) => Effect.Effect<ReadonlyArray<NewsItem>>
  readonly get: (id: string) => Effect.Effect<NewsItem | undefined>
  /** When the newest story stored was published, to read on from there. */
  readonly latest: Effect.Effect<DateTime.Utc | undefined>
}>()("@bluechip/server/NewsItems") {
  static readonly layer = Layer.effect(
    NewsItems,
    Effect.gen(function*() {
      const db = yield* Database

      const ingest = Effect.fn("NewsItems.ingest")(function*(stories: ReadonlyArray<Story>) {
        const now = yield* DateTime.now
        const added: Array<NewsItem> = []
        for (const story of stories) {
          const [row] = yield* db.insert(newsItems).values({
            id: typeid("news").toString() as `news_${string}`,
            source: story.source,
            sourceId: story.sourceId,
            symbols: [...story.symbols],
            headline: story.headline,
            summary: story.summary,
            url: story.url,
            publishedAt: story.publishedAt,
            receivedAt: now
          }).onConflictDoNothing().returning().pipe(Effect.orDie)
          if (row !== undefined) added.push(toNewsItem(row))
        }
        return added
      })

      const get = Effect.fn("NewsItems.get")(function*(id: string) {
        const [row] = yield* db.select().from(newsItems).where(eq(newsItems.id, id as `news_${string}`))
          .pipe(Effect.orDie)
        return row === undefined ? undefined : toNewsItem(row)
      })

      const latest = db.select({ at: newsItems.publishedAt }).from(newsItems).orderBy(desc(newsItems.publishedAt))
        .limit(1).pipe(Effect.orDie, Effect.map(([row]) => row?.at))

      return NewsItems.of({ ingest, get, latest })
    })
  )
}
