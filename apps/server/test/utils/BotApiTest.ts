// Telegram's Bot API at the edge, in process: records each call (its method and parameters, never the token) and
// answers as Telegram does. `getUpdates` hands out the updates a test sends, waiting for the next one like Telegram's
// long poll; a message the bot sends can be awaited with `sent`.
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"

/** A call as Telegram received it. */
export interface BotApiCall {
  readonly method: string
  readonly params: Readonly<Record<string, unknown>>
}

/** A test bot's token: its id is 4242. */
export const BOT_TOKEN = "4242:test-token"

export class BotApiTest extends Context.Service<BotApiTest, {
  /** Hands `update` to the bot's next `getUpdates`. */
  readonly update: (update: object) => Effect.Effect<void>
  /** Waits for the bot's next `sendRichMessage`. */
  readonly sent: Effect.Effect<BotApiCall>
  /** Every call so far, oldest first. */
  readonly calls: Effect.Effect<ReadonlyArray<BotApiCall>>
}>()("@bluechip/server/test/BotApiTest") {
  /** The recordings and the `HttpClient` the Telegram adapter calls the Bot API with. */
  static readonly layer = Layer.unwrap(Effect.gen(function*() {
    const calls: Array<BotApiCall> = []
    const updates = yield* Queue.unbounded<object>()
    const sent = yield* Queue.unbounded<BotApiCall>()
    let nextMessage = 100

    const ok = (result: unknown) => ({ ok: true, result })

    const answer = (call: BotApiCall): Effect.Effect<unknown> => {
      switch (call.method) {
        case "getMe":
          return Effect.succeed(ok({ id: 4242, is_bot: true, first_name: "bluechip", username: "bluechip_test_bot" }))
        case "getUpdates":
          // The first call at start doesn't wait; the long polls after it wait for the test's next update.
          return call.params["timeout"] === 0 ?
            Effect.succeed(ok([])) :
            Effect.map(Queue.take(updates), (update) => ok([update]))
        case "getChat":
          return Effect.succeed(ok({ id: Number(call.params["chat_id"]), type: "private", first_name: "Sam" }))
        case "sendRichMessage":
          return Effect.as(
            Queue.offer(sent, call),
            ok({
              message_id: nextMessage++,
              date: 1_800_000_000,
              chat: { id: call.params["chat_id"], type: "private" }
            })
          )
        default:
          return Effect.succeed(ok(true))
      }
    }

    const client = HttpClient.make((request, url) =>
      Effect.gen(function*() {
        const method = url.pathname.split("/").at(-1)!
        const body = (request.body as { readonly body?: Uint8Array }).body
        const call = {
          method,
          params: body === undefined ? {} : JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>
        }
        calls.push(call)
        return HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify(yield* answer(call)), { headers: { "content-type": "application/json" } })
        )
      })
    )

    return Layer.merge(
      Layer.succeed(BotApiTest, {
        update: (update) => Queue.offer(updates, update).pipe(Effect.asVoid),
        sent: Queue.take(sent),
        calls: Effect.sync(() => [...calls])
      }),
      Layer.succeed(HttpClient.HttpClient, client)
    )
  }))
}
