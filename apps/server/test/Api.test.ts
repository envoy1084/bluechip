import { BluechipApi } from "@bluechip/domain/Api"
import { ServerVersion } from "@bluechip/domain/api/SystemApi"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { ClientOutdated } from "@bluechip/domain/Errors"
import { assert, describe, it, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { ApiHandlers, ApiRoutes } from "../src/api/Api.ts"

layer(Layer.mergeAll(ApiHandlers, HttpServer.layerServices))("BluechipApi", (it) => {
  it.effect("version decodes into the domain class with a DateTime", () =>
    Effect.gen(function*() {
      const client = yield* HttpApiTest.groups(BluechipApi, ["system", "events"])
      const version = yield* client.system.version()
      assert.instanceOf(version, ServerVersion)
      assert.strictEqual(version.contract, ContractVersion)
      assert.isTrue(DateTime.isDateTime(version.serverTime))
    }))

  it.effect("the events stream starts with a heartbeat", () =>
    Effect.gen(function*() {
      const client = yield* HttpApiTest.groups(BluechipApi, ["system", "events"])
      const events = yield* client.events.watch().pipe(
        Effect.flatMap((stream) => Stream.runCollect(Stream.take(stream, 1)))
      )
      assert.strictEqual(events[0]?._tag, "Heartbeat")
      assert.strictEqual(events[0]?.sequence, 0)
    }))
})

describe("contract version", () => {
  const request = (version: string) =>
    Effect.acquireUseRelease(
      Effect.sync(() => HttpRouter.toWebHandler(ApiRoutes.pipe(Layer.provide(HttpServer.layerServices)))),
      ({ handler }) =>
        Effect.promise(() =>
          handler(new Request("http://localhost/api/version", { headers: { [contractVersionHeader]: version } }))
        ),
      ({ dispose }) => Effect.promise(dispose)
    )

  it.effect("an outdated client gets ClientOutdated (426)", () =>
    Effect.gen(function*() {
      const response = yield* request(String(ContractVersion + 1))
      assert.strictEqual(response.status, 426)
      const body = yield* Effect.promise(() => response.json())
      const error = yield* Schema.decodeUnknownEffect(ClientOutdated)(body)
      assert.strictEqual(error.serverVersion, ContractVersion)
    }))

  it.effect("a current client is served", () =>
    Effect.gen(function*() {
      const response = yield* request(String(ContractVersion))
      assert.strictEqual(response.status, 200)
    }))
})
