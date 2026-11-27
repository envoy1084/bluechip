import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"

/** PostHog's private API for one project: the app's host and a personal API key with `person:write`. */
interface PostHogAdminOptions {
  /** The ingest host (`https://us.i.posthog.com`); the API is on the app's host (`https://us.posthog.com`). */
  readonly host: string
  readonly personalKey: Redacted.Redacted<string>
  /** The project's id; read from the key when unset (the one project it is scoped to, else its current one). */
  readonly projectId: number | undefined
}

const Persons = Schema.Struct({ results: Schema.Array(Schema.Struct({ id: Schema.String })) })
const PersonalKey = Schema.Struct({ scoped_teams: Schema.optional(Schema.NullOr(Schema.Array(Schema.Number))) })
const Project = Schema.Struct({ id: Schema.Number })

/**
 * Deletes a person and their events from PostHog (an account deleted): looks the person up by distinct id, then
 * deletes them. A person PostHog never saw is nothing to delete.
 */
export const makeDeletePerson = Effect.fnUntraced(function*(options: PostHogAdminOptions) {
  const app = options.host.replace(/\/+$/, "").replace(/^(https:\/\/[a-z]+)\.i\.posthog\.com$/, "$1.posthog.com")
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest((request) =>
      request.pipe(
        HttpClientRequest.prependUrl(app),
        HttpClientRequest.bearerToken(Redacted.value(options.personalKey))
      )
    ),
    HttpClient.filterStatusOk
  )
  const read = <S extends Schema.Top>(schema: S, path: string) =>
    client.get(path).pipe(
      Effect.flatMap((response) => response.json),
      Effect.flatMap(Schema.decodeUnknownEffect(schema))
    )

  const projectId = yield* Effect.cached(
    options.projectId !== undefined ? Effect.succeed(options.projectId) : Effect.gen(function*() {
      const key = yield* read(PersonalKey, "/api/personal_api_keys/@current/")
      const scoped = key.scoped_teams ?? []
      return scoped.length === 1 ? scoped[0]! : (yield* read(Project, "/api/projects/@current/")).id
    })
  )

  return Effect.fn("PostHogAdmin.deletePerson")(function*(distinctId: string) {
    const base = `/api/projects/${yield* projectId}/persons`
    const found = yield* read(Persons, `${base}/?distinct_id=${encodeURIComponent(distinctId)}`)
    for (const person of found.results) {
      yield* client.del(`${base}/${person.id}/?delete_events=true`)
    }
  }, Effect.catchCause((cause) => Effect.logWarning("Analytics: couldn't delete a person from PostHog", cause)))
})
