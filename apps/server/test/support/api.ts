// The API served in memory on the local fork, and the requests a browser makes to it.
import { ChainClient } from "@bluechip/chain/ChainClient"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { afterAll } from "@effect/vitest"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import * as Layer from "effect/Layer"
import { ApiRoutes } from "../../src/api/Api.ts"
import { AppConfig } from "../../src/Config.ts"
import { Database } from "../../src/db/Database.ts"
import { Withdrawals } from "../../src/funding/Withdrawals.ts"
import { OriginCheckMiddleware } from "../../src/http/OriginCheck.ts"
import { LiveEvents } from "../../src/live/LiveEvents.ts"
import { Charts } from "../../src/market/Charts.ts"
import { MarketPrices } from "../../src/market/MarketPrices.ts"
import { ReferencePrices } from "../../src/market/ReferencePrices.ts"
import { Namera } from "../../src/Namera.ts"
import { AccountBalances } from "../../src/portfolio/AccountBalances.ts"
import { Trades } from "../../src/trading/Trades.ts"
import { AlpacaTest } from "./alpaca.ts"
import { softwareAuthenticator } from "./authenticator.ts"

export const origin = "http://localhost:3000"

const config = ConfigProvider.layer(ConfigProvider.fromEnvRecord({
  // Tests' own database (created with the Postgres volume), so they never leave accounts in dev data.
  DATABASE_URL: "postgres://bluechip:bluechip@localhost:5432/bluechip_test",
  PUBLIC_ORIGIN: origin,
  RP_ID: "localhost"
}))

// Sign-up reads the chain (Namera checks for Base's P-256 precompile), so these tests run on the local fork.
const Services = Layer.mergeAll(Withdrawals.layer, Trades.layer, Charts.layer).pipe(
  Layer.provideMerge(Layer.mergeAll(AccountBalances.layer, MarketPrices.layer, ReferencePrices.layer, Namera.layer)),
  Layer.provideMerge(Layer.mergeAll(AlpacaTest, Database.layerMigrated, AppConfig.layer)),
  Layer.provideMerge(LiveEvents.layer),
  Layer.provideMerge(Layer.succeed(ChainClient, ChainClient.make("local", "http://localhost:8545"))),
  Layer.provide(config)
)

export const { dispose, handler } = HttpRouter.toWebHandler(
  Layer.mergeAll(ApiRoutes, OriginCheckMiddleware).pipe(
    Layer.provideMerge(Services),
    Layer.provide(HttpServer.layerServices)
  )
)
afterAll(() => dispose())

/** One request to the API as the web app sends it: JSON, the contract version, the browser's Origin and cookie. */
export const call = (
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; cookie?: string; origin?: string } = {}
) =>
  Effect.promise(async () => {
    const response = await handler(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
          [contractVersionHeader]: String(ContractVersion),
          origin: options.origin ?? origin,
          ...(options.cookie === undefined ? {} : { cookie: options.cookie })
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
      })
    )
    const session = /bluechip_session=([^;]*)/.exec(response.headers.get("set-cookie") ?? "")?.[1]
    const text = response.headers.get("content-type")?.includes("event-stream") ? "" : await response.text()
    return { status: response.status, json: text === "" ? undefined : JSON.parse(text), session, response }
  })

export const signUp = Effect.fnUntraced(function*(authenticator: ReturnType<typeof softwareAuthenticator>) {
  const ceremony = yield* call("POST", "/api/auth/register/options", { body: { displayName: "Ada" } })
  const credential = authenticator.register(ceremony.json.options.challenge)
  return yield* call("POST", "/api/auth/register/verify", {
    body: { challengeId: ceremony.json.challengeId, credential, displayName: "Ada" }
  })
})

export const signIn = Effect.fnUntraced(function*(authenticator: ReturnType<typeof softwareAuthenticator>) {
  const ceremony = yield* call("POST", "/api/auth/login/options")
  const body = {
    challengeId: ceremony.json.challengeId,
    credential: authenticator.authenticate(ceremony.json.options.challenge)
  }
  return { result: yield* call("POST", "/api/auth/login/verify", { body }), body }
})

/**
 * The user's live event stream. `next(match)` reads until an event matches; the stream is subscribed once its first
 * heartbeat has arrived, so actions taken after `open` returns are never missed.
 */
export const openEvents = Effect.fnUntraced(function*(cookie: string) {
  const { response } = yield* call("GET", "/api/events", { cookie })
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""
  const next = (match: (event: { readonly _tag: string } & Record<string, any>) => boolean) =>
    Effect.promise(async () => {
      for (;;) {
        const end = buffer.indexOf("\n\n")
        if (end === -1) {
          const chunk = await reader.read()
          if (chunk.done) throw new Error("the event stream ended")
          buffer += chunk.value
          continue
        }
        const message = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const data = message.split("\n").find((line) => line.startsWith("data:"))
        if (data === undefined) continue
        const event = JSON.parse(data.slice(5))
        if (match(event)) return event
      }
    })
  yield* next((event) => event._tag === "Heartbeat")
  return { next, close: Effect.promise(() => reader.cancel()) }
})

/** A new user with 1,000 test USDC (and gas), and their live events. */
export const fundedUser = Effect.fnUntraced(function*() {
  const authenticator = softwareAuthenticator({ rpId: "localhost", origin })
  const created = yield* signUp(authenticator)
  const cookie = `bluechip_session=${created.session}`
  const events = yield* openEvents(cookie)

  const funded = yield* call("POST", "/api/dev/fund", { cookie })
  if (funded.status !== 204) return yield* Effect.die(new Error(`dev fund answered ${funded.status}`))
  return { authenticator, cookie, events, address: created.json.account.address as `0x${string}` }
})
