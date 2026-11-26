import type { TriggerData } from "@bluechip/domain/automations/Run"
import { matchesNews, subscriptionOf } from "@bluechip/domain/automations/triggers/News"
import type { UserId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import * as Singleton from "effect/cluster/Singleton"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import { Alpaca, type AlpacaError } from "../../market/alpaca/Alpaca.ts"
import type { ShareNews } from "../../market/alpaca/NewsFrames.ts"
import { Automations } from "../Automations.ts"
import { FireAutomation } from "../FireAutomation.ts"
import { NewsItems, type Story } from "../NewsItems.ts"

const toStory = (story: ShareNews): Story => ({
  source: "alpaca",
  sourceId: story.id,
  symbols: story.symbols,
  headline: story.headline,
  summary: story.summary,
  url: story.url,
  publishedAt: DateTime.makeUnsafe(story.publishedAt)
})

// A dropped stream connects again after a second, then up to a minute apart.
const reconnect = Schedule.min([Schedule.exponential("1 second"), Schedule.spaced("1 minute")])

/**
 * The watcher of `news` automations: stories from Alpaca's news stream (subscribed to the stocks automations watch,
 * or to all news when one watches a topic) are stored once each, and every new story about an automation's stocks or
 * topics starts a fire, the story being its window. When the stream refuses the account, it reads the news endpoint
 * every minute instead.
 */
export class NewsWatcher extends Context.Service<NewsWatcher, {
  /** Stories from a source: the new ones are stored and fire the automations they match (everyone's, or one user's). */
  readonly receive: (
    stories: ReadonlyArray<Story>,
    options?: { readonly userId?: UserId | undefined }
  ) => Effect.Effect<void>
  /** Reads the news published since the newest story stored (the last hour at first), from the news endpoint. */
  readonly poll: Effect.Effect<void, AlpacaError>
  /** What the stream subscribes to: the stocks news automations watch, `*` when one watches a topic; none for none. */
  readonly subscription: Effect.Effect<ReadonlyArray<string>>
}>()("@bluechip/server/NewsWatcher") {
  static readonly layer = Layer.effect(
    NewsWatcher,
    Effect.gen(function*() {
      const automations = yield* Automations
      const news = yield* NewsItems
      const alpaca = yield* Alpaca
      const engine = yield* WorkflowEngine.WorkflowEngine

      const receive = Effect.fn("NewsWatcher.receive")(function*(
        stories: ReadonlyArray<Story>,
        options: { readonly userId?: UserId | undefined } = {}
      ) {
        const added = yield* news.ingest(stories)
        if (added.length === 0) return

        const watching = yield* automations.watched("news", options.userId)
        for (const item of added) {
          for (const row of watching) {
            if (row.trigger.type !== "news" || !matchesNews(row.trigger.config, item)) continue
            const watched: ReadonlyArray<string> = row.trigger.config.symbols
            const trigger: TriggerData = {
              summary: `A story: “${item.headline}”`,
              symbol: (item.symbols.find((symbol) => watched.includes(symbol)) ?? null) as StockSymbol | null,
              price: null,
              newsItemId: item.id
            }
            yield* FireAutomation.execute({ automationId: row.id, windowKey: `news:${item.id}`, trigger }, {
              discard: true
            }).pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine))
          }
        }
      })

      const poll = Effect.gen(function*() {
        const start = (yield* news.latest) ?? DateTime.subtract(yield* DateTime.now, { hours: 1 })
        const stories = yield* alpaca.news({ start: DateTime.toDateUtc(start) })
        yield* receive(stories.map(toStory))
      }).pipe(Effect.withSpan("NewsWatcher.poll"))

      const subscription = Effect.map(
        automations.watched("news"),
        (rows) => subscriptionOf(rows.flatMap((row) => row.trigger.type === "news" ? [row.trigger.config] : []))
      )

      return NewsWatcher.of({ receive, poll, subscription })
    })
  )

  /**
   * On one runner of the cluster: the news stream, connected again with backoff when it drops and subscribed again
   * when the stocks watched change (checked every minute); no connection while nothing watches the news. If the
   * stream refuses the account, the news endpoint every minute instead.
   */
  static readonly watch = Singleton.make(
    "automations.news",
    Effect.gen(function*() {
      const watcher = yield* NewsWatcher
      const alpaca = yield* Alpaca

      const changed = (symbols: ReadonlyArray<string>) =>
        watcher.subscription.pipe(
          Effect.delay("1 minute"),
          Effect.repeat({ until: (next) => next.join(",") !== symbols.join(",") }),
          Effect.asVoid
        )

      const follow = Effect.gen(function*() {
        const symbols = yield* watcher.subscription
        if (symbols.length === 0) return yield* changed(symbols)
        yield* alpaca.newsStream(symbols).pipe(
          Stream.runForEach((story) =>
            watcher.receive([toStory(story)]).pipe(
              Effect.catchCause((cause) => Effect.logWarning("News watcher failed on a story", cause))
            )
          ),
          Effect.raceFirst(changed(symbols))
        )
      })

      yield* follow.pipe(
        Effect.tapError((error) => Effect.logWarning("Alpaca news stream dropped", error)),
        Effect.retry({ while: (error) => error._tag === "AlpacaError", schedule: reconnect }),
        Effect.forever,
        Effect.catchTag("NewsStreamRefused", (refused) =>
          Effect.logWarning(
            `Alpaca refused the news stream (${refused.code} ${refused.message}); reading the news endpoint instead`
          ).pipe(
            Effect.andThen(
              watcher.poll.pipe(
                Effect.catchCause((cause) => Effect.logWarning("News endpoint failed", cause)),
                Effect.repeat(Schedule.spaced("1 minute"))
              )
            )
          ))
      )
    })
  )
}
