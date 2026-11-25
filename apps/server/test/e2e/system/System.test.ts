import { BluechipApi } from "@bluechip/domain/Api"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { ClientOutdated } from "@bluechip/domain/Errors"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as HttpApiClient from "effect/http-api/HttpApiClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("system", (it) => {
  describe("GET /api/version", () => {
    it.effect("200: the contract version, without a session", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser

        const version = yield* api.system.version()

        assert.strictEqual(version.contract, ContractVersion)
      }))

    it.effect("426: a client on an outdated contract", () =>
      Effect.gen(function*() {
        const api = yield* HttpApiClient.make(BluechipApi, {
          transformClient: HttpClient.mapRequest(HttpClientRequest.setHeader(contractVersionHeader, "999"))
        })

        const error = yield* Effect.flip(api.system.version())

        assert.deepStrictEqual(error, new ClientOutdated({ serverVersion: ContractVersion }))
      }))
  })

  describe("POST from another site", () => {
    it.effect("403: a request whose Origin isn't bluechip's", () =>
      Effect.gen(function*() {
        const response = yield* HttpClientRequest.post("/api/auth/logout").pipe(
          HttpClientRequest.setHeader("origin", "https://evil.example"),
          HttpClient.execute
        )

        assert.strictEqual(response.status, 403)
      }))
  })
})
