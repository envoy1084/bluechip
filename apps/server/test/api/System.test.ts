import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { call, handler } from "../support/api.ts"

describe("GET /api/version", () => {
  it.effect("200: the contract version, without a session", () =>
    Effect.gen(function*() {
      const version = yield* call("GET", "/api/version")

      assert.strictEqual(version.status, 200)
      assert.strictEqual(version.json.contract, ContractVersion)
    }))

  it.effect("426: a client on an outdated contract", () =>
    Effect.gen(function*() {
      const response = yield* Effect.promise(() =>
        handler(new Request("http://localhost/api/version", { headers: { [contractVersionHeader]: "999" } }))
      )

      assert.strictEqual(response.status, 426)
    }))
})

describe("POST from another site", () => {
  it.effect("403: a request whose Origin isn't bluechip's", () =>
    Effect.gen(function*() {
      const forged = yield* call("POST", "/api/auth/logout", { origin: "https://evil.example" })

      assert.strictEqual(forged.status, 403)
    }))
})
