// The server's settings in tests: its own database (created with the Postgres volume), so tests never leave
// accounts in development data.
import { Devnet } from "@bluechip/devnet/Devnet"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { randomBytes } from "node:crypto"

export const testDatabaseUrl = "postgres://bluechip:bluechip@localhost:5432/bluechip_test"

/** The web app's origin: passkeys are made for it, and the server refuses unsafe requests from any other. */
export const origin = "http://localhost:3000"

/** The server's config on this worker's devnet: the test database, a fresh agent-key secret and the devnet's bundler. */
export const TestConfig = Layer.unwrap(Effect.gen(function*() {
  const devnet = yield* Devnet
  return ConfigProvider.layer(ConfigProvider.fromEnvRecord({
    DATABASE_URL: testDatabaseUrl,
    PUBLIC_ORIGIN: origin,
    RP_ID: "localhost",
    AGENT_KEY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    BUNDLER_URL: devnet.bundlerUrl
  }))
}))
