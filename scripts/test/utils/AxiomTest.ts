// Axiom's management API at the edge, in process: datasets and dashboards kept in memory as Axiom keeps them (its own
// fields added), with every write recorded.
import { Context, Effect, Layer } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"

type Entry = Record<string, unknown>

export class AxiomTest extends Context.Service<AxiomTest, {
  /** Every write, as `METHOD path uid-or-name`, oldest first. */
  readonly writes: Effect.Effect<ReadonlyArray<string>>
  readonly datasets: Effect.Effect<ReadonlyArray<Entry>>
  readonly dashboards: Effect.Effect<ReadonlyArray<Entry>>
}>()("scripts/test/AxiomTest") {
  /** Starts with `datasets` (name and kind each) and no dashboards. */
  static readonly layer = (datasets: ReadonlyArray<{ readonly name: string; readonly kind: string }>) =>
    Layer.unwrap(Effect.sync(() => {
      const datasetRows: Array<Entry> = datasets.map((dataset) => ({ ...dataset, id: dataset.name, canWrite: true }))
      const dashboardRows: Array<Entry> = []
      const writes: Array<string> = []
      let version = 1

      const client = HttpClient.make((request, url) =>
        Effect.sync(() => {
          const respond = (status: number, body: unknown) =>
            HttpClientResponse.fromWeb(request, new Response(JSON.stringify(body), { status }))
          const raw = (request.body as { readonly body?: Uint8Array }).body
          const body = raw === undefined ? {} : JSON.parse(new TextDecoder().decode(raw)) as Entry

          if (url.pathname === "/v2/datasets") {
            if (request.method === "GET") return respond(200, datasetRows)
            writes.push(`POST /v2/datasets ${String(body.name)}`)
            datasetRows.push({ ...body, id: body.name, canWrite: true })
            return respond(200, body)
          }
          if (url.pathname === "/v2/dashboards") {
            if (request.method === "GET") return respond(200, dashboardRows)
            writes.push(`POST /v2/dashboards ${String(body.uid)}`)
            const index = dashboardRows.findIndex((entry) => entry.uid === body.uid)
            if (index >= 0 && body.overwrite !== true) return respond(412, { message: "version conflict" })
            const entry = {
              id: `id-${String(body.uid)}`,
              uid: body.uid,
              type: "managed",
              version: version++,
              dashboard: { ...body.dashboard as Entry, uid: body.uid, updatedAt: "2026-11-27T00:00:00Z" }
            }
            if (index >= 0) dashboardRows[index] = entry
            else dashboardRows.push(entry)
            return respond(index >= 0 ? 200 : 201, { dashboard: entry, status: "ok" })
          }
          return respond(404, { message: `path ${url.pathname} was not found` })
        })
      )

      return Layer.merge(
        Layer.succeed(AxiomTest, {
          writes: Effect.sync(() => [...writes]),
          datasets: Effect.sync(() => [...datasetRows]),
          dashboards: Effect.sync(() => [...dashboardRows])
        }),
        Layer.succeed(HttpClient.HttpClient, client)
      )
    }))
}
