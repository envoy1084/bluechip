// The server's settings in tests: its own database (created with the Postgres volume), so tests never leave
// accounts in development data.
import { Devnet } from "@bluechip/devnet/Devnet"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createECDH, randomBytes } from "node:crypto"

// A VAPID key pair for this run, made the way `node scripts/bin.ts vapid` makes one.
const vapid = createECDH("prime256v1")
vapid.generateKeys()

export const testDatabaseUrl = "postgres://bluechip:bluechip@localhost:5432/bluechip_test"

/** The web app's origin: passkeys are made for it, and the server refuses unsafe requests from any other. */
export const origin = "http://localhost:3000"

/**
 * The server's config on this worker's devnet: the test database, a fresh agent-key secret, the devnet's bundler, a
 * VAPID key pair, the Telegram bot's handle (no token: Telegram is `ChatTest` in tests), and every schedule and
 * watcher that sweeps everyone's rows off (`SCHEDULES_ENABLED`): servers on other workers share the database, so
 * tests run each sweep for their own user.
 */
export const TestConfig = Layer.unwrap(Effect.gen(function*() {
  const devnet = yield* Devnet
  return ConfigProvider.layer(ConfigProvider.fromEnvRecord({
    DATABASE_URL: testDatabaseUrl,
    PUBLIC_ORIGIN: origin,
    RP_ID: "localhost",
    AGENT_KEY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    BUNDLER_URL: devnet.bundlerUrl,
    VAPID_PUBLIC_KEY: vapid.getPublicKey().toString("base64url"),
    VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString("base64url"),
    VAPID_SUBJECT: "mailto:tests@bluechip.test",
    TELEGRAM_BOT_USERNAME: "bluechip_test_bot",
    SCHEDULES_ENABLED: "false"
  }))
}))
