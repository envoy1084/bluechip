import * as Cause from "effect/Cause"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { readNewsFrame, type ShareNews } from "./NewsFrames.ts"

export class AlpacaError extends Data.TaggedError("AlpacaError")<{
  readonly operation: string
  readonly cause: unknown
}> {}

/** The news stream refused this account: bad keys, its one connection taken, or news not in its plan. */
export class NewsStreamRefused extends Data.TaggedError("NewsStreamRefused")<{
  readonly code: number
  readonly message: string
}> {}

/** A stock's latest trade and the previous session's close, in dollars per share. */
interface ShareSnapshot {
  readonly price: number
  readonly tradedAt: string
  readonly previousClose: number | null
}

interface ShareBar {
  readonly at: string
  readonly close: number
}

interface ShareTrade {
  readonly symbol: string
  readonly price: number
  readonly tradedAt: string
}

/** Alpaca's bar sizes, as its API spells them. */
export type BarTimeframe = "5Min" | "30Min" | "1Hour" | "1Day"

const Snapshots = Schema.Record(
  Schema.String,
  Schema.Struct({
    latestTrade: Schema.NullishOr(Schema.Struct({ p: Schema.Number, t: Schema.String })),
    prevDailyBar: Schema.NullishOr(Schema.Struct({ c: Schema.Number }))
  })
)

const Bars = Schema.Struct({
  bars: Schema.NullishOr(Schema.Array(Schema.Struct({ t: Schema.String, c: Schema.Number }))),
  next_page_token: Schema.NullishOr(Schema.String)
})

const News = Schema.Struct({
  news: Schema.Array(Schema.Struct({
    id: Schema.Number,
    headline: Schema.String,
    summary: Schema.String,
    url: Schema.NullishOr(Schema.String),
    symbols: Schema.Array(Schema.String),
    created_at: Schema.String
  })),
  next_page_token: Schema.NullishOr(Schema.String)
})

// Stream messages arrive as arrays; only trades (`t`) and errors matter here.
const StreamMessage = Schema.Union([
  Schema.Struct({ T: Schema.Literal("t"), S: Schema.String, p: Schema.Number, t: Schema.String }),
  Schema.Struct({ T: Schema.Literal("error"), code: Schema.Number, msg: Schema.String }),
  Schema.Struct({ T: Schema.String })
])
const decodeMessages = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(StreamMessage)))

/**
 * Alpaca's market data, for prices only (bluechip never trades through Alpaca): the latest trade and previous close
 * of many stocks in one request, price bars for charts, and a live stream of trades. Only the server holds the keys;
 * the free plan allows one stream connection per account, so local and production use separate keys.
 */
