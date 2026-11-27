import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Redacted from "effect/Redacted"
import { makeDeletePerson } from "../../../../src/modules/analytics/PostHogAdmin.ts"

describe("makeDeletePerson", () => {
  it.effect("looks the person up on the app's host with the personal key, then deletes them and their events", () =>
    Effect.gen(function*() {
      const calls: Array<string> = []
      const client = HttpClient.make((request, url) =>
        Effect.sync(() => {
          calls.push(`${request.method} ${url.toString()} ${request.headers["authorization"]}`)
          const body = request.method === "GET" ? JSON.stringify({ results: [{ id: "person-uuid" }] }) : null
          return HttpClientResponse.fromWeb(
            request,
            new Response(body, { status: request.method === "GET" ? 200 : 204 })
          )
        })
      )
      const deletePerson = yield* makeDeletePerson({
        host: "https://us.i.posthog.com",
        personalKey: Redacted.make("phx_test"),
        projectId: 42
      }).pipe(Effect.provideService(HttpClient.HttpClient, client))

      yield* deletePerson("user_01")

      assert.deepStrictEqual(calls, [
        "GET https://us.posthog.com/api/projects/42/persons/?distinct_id=user_01 Bearer phx_test",
        "DELETE https://us.posthog.com/api/projects/42/persons/person-uuid/?delete_events=true Bearer phx_test"
      ])
    }))

  it.effect("a person PostHog never saw: nothing is deleted", () =>
    Effect.gen(function*() {
      const calls: Array<string> = []
      const client = HttpClient.make((request, url) =>
        Effect.sync(() => {
          calls.push(`${request.method} ${url.pathname}`)
          return HttpClientResponse.fromWeb(request, new Response(JSON.stringify({ results: [] }), { status: 200 }))
        })
      )
      const deletePerson = yield* makeDeletePerson({
        host: "https://us.i.posthog.com",
        personalKey: Redacted.make("phx_test"),
        projectId: 42
      }).pipe(Effect.provideService(HttpClient.HttpClient, client))

      yield* deletePerson("user_02")

      assert.deepStrictEqual(calls, ["GET /api/projects/42/persons/"])
    }))
})
