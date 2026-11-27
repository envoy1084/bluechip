import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Redacted from "effect/Redacted"
import { AppConfig } from "../../config/AppConfig.ts"

/** The server's VAPID identity, `undefined` when push isn't set up (no keys in the environment). */
interface Vapid {
  /** Raw P-256 public key, base64url: what browsers subscribe with. */
  readonly publicKey: string
  readonly privateKey: Redacted.Redacted<string>
  /** Who to contact about this server's pushes: a `mailto:` or the app's origin. */
  readonly subject: string
}

/**
 * Web push's settings: `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (made by `node scripts/bin.ts vapid`), and
 * `VAPID_SUBJECT` (the app's origin by default).
 */
export class PushConfig extends Context.Service<PushConfig, { readonly vapid: Vapid | undefined }>()(
  "@bluechip/server/PushConfig"
) {
  static readonly layer = Layer.effect(
    PushConfig,
    Effect.gen(function*() {
      const app = yield* AppConfig
      const publicKey = yield* Config.option(Config.String("VAPID_PUBLIC_KEY"))
      const privateKey = yield* Config.option(Config.Redacted("VAPID_PRIVATE_KEY"))
      const subject = yield* Config.String("VAPID_SUBJECT").pipe(Config.withDefault(app.publicOrigin))
      if (Option.isNone(publicKey) || Option.isNone(privateKey)) return { vapid: undefined }
      return { vapid: { publicKey: publicKey.value, privateKey: privateKey.value, subject } }
    })
  )
}