export class Alpaca extends Context.Service<Alpaca, {
  readonly snapshots: (symbols: ReadonlyArray<string>) => Effect.Effect<ReadonlyMap<string, ShareSnapshot>, AlpacaError>
  readonly bars: (
    symbol: string,
    options: { readonly timeframe: BarTimeframe; readonly start: Date }
  ) => Effect.Effect<ReadonlyArray<ShareBar>, AlpacaError>
  /**
   * News published since `start`, oldest first, from the REST news endpoint: the fallback when the news stream
   * refuses the account.
   */
  readonly news: (options: { readonly start: Date }) => Effect.Effect<ReadonlyArray<ShareNews>, AlpacaError>
  /**
   * News about `symbols` (`*`: all) as it is published, on its own connection (the price and news streams run
   * together on one free account). Fails with `NewsStreamRefused` when the account can't have it, otherwise with `AlpacaError` when
   * the connection drops, so callers reconnect.
   */
  readonly newsStream: (
    symbols: ReadonlyArray<string>
  ) => Stream.Stream<ShareNews, AlpacaError | NewsStreamRefused>
  /** Trades as they happen; fails when the connection drops, so callers retry. */
  readonly trades: (symbols: ReadonlyArray<string>) => Stream.Stream<ShareTrade, AlpacaError>
}>()("@bluechip/server/market/Alpaca") {
  static readonly layer = Layer.effect(
    Alpaca,
    Effect.gen(function*() {
      const keyId = yield* Config.String("ALPACA_API_KEY_ID")
      const secret = yield* Config.Redacted("ALPACA_API_SECRET_KEY")
      const feed = yield* Config.Literals(["iex", "sip"], "ALPACA_FEED").pipe(Config.withDefault("iex"))

      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest((request) =>
          request.pipe(
            HttpClientRequest.prependUrl("https://data.alpaca.markets"),
            HttpClientRequest.setHeaders({ "APCA-API-KEY-ID": keyId, "APCA-API-SECRET-KEY": Redacted.value(secret) })
          )
        ),
        HttpClient.filterStatusOk
      )

      const getJson = <A>(operation: string, path: string, params: Record<string, string>, schema: Schema.Codec<A>) =>
        client.get(path, { urlParams: params }).pipe(
          Effect.flatMap((response) => response.json),
          Effect.flatMap(Schema.decodeUnknownEffect(schema)),
          Effect.mapError((cause) => new AlpacaError({ operation, cause }))
        )

      const snapshots = Effect.fn("Alpaca.snapshots")(function*(symbols: ReadonlyArray<string>) {
        const body = yield* getJson(
          "snapshots",
          "/v2/stocks/snapshots",
          { symbols: symbols.join(","), feed },
          Snapshots
        )

        return new Map(
          Object.entries(body).flatMap(([symbol, snapshot]): Array<[string, ShareSnapshot]> =>
            snapshot.latestTrade == null ? [] : [[symbol, {
              price: snapshot.latestTrade.p,
              tradedAt: snapshot.latestTrade.t,
              previousClose: snapshot.prevDailyBar?.c ?? null
            }]]
          )
        )
      })

      const bars = Effect.fn("Alpaca.bars")(function*(
        symbol: string,
        options: { readonly timeframe: BarTimeframe; readonly start: Date }
      ) {
        const found: Array<ShareBar> = []
        let pageToken: string | undefined

        do {
          const page = yield* getJson("bars", `/v2/stocks/${symbol}/bars`, {
            feed,
            timeframe: options.timeframe,
            start: options.start.toISOString(),
            // Split- and dividend-adjusted, so history lines up with today's shares (and the token's multiplier).
            adjustment: "all",
            limit: "10000",
            ...(pageToken === undefined ? {} : { page_token: pageToken })
          }, Bars)
          found.push(...(page.bars ?? []).map((bar) => ({ at: bar.t, close: bar.c })))
          pageToken = page.next_page_token ?? undefined
        } while (pageToken !== undefined)

        return found
      })

      const news = Effect.fn("Alpaca.news")(function*(options: { readonly start: Date }) {
        const found: Array<ShareNews> = []
        let pageToken: string | undefined

        do {
          const page = yield* getJson("news", "/v1beta1/news", {
            start: options.start.toISOString(),
            sort: "asc",
            limit: "50",
            ...(pageToken === undefined ? {} : { page_token: pageToken })
          }, News)
          found.push(...page.news.map((story) => ({
            id: String(story.id),
            headline: story.headline,
            summary: story.summary,
            url: story.url ?? null,
            symbols: story.symbols,
            publishedAt: story.created_at
          })))
          pageToken = page.next_page_token ?? undefined
        } while (pageToken !== undefined)

        return found
      })

      const trades = (symbols: ReadonlyArray<string>) =>
        Stream.callback<ShareTrade, AlpacaError>((queue) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              const socket = new WebSocket(`wss://stream.data.alpaca.markets/v2/${feed}`)
              const fail = (cause: unknown) => Queue.failCauseUnsafe(queue, alpacaFailure(cause))

              socket.addEventListener("open", () => {
                socket.send(JSON.stringify({ action: "auth", key: keyId, secret: Redacted.value(secret) }))
                socket.send(JSON.stringify({ action: "subscribe", trades: symbols }))
              })
              socket.addEventListener("message", (event) => {
                let messages: ReturnType<typeof decodeMessages>
                try {
                  messages = decodeMessages(String(event.data))
                } catch (cause) {
                  return fail(cause)
                }

                for (const message of messages) {
                  if (message.T === "t" && "S" in message) {
                    Queue.offerUnsafe(queue, { symbol: message.S, price: message.p, tradedAt: message.t })
                  } else if (message.T === "error" && "msg" in message) {
                    fail(`${message.code} ${message.msg}`)
                  }
                }
              })
              socket.addEventListener("error", () => fail("connection error"))
              socket.addEventListener("close", (event) => fail(`closed (${event.code})`))
              return socket
            }),
            (socket) => Effect.sync(() => socket.close())
          )
        )

      const newsStream = (symbols: ReadonlyArray<string>) =>
        Stream.callback<ShareNews, AlpacaError | NewsStreamRefused>((queue) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              const socket = new WebSocket("wss://stream.data.alpaca.markets/v1beta1/news")
              const fail = (cause: unknown) =>
                Queue.failCauseUnsafe(queue, Cause.fail(new AlpacaError({ operation: "news", cause })))

              socket.addEventListener("open", () => {
                socket.send(JSON.stringify({
                  action: "auth",
                  key: keyId,
                  secret: Redacted.value(secret)
                }))
                socket.send(JSON.stringify({ action: "subscribe", news: symbols }))
              })
              socket.addEventListener("message", (event) => {
                let frames: ReturnType<typeof readNewsFrame>
                try {
                  frames = readNewsFrame(String(event.data))
                } catch (cause) {
                  return fail(cause)
                }
                for (const frame of frames) {
                  if (frame._tag === "Story") Queue.offerUnsafe(queue, frame.story)
                  else if (frame._tag === "Refused") {
                    Queue.failCauseUnsafe(
                      queue,
                      Cause.fail(new NewsStreamRefused({ code: frame.code, message: frame.message }))
                    )
                  } else fail(`${frame.code} ${frame.message}`)
                }
              })
              socket.addEventListener("error", () => fail("connection error"))
              socket.addEventListener("close", (event) => fail(`closed (${event.code})`))
              return socket
            }),
            (socket) => Effect.sync(() => socket.close())
          )
        )

      return { snapshots, bars, news, newsStream, trades }
    })
  ).pipe(Layer.provide(FetchHttpClient.layer))
}

const alpacaFailure = (cause: unknown) => Cause.fail(new AlpacaError({ operation: "trades", cause }))
