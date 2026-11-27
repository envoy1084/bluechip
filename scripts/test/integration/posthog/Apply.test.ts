import { assert, describe, it } from "@effect/vitest"
import { Effect, Redacted } from "effect"

import { applyPostHog } from "../../../posthog/Apply.ts"
import { desired } from "../../../posthog/Desired.ts"
import { PostHogTest, PROJECT_KEY } from "../../utils/PostHogTest.ts"

const api = { host: "https://us.posthog.com", key: Redacted.make("phx_personal") }
const projectKey = Redacted.make(PROJECT_KEY)

describe("applyPostHog", () => {
  it.effect("an empty project: every object made, the settings set", () =>
    Effect.gen(function*() {
      const posthog = yield* PostHogTest
      const want = desired("paper")

      yield* applyPostHog(api, projectKey, want, { dryRun: false })

      const counts = yield* Effect.forEach(
        ["actions", "cohorts", "dashboards", "insights"],
        (collection) => posthog.rows(collection).pipe(Effect.map((rows) => rows.length))
      )
      assert.deepStrictEqual(counts, [1, 10, 7, want.insights.length])
      const project = yield* posthog.project
      assert.deepStrictEqual(
        [project.anonymize_ips, project.session_recording_sample_rate, project.session_recording_masking_config],
        [true, "0.25", { maskAllInputs: true }]
      )
    }).pipe(Effect.provide(PostHogTest.layer)))

  it.effect("applied twice: the second run writes nothing", () =>
    Effect.gen(function*() {
      const posthog = yield* PostHogTest
      yield* applyPostHog(api, projectKey, desired("paper"), { dryRun: false })
      const before = (yield* posthog.writes).length

      const report = yield* applyPostHog(api, projectKey, desired("paper"), { dryRun: false })

      assert.deepStrictEqual([report.changes, (yield* posthog.writes).length], [[], before])
    }).pipe(Effect.provide(PostHogTest.layer)))

  it.effect("a dry run: the changes listed, nothing written", () =>
    Effect.gen(function*() {
      const report = yield* applyPostHog(api, projectKey, desired("paper"), { dryRun: true })

      assert.deepStrictEqual(
        [report.changes.slice(0, 2), yield* (yield* PostHogTest).writes],
        [["create action \"Came back\"", "create cohort \"Activated\""], []]
      )
    }).pipe(Effect.provide(PostHogTest.layer)))

  it.effect("insights land on their dashboards, and the test-account filter on the internal cohort", () =>
    Effect.gen(function*() {
      const posthog = yield* PostHogTest

      yield* applyPostHog(api, projectKey, desired("paper"), { dryRun: false })

      const dashboards = yield* posthog.rows("dashboards")
      const growth = dashboards.find((row) => row.name === "bluechip: Growth")!.id
      const activation = (yield* posthog.rows("insights")).find((row) => row.name === "Activation")!
      const internal = (yield* posthog.rows("cohorts")).find((row) => row.name === "Internal and test")!.id
      const project = yield* posthog.project
      assert.deepStrictEqual(
        [activation.dashboards, (project.test_account_filters as ReadonlyArray<{ value: unknown }>)[0]!.value],
        [[growth], internal]
      )
    }).pipe(Effect.provide(PostHogTest.layer)))

  it.effect("production masks all text in replays", () =>
    Effect.gen(function*() {
      yield* applyPostHog(api, projectKey, desired("production"), { dryRun: false })

      const project = yield* (yield* PostHogTest).project
      assert.deepStrictEqual(
        [project.session_recording_masking_config, project.app_urls],
        [{ maskAllInputs: true, maskTextSelector: "*" }, ["https://bluechip.markets"]]
      )
    }).pipe(Effect.provide(PostHogTest.layer)))

  it.effect("a setting PostHog refuses: listed by hand, the rest applied", () =>
    Effect.gen(function*() {
      const posthog = yield* PostHogTest
      yield* posthog.refuse("heatmaps_opt_in")

      const report = yield* applyPostHog(api, projectKey, desired("paper"), { dryRun: false })

      const project = yield* posthog.project
      assert.deepStrictEqual(
        [report.manual[0], project.heatmaps_opt_in, project.anonymize_ips],
        [
          "setting heatmaps_opt_in = true: PostHog refused it (400: heatmaps_opt_in needs a paid plan); set it by hand.",
          undefined,
          true
        ]
      )
    }).pipe(Effect.provide(PostHogTest.layer)))

  it.effect("a personal key for another project: fails before writing", () =>
    Effect.gen(function*() {
      const error = yield* applyPostHog(api, Redacted.make("phc_other"), desired("paper"), { dryRun: false }).pipe(
        Effect.flip
      )

      assert.deepStrictEqual(
        [
          error._tag,
          error.output.startsWith("The personal API key's project (bluechip paper, 7)"),
          yield* (yield* PostHogTest).writes
        ],
        ["ToolFailed", true, []]
      )
    }).pipe(Effect.provide(PostHogTest.layer)))
})
