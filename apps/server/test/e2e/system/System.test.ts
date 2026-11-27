import { BluechipApi } from "@bluechip/domain/Api"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { ClientOutdated } from "@bluechip/domain/Errors"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as HttpApiClient from "effect/http-api/HttpApiClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import { origin } from "../../utils/TestConfig.ts"
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

  describe("POST from another origin", () => {
    it.effect("403: a request whose Origin isn't the web app's", () =>
      Effect.gen(function*() {
        const response = yield* HttpClientRequest.post("/api/auth/logout").pipe(
          HttpClientRequest.setHeader("origin", "https://evil.example"),
          HttpClient.execute
        )

        assert.strictEqual(response.status, 403)
      }))

    it.effect("403: a page on another subdomain of the site", () =>
      Effect.gen(function*() {
        const response = yield* HttpClientRequest.post("/api/auth/logout").pipe(
          HttpClientRequest.setHeader("origin", "http://other.localhost:3000"),
          HttpClient.execute
        )

        assert.strictEqual(response.status, 403)
      }))

    it.effect("204: the web app's own origin", () =>
      Effect.gen(function*() {
        const response = yield* HttpClientRequest.post("/api/auth/logout").pipe(
          HttpClientRequest.setHeader("origin", origin),
          HttpClient.execute
        )

        assert.strictEqual(response.status, 204)
      }))
  })

  describe("CORS", () => {
    it.effect("the web app's origin may read an answer, with its cookie", () =>
      Effect.gen(function*() {
        const response = yield* HttpClientRequest.get("/api/version").pipe(
          HttpClientRequest.setHeader("origin", origin),
          HttpClient.execute
        )

        assert.deepStrictEqual({
          status: response.status,
          allowOrigin: response.headers["access-control-allow-origin"],
          allowCredentials: response.headers["access-control-allow-credentials"],
          vary: response.headers["vary"]
        }, { status: 200, allowOrigin: origin, allowCredentials: "true", vary: "Origin" })
      }))

    it.effect("a refusal carries the headers too: 401 signed out", () =>
      Effect.gen(function*() {
        const response = yield* HttpClientRequest.get("/api/account").pipe(
          HttpClientRequest.setHeader("origin", origin),
          HttpClient.execute
        )

        assert.deepStrictEqual({
          status: response.status,
          allowOrigin: response.headers["access-control-allow-origin"],
          allowCredentials: response.headers["access-control-allow-credentials"]
        }, { status: 401, allowOrigin: origin, allowCredentials: "true" })
      }))

    it.effect("another origin may not read an answer", () =>
      Effect.gen(function*() {
        const response = yield* HttpClientRequest.get("/api/version").pipe(
          HttpClientRequest.setHeader("origin", "https://evil.example"),
          HttpClient.execute
        )

        assert.deepStrictEqual({
          status: response.status,
          allowOrigin: response.headers["access-control-allow-origin"]
        }, { status: 200, allowOrigin: undefined })
      }))

    it.effect("204: a preflight from the web app's origin, without a session", () =>
      Effect.gen(function*() {
        const response = yield* HttpClientRequest.make("OPTIONS")("/api/trades").pipe(
          HttpClientRequest.setHeaders({
            origin,
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type,x-contract-version,traceparent"
          }),
          HttpClient.execute
        )

        assert.deepStrictEqual({
          status: response.status,
          allowOrigin: response.headers["access-control-allow-origin"],
          allowCredentials: response.headers["access-control-allow-credentials"],
          allowMethods: response.headers["access-control-allow-methods"],
          allowHeaders: response.headers["access-control-allow-headers"],
          maxAge: response.headers["access-control-max-age"]
        }, {
          status: 204,
          allowOrigin: origin,
          allowCredentials: "true",
          allowMethods: "GET, HEAD, POST, PUT, PATCH, DELETE",
          allowHeaders: "content-type,x-contract-version,x-bluechip-replay-session,traceparent,tracestate,b3",
          maxAge: "7200"
        })
      }))

    it.effect("a preflight from another origin is not allowed", () =>
      Effect.gen(function*() {
        const response = yield* HttpClientRequest.make("OPTIONS")("/api/trades").pipe(
          HttpClientRequest.setHeaders({ origin: "https://evil.example", "access-control-request-method": "POST" }),
          HttpClient.execute
        )

        assert.deepStrictEqual({
          status: response.status,
          allowOrigin: response.headers["access-control-allow-origin"]
        }, { status: 204, allowOrigin: undefined })
      }))
  })
})
