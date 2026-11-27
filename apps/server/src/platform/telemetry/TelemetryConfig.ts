import { type Network, NetworkConfig } from "@bluechip/chain/Network"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Redacted from "effect/Redacted"
import { release } from "../../config/Release.ts"

/** Where the server runs: telemetry leaves the machine only on `paper` and `production`. */
type DeploymentEnvironment = "development" | "paper" | "production"

/** Axiom's OTLP ingest: one token, a dataset per signal. */
export interface AxiomConfig {
  /** The ingest token (`AXIOM_TOKEN`); it may only ingest. */
  readonly token: Redacted.Redacted<string>
  /**
   * The ingest base URL: the datasets' edge, `AXIOM_EDGE_DOMAIN` (else `AXIOM_DOMAIN`), `https://` added when it has
   * no scheme.
   */
  readonly url: string
  readonly datasets: { readonly traces: string; readonly logs: string; readonly metrics: string }
}

/**
 * The server's telemetry settings. Axiom (`axiom`) is on only when `DEPLOYMENT_ENVIRONMENT` is `paper` or
 * `production` and `AXIOM_TOKEN`, `AXIOM_EDGE_DOMAIN` (or `AXIOM_DOMAIN`) and the three `AXIOM_*_DATASET`s are all set; otherwise nothing is
 * exported and the native tracer keeps spans in the process. `posthog` is PostHog's ingest host (`POSTHOG_HOST`)
 * the server's own analytics posts to, on the same two environments. `sampleReads` (`TRACE_SAMPLE_READS`, 0 to 1) is the share of `GET`
 * requests traced: 20% in production, all of them elsewhere.
 */
export class TelemetryConfig extends Context.Service<TelemetryConfig, {
  readonly environment: DeploymentEnvironment
  readonly network: Network
  readonly release: string
  readonly axiom: AxiomConfig | undefined
  readonly posthog: { readonly ingest: string } | undefined
  readonly sampleReads: number
}>()("@bluechip/server/TelemetryConfig") {
  static readonly layer = Layer.effect(
    TelemetryConfig,
    Effect.gen(function*() {
      const environment = yield* Config.Literals(["development", "paper", "production"], "DEPLOYMENT_ENVIRONMENT")
        .pipe(Config.withDefault("development" as const))
      const network = yield* NetworkConfig
      const deployed = environment !== "development"

      const axiom = yield* Config.option(Config.all({
        token: Config.Redacted("AXIOM_TOKEN"),
        // Ingest goes to the datasets' edge (`eu-central-1.aws.edge.axiom.co`); `AXIOM_DOMAIN` is the API's.
        domain: Config.String("AXIOM_EDGE_DOMAIN").pipe(Config.orElse(() => Config.String("AXIOM_DOMAIN"))),
        traces: Config.String("AXIOM_TRACES_DATASET"),
        logs: Config.String("AXIOM_LOGS_DATASET"),
        metrics: Config.String("AXIOM_METRICS_DATASET")
      }))
      const posthog = {
        ingest: yield* Config.String("POSTHOG_HOST").pipe(Config.withDefault("https://us.i.posthog.com"))
      }
      const sampleReads = yield* Config.Number("TRACE_SAMPLE_READS").pipe(
        Config.withDefault(environment === "production" ? 0.2 : 1)
      )

      return {
        environment,
        network,
        release,
        axiom: !deployed || Option.isNone(axiom) ? undefined : {
          token: axiom.value.token,
          url: /^https?:\/\//.test(axiom.value.domain) ? axiom.value.domain : `https://${axiom.value.domain}`,
          datasets: { traces: axiom.value.traces, logs: axiom.value.logs, metrics: axiom.value.metrics }
        },
        posthog: deployed ? posthog : undefined,
        sampleReads: Math.min(1, Math.max(0, sampleReads))
      }
    })
  )
}
