import { Devnet } from "@bluechip/devnet/Devnet"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { Unauthenticated } from "@bluechip/domain/Errors"
import { assert, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server forwards to this worker's devnet (`BASE_RPC_URL` in `TestConfig`). The server runs on the real clock.
layer(TestUsers.layer, { excludeTestServices: true })("POST /api/rpc", (it) => {
  it.effect("an allowed call is forwarded to the node, under the caller's id", () =>
    Effect.gen(function*() {
      const { api } = yield* (yield* TestUsers).signUp

      const answer = yield* api.rpc.call({ payload: { jsonrpc: "2.0", id: "a", method: "eth_chainId" } })

      assert.deepStrictEqual(answer, { jsonrpc: "2.0", id: "a", result: "0x2105" })
    }))

  it.effect("a batch: each call answered in its place, a refused one among them", () =>
    Effect.gen(function*() {
      const { api } = yield* (yield* TestUsers).signUp

      const answers = yield* api.rpc.call({
        payload: [
          { jsonrpc: "2.0", id: 1, method: "eth_chainId" },
          { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: ["0x00"] },
          { jsonrpc: "2.0", id: 3, method: "eth_chainId" }
        ]
      })

      assert.deepStrictEqual(answers, [
        { jsonrpc: "2.0", id: 1, result: "0x2105" },
        { jsonrpc: "2.0", id: 1, error: { code: -32601, message: "bluechip doesn't forward eth_sendRawTransaction" } },
        { jsonrpc: "2.0", id: 3, result: "0x2105" }
      ])
    }))

  it.effect("a method outside the web's reads is refused, never forwarded", () =>
    Effect.gen(function*() {
      const { api } = yield* (yield* TestUsers).signUp

      const answer = yield* api.rpc.call({ payload: { jsonrpc: "2.0", id: 7, method: "anvil_setBalance" } })

      assert.deepStrictEqual(answer, {
        jsonrpc: "2.0",
        id: 7,
        error: { code: -32601, message: "bluechip doesn't forward anvil_setBalance" }
      })
    }))

  it.effect("a batch over 20 calls is refused whole", () =>
    Effect.gen(function*() {
      const { api } = yield* (yield* TestUsers).signUp

      const answer = yield* api.rpc.call({
        payload: Array.from({ length: 21 }, (_, id) => ({ jsonrpc: "2.0" as const, id, method: "eth_chainId" }))
      })

      assert.deepStrictEqual(answer, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "A batch holds 1 to 20 calls." }
      })
    }))

  it.effect("the node's own error comes back without the node's address", () =>
    Effect.gen(function*() {
      const { api } = yield* (yield* TestUsers).signUp
      const devnet = yield* Devnet

      const answer = yield* api.rpc.call({
        payload: { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: "0x00" }, "latest"] }
      })

      assert.isDefined(Array.isArray(answer) ? undefined : (answer as { readonly error?: unknown }).error)
      assert.notInclude(JSON.stringify(answer), devnet.rpcUrl)
      assert.notInclude(JSON.stringify(answer), new URL(devnet.rpcUrl).host)
    }))

  it.effect("over 120 calls a minute from one session: refused until the minute passes", () =>
    Effect.gen(function*() {
      const { api } = yield* (yield* TestUsers).signUp
      const batch = Array.from({ length: 20 }, (_, id) => ({ jsonrpc: "2.0" as const, id, method: "eth_chainId" }))

      for (let sent = 0; sent < 6; sent++) yield* api.rpc.call({ payload: batch })
      const answer = yield* api.rpc.call({ payload: { jsonrpc: "2.0", id: 1, method: "eth_chainId" } })

      assert.deepStrictEqual(answer, {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32005, message: "Too many calls. Try again in a minute." }
      })
    }))

  it.effect("413: a body over 64 KiB, refused before it is read, as a JSON-RPC error", () =>
    Effect.gen(function*() {
      const user = yield* (yield* TestUsers).signUp
      // Sent by hand: the typed client can't read a 413 its API doesn't declare.
      const client = HttpClient.withCookiesRef(yield* HttpClient.HttpClient, user.cookies)

      const response = yield* client.execute(
        HttpClientRequest.post("/api/rpc").pipe(
          HttpClientRequest.setHeader(contractVersionHeader, String(ContractVersion)),
          HttpClientRequest.bodyJsonUnsafe({ jsonrpc: "2.0", id: 1, method: "eth_call", params: ["x".repeat(70_000)] })
        )
      )

      assert.deepStrictEqual([response.status, yield* response.json], [413, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "The request is too large." }
      }])
    }))

  it.effect("401: no session", () =>
    Effect.gen(function*() {
      const { api } = yield* (yield* TestUsers).browser

      const error = yield* Effect.flip(api.rpc.call({ payload: { jsonrpc: "2.0", id: 1, method: "eth_chainId" } }))

      assert.instanceOf(error, Unauthenticated)
    }))
})
