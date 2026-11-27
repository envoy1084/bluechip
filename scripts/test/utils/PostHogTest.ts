// PostHog's REST API at the edge, in process: one project and its actions, cohorts, dashboards and insights, kept in
// memory as PostHog would keep them (ids assigned, a few fields of its own added), with every write recorded.
import { Context, Effect, Layer } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"

/** The capture key of the fake's project: what `POSTHOG_PROJECT_API_KEY` must be. */
export const PROJECT_KEY = "phc_test_project"

type Row = Record<string, unknown> & { id: number }

export class PostHogTest extends Context.Service<PostHogTest, {
  /** Every write, as `METHOD path`, oldest first. */
  readonly writes: Effect.Effect<ReadonlyArray<string>>
  /** The project's settings and fields now. */
  readonly project: Effect.Effect<Readonly<Record<string, unknown>>>
  /** The rows of one collection (`insights`, `dashboards`, …) now. */
  readonly rows: (collection: string) => Effect.Effect<ReadonlyArray<Row>>
  /** Refuses any later write of this setting with a 400, as PostHog does for a setting the plan doesn't have. */
  readonly refuse: (setting: string) => Effect.Effect<void>
}>()("scripts/test/PostHogTest") {
  static readonly layer = Layer.unwrap(Effect.sync(() => {
    const project: Record<string, unknown> = {
      id: 7,
      name: "bluechip paper",
      api_token: PROJECT_KEY,
      anonymize_ips: false,
      timezone: "UTC",
      app_urls: []
    }
    const collections = new Map<string, Array<Row>>()
    const writes: Array<string> = []
    const refused = new Set<string>()
    let nextId = 100

    const json = (request: Parameters<Parameters<typeof HttpClient.make>[0]>[0], status: number, body: unknown) =>
      HttpClientResponse.fromWeb(request, new Response(JSON.stringify(body), { status }))

    const client = HttpClient.make((request, url) =>
      Effect.sync(() => {
        const path = url.pathname
        const raw = (request.body as { readonly body?: Uint8Array }).body
        const body = raw === undefined ? {} : JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>

        if (path === "/api/personal_api_keys/@current/") return json(request, 200, { scoped_teams: [7] })
        if (path === "/api/projects/7/") {
          if (request.method === "GET") return json(request, 200, project)
          writes.push(`PATCH ${path}`)
          const blocked = Object.keys(body).find((setting) => refused.has(setting))
          if (blocked !== undefined) return json(request, 400, { detail: `${blocked} needs a paid plan` })
          Object.assign(project, body)
          return json(request, 200, project)
        }

        const [, collection, id] = path.match(/^\/api\/projects\/7\/([a-z_]+)\/(?:(\d+)\/)?$/) ?? []
        if (collection === undefined) return json(request, 404, { detail: "Not found." })
        const rows = collections.get(collection) ?? []
        collections.set(collection, rows)
        if (request.method === "GET") return json(request, 200, { results: rows, next: null })

        writes.push(`${request.method} ${path}`)
        if (request.method === "POST") {
          const row: Row = { ...body, id: nextId++, created_at: "2026-11-27T00:00:00Z", deleted: false }
          rows.push(row)
          return json(request, 201, row)
        }
        const row = rows.find((candidate) => candidate.id === Number(id))
        if (row === undefined) return json(request, 404, { detail: "Not found." })
        Object.assign(row, body)
        return json(request, 200, row)
      })
    )

    return Layer.merge(
      Layer.succeed(PostHogTest, {
        writes: Effect.sync(() => [...writes]),
        project: Effect.sync(() => ({ ...project })),
        rows: (collection) => Effect.sync(() => [...(collections.get(collection) ?? [])]),
        refuse: (setting) => Effect.sync(() => void refused.add(setting))
      }),
      Layer.succeed(HttpClient.HttpClient, client)
    )
  }))
}
