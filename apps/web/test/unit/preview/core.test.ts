import { ContractVersion } from "@bluechip/domain/Contract"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { previewApi } from "../../utils/PreviewApi.ts"

describe("preview mock API", () => {
  it.effect("GET /api/version answers as the server, marked preview", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const version = yield* client.system.version()

      assert.deepStrictEqual([version.version, version.contract], ["preview", ContractVersion])
    }))
})
