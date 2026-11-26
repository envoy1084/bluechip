import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Option from "effect/Option"
import type * as Redacted from "effect/Redacted"

/** Server settings, read once from the environment at startup. */
export class AppConfig extends Context.Service<AppConfig, {
  readonly env: "development" | "test" | "production"
  readonly port: number
  readonly publicOrigin: string
  /** The WebAuthn relying party: passkeys are bound to this domain for good. */
  readonly rpId: string
  readonly databaseUrl: Redacted.Redacted
  /** Encrypts agents' session keys at rest: 32 random bytes, base64 (`openssl rand -base64 32`). */
  readonly agentKeyEncryptionKey: Redacted.Redacted<string>
  /**
   * Another Alpaca account's keys for the news stream (`ALPACA_NEWS_KEY_ID`, `ALPACA_NEWS_SECRET_KEY`); none, the
   * usual case: the main Alpaca keys (the price and news streams run together on one free account).
   */
  readonly alpacaNewsKey: Option.Option<{
    readonly keyId: Redacted.Redacted<string>
    readonly secret: Redacted.Redacted<string>
  }>
}>()("@bluechip/server/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    Effect.gen(function*() {
      return {
        env: yield* Config.Literals(["development", "test", "production"], "NODE_ENV").pipe(
          Config.withDefault("development")
        ),
        port: yield* Config.Port("PORT").pipe(Config.withDefault(8080)),
        publicOrigin: yield* Config.String("PUBLIC_ORIGIN").pipe(Config.withDefault("http://localhost:3000")),
        rpId: yield* Config.String("RP_ID").pipe(Config.withDefault("localhost")),
        databaseUrl: yield* Config.Redacted("DATABASE_URL"),
        agentKeyEncryptionKey: yield* Config.Redacted("AGENT_KEY_ENCRYPTION_KEY"),
        alpacaNewsKey: yield* Config.option(Config.all({
          keyId: Config.Redacted("ALPACA_NEWS_KEY_ID"),
          secret: Config.Redacted("ALPACA_NEWS_SECRET_KEY")
        }))
      }
    })
  )
}
