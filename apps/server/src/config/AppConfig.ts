import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Redacted from "effect/Redacted"

/** Server settings, read once from the environment at startup. */
export class AppConfig extends Context.Service<AppConfig, {
  readonly env: "development" | "test" | "production"
  readonly port: number
  /** The web app's origin: links in messages point at it, and only it may call the API from a browser. */
  readonly publicOrigin: string
  /** The server's own public origin (`https://api.bluechip.markets`): the web app's by default, behind Vite's proxy. */
  readonly apiOrigin: string
  /** The WebAuthn relying party: passkeys are bound to this domain for good. */
  readonly rpId: string
  readonly databaseUrl: Redacted.Redacted
  /** Encrypts agents' session keys at rest: 32 random bytes, base64 (`openssl rand -base64 32`). */
  readonly agentKeyEncryptionKey: Redacted.Redacted<string>
}>()("@bluechip/server/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    Effect.gen(function*() {
      const publicOrigin = yield* Config.String("PUBLIC_ORIGIN").pipe(Config.withDefault("http://localhost:3000"))
      return {
        env: yield* Config.Literals(["development", "test", "production"], "NODE_ENV").pipe(
          Config.withDefault("development")
        ),
        port: yield* Config.Port("PORT").pipe(Config.withDefault(8080)),
        publicOrigin,
        apiOrigin: yield* Config.String("API_ORIGIN").pipe(Config.withDefault(publicOrigin)),
        rpId: yield* Config.String("RP_ID").pipe(Config.withDefault("localhost")),
        databaseUrl: yield* Config.Redacted("DATABASE_URL"),
        agentKeyEncryptionKey: yield* Config.Redacted("AGENT_KEY_ENCRYPTION_KEY")
      }
    })
  )
}
