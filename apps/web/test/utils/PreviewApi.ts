// The preview's mock API for tests: the typed client against a scenario's world, answered in memory, so a test checks
// that every mocked answer decodes as the real API's would.
import { BluechipApi } from "@bluechip/domain/Api"
import * as Effect from "effect/Effect"
import * as HttpApiClient from "effect/http-api/HttpApiClient"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import { ACTIONS } from "../../src/preview/panel/actions.ts"
import { mockApi } from "../../src/preview/server/MockApi.ts"
import { PreviewStore } from "../../src/preview/store.ts"
import type { ScenarioId } from "../../src/preview/world/cast.ts"

/** A scenario's store and the typed client of its mock API. */
export const previewApi = (scenario: ScenarioId) =>
  Effect.gen(function*() {
    // Panel actions are saved in session storage, which Node shares across a worker's tests: each test starts clean.
    globalThis.sessionStorage?.clear()
    const store = new PreviewStore(scenario, ACTIONS)
    const api = mockApi(store)
    const client = yield* HttpApiClient.make(BluechipApi, { baseUrl: "http://preview.test" }).pipe(
      Effect.provide(FetchHttpClient.layer.pipe(
        Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => api.handler(new Request(input, init))))
      ))
    )
    return { store, client }
  })
