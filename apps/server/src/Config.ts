import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Redacted from "effect/Redacted"

/** Server settings, read once from the environment at startup. */
export class AppConfig extends Context.Service<AppConfig, {
  readonly env: "development" | "test" | "production"
  readonly port: number
  readonly publicOrigin: string
  readonly databaseUrl: Redacted.Redacted
}>()("@bluechip/server/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    Effect.gen(function*() {
      return {
        env: yield* Config.Literals(["development", "test", "production"], "NODE_ENV").pipe(
          Config.withDefault("development")
        ),
        port: yield* Config.Port("PORT").pipe(Config.withDefault(4000)),
        publicOrigin: yield* Config.String("PUBLIC_ORIGIN").pipe(Config.withDefault("http://localhost:3000")),
        databaseUrl: yield* Config.Redacted("DATABASE_URL")
      }
    })
  )
}
