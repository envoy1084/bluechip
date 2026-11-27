import { Effect, Redacted } from "effect"

import { ToolFailed } from "../errors.ts"
import { call, list, type PostHogApi, type Row } from "./Api.ts"
import { matches } from "./Matches.ts"
import { type PostHogDesired, type Refs, TAG } from "./Spec.ts"

/** What a run did (or would do, dry): one line per write, the objects already right, and what's left by hand. */
interface ApplyReport {
  readonly project: { readonly id: number; readonly name: string }
  readonly changes: ReadonlyArray<string>
  readonly unchanged: number
  readonly manual: ReadonlyArray<string>
}

/**
 * The project the personal key may change: the one project it is scoped to, else the user's current project. It must
 * be the project `projectKey` (the web app's and server's capture key) sends to, so a key for the wrong project never
 * changes it.
 */
export const resolveProject = Effect.fn("posthog.resolveProject")(function*(
  api: PostHogApi,
  projectKey: Redacted.Redacted<string>
) {
  const key = yield* call(api, "GET", "/api/personal_api_keys/@current/")
  const scoped = Array.isArray(key.scoped_teams) ? key.scoped_teams as ReadonlyArray<number> : []
  const id = scoped.length === 1 ? scoped[0]! : (yield* call(api, "GET", "/api/projects/@current/")).id as number
  const project = yield* call(api, "GET", `/api/projects/${id}/`)
  if (project.api_token !== Redacted.value(projectKey)) {
    return yield* ToolFailed.make({
      tool: "posthog apply",
      output: `The personal API key's project (${String(project.name)}, ${id}) isn't the one POSTHOG_PROJECT_API_KEY ` +
        "sends to: use the personal key made for that project."
    })
  }
  return project as Row
})

/**
 * Makes the project say what `want` says, writing only what differs (objects found by name and the `[bluechip]` tag
 * at the start of their description), in dependency order: actions and cohorts, dashboards, insights on their
 * dashboards, then the settings that point at them. A write PostHog refuses goes to the manual list and the run
 * carries on. With `dryRun`, reads only.
 */
export const applyPostHog = Effect.fn("posthog.apply")(function*(
  api: PostHogApi,
  projectKey: Redacted.Redacted<string>,
  want: PostHogDesired,
  options: { readonly dryRun: boolean }
) {
  const project = yield* resolveProject(api, projectKey)
  const base = `/api/projects/${project.id}`
  const changes: Array<string> = []
  const manual: Array<string> = []
  let unchanged = 0

  const ids = {
    action: new Map<string, number>(),
    cohort: new Map<string, number>(),
    dashboard: new Map<string, number>()
  }
  const refs: Refs = {
    action: (name) => ids.action.get(name),
    cohort: (name) => ids.cohort.get(name),
    dashboard: (name) => ids.dashboard.get(name)
  }

  const write = (what: string, method: "POST" | "PATCH", path: string, body: unknown) =>
    options.dryRun ? Effect.succeed(undefined) : call(api, method, path, body).pipe(
      Effect.map((row) => row.id as number),
      Effect.catchTag("ToolFailed", ({ output }) =>
        Effect.sync(() => {
          manual.push(`${what}: PostHog refused it (${output}); set it by hand.`)
          return undefined
        }))
    )

  const sync = Effect.fnUntraced(function*(
    kind: string,
    path: string,
    specs: ReadonlyArray<{ readonly name: string; readonly description: string; readonly body: unknown }>
  ) {
    const rows = yield* list(api, `${base}/${path}/`)
    const made = new Map<string, number>()
    for (const spec of specs) {
      const body = { name: spec.name, description: `${TAG} ${spec.description}`, ...spec.body as object }
      const existing = rows.find((row) =>
        row.name === spec.name && typeof row.description === "string" && row.description.startsWith(TAG)
      )
      if (existing === undefined) {
        changes.push(`create ${kind} "${spec.name}"`)
        const id = yield* write(`create ${kind} "${spec.name}"`, "POST", `${base}/${path}/`, body)
        if (id !== undefined) made.set(spec.name, id)
        continue
      }
      made.set(spec.name, existing.id)
      if (matches(body, existing)) {
        unchanged++
        continue
      }
      changes.push(`update ${kind} "${spec.name}"`)
      yield* write(`update ${kind} "${spec.name}"`, "PATCH", `${base}/${path}/${existing.id}/`, body)
    }
    return made
  })

  ids.action = yield* sync("action", "actions", want.actions)
  ids.cohort = yield* sync("cohort", "cohorts", want.cohorts)
  ids.dashboard = yield* sync(
    "dashboard",
    "dashboards",
    want.dashboards.map((dashboard) => ({ ...dashboard, body: { pinned: true } }))
  )

  yield* sync(
    "insight",
    "insights",
    want.insights.map((insight) => ({
      name: insight.name,
      description: insight.description,
      body: {
        query: insight.query(refs),
        dashboards: want.dashboards
          .filter((dashboard) => dashboard.insights.includes(insight.name))
          .flatMap((dashboard) => ids.dashboard.get(dashboard.name) ?? [])
      }
    }))
  )

  for (const [setting, value] of Object.entries(want.settings(refs))) {
    if (matches(value, project[setting])) {
      unchanged++
      continue
    }
    changes.push(`update setting ${setting}`)
    yield* write(`setting ${setting} = ${JSON.stringify(value)}`, "PATCH", `${base}/`, { [setting]: value })
  }

  return {
    project: { id: project.id, name: String(project.name) },
    changes,
    unchanged,
    manual: [...manual, ...want.manual]
  } satisfies ApplyReport
})
