// People using the API in tests, each with a browser of their own: a typed client, its cookie jar and a passkey.
import { BluechipApi } from "@bluechip/domain/Api"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import type { Address, UserId } from "@bluechip/domain/Ids"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpApiClient from "effect/http-api/HttpApiClient"
import type * as Cookies from "effect/http/Cookies"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import type * as Scope from "effect/Scope"
import * as Authenticator from "./Authenticator.ts"
import { origin } from "./TestConfig.ts"
import * as TestEvents from "./TestEvents.ts"
import { TestServer } from "./TestServer.ts"

/** The typed client of `BluechipApi`. */
export type Api = HttpApiClient.ForApi<typeof BluechipApi>

/** A browser on bluechip's web app: the typed client, sending the contract version and Origin, and its cookies. */
export interface Browser {
  readonly api: Api
  /** The browser's cookie jar: the session cookie lands here when the user signs in. */
  readonly cookies: Ref.Ref<ReadonlyArray<Cookies.Cookie>>
}

/** A signed-up user in their own browser, with their id, their passkey, their account's address and their live events. */
export interface TestUser extends Browser {
  readonly id: UserId
  readonly authenticator: Authenticator.Authenticator
  /** The account's address, as the API and the chain's controls both take it. */
  readonly account: Address & `0x${string}`
  readonly events: TestEvents.TestEvents
}

export class TestUsers extends Context.Service<TestUsers, {
  /** A new browser, signed out. */
  readonly browser: Effect.Effect<Browser>
  /** A new browser that names itself with `userAgent`, signed out. */
  readonly browserOn: (userAgent: string) => Effect.Effect<Browser>
  /** A new user: a new passkey signed up in a new browser, with their live events open for the scope. No money. */
  readonly signUp: Effect.Effect<TestUser, never, Scope.Scope>
  /** A new user with 1,000 test USDC and ETH for gas (`POST /api/dev/fund`). */
  readonly funded: Effect.Effect<TestUser, never, Scope.Scope>
}>()("@bluechip/server/test/TestUsers") {
  static readonly layerNoDeps = Layer.effect(
    TestUsers,
    Effect.gen(function*() {
      const httpClient = yield* HttpClient.HttpClient

      const browserOn = Effect.fnUntraced(function*(userAgent: string | undefined) {
        const cookies = yield* Ref.make<ReadonlyArray<Cookies.Cookie>>([])
        const api = yield* HttpApiClient.make(BluechipApi, {
          transformClient: (client) =>
            client.pipe(
              HttpClient.mapRequest((request) =>
                request.pipe(
                  HttpClientRequest.setHeader(contractVersionHeader, String(ContractVersion)),
                  HttpClientRequest.setHeader("origin", origin),
                  userAgent === undefined ? (same) => same : HttpClientRequest.setHeader("user-agent", userAgent)
                )
              ),
              HttpClient.withCookiesRef(cookies)
            )
        }).pipe(Effect.provideService(HttpClient.HttpClient, httpClient))
        return { api, cookies }
      })
      const browser = browserOn(undefined)

      const signUp = Effect.gen(function*() {
        const { api, cookies } = yield* browser
        const authenticator = Authenticator.make({ rpId: "localhost", origin })

        const ceremony = yield* api.auth.registerOptions({ payload: { displayName: "Ada" } })
        const me = yield* api.auth.registerVerify({
          payload: {
            challengeId: ceremony.challengeId,
            credential: authenticator.register(ceremony.options),
            displayName: "Ada"
          }
        })
        const events = yield* TestEvents.open(api.events.watch())

        return {
          api,
          cookies,
          id: me.user.id,
          authenticator,
          account: me.account.address as Address & `0x${string}`,
          events
        }
      }).pipe(Effect.orDie)

      const funded = Effect.tap(signUp, (user) => Effect.orDie(user.api.dev.fund()))

      return { browser, browserOn, signUp, funded }
    })
  )

  /** The users of the test server, which this layer also serves. */
  static readonly layer = this.layerNoDeps.pipe(Layer.provideMerge(TestServer))
}
