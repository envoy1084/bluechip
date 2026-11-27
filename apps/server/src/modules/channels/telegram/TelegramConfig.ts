import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Redacted from "effect/Redacted"
import { AppConfig } from "../../../config/AppConfig.ts"

/**
 * The Telegram bot's settings. `TELEGRAM_BOT_TOKEN` (from @BotFather, redacted) turns the bot on;
 * `TELEGRAM_BOT_USERNAME` is its handle for link codes' deep links. Updates arrive by long polling (`polling`, the
 * default outside production: no public URL needed) or a webhook (`webhook`, the default in production) at
 * `TELEGRAM_WEBHOOK_URL` (`API_ORIGIN/telegram/webhook` by default; the server answers `/telegram/webhook`), checked
 * against `TELEGRAM_WEBHOOK_SECRET` (32 to 256 of `A-Za-z0-9_-`).
 */
export class TelegramConfig extends Context.Service<TelegramConfig, {
  readonly token: Redacted.Redacted<string> | undefined
  readonly username: string | undefined
  readonly updates: "polling" | "webhook"
  readonly webhookSecret: Redacted.Redacted<string> | undefined
  readonly webhookUrl: string
}>()("@bluechip/server/TelegramConfig") {
  static readonly layer = Layer.effect(
    TelegramConfig,
    Effect.gen(function*() {
      const app = yield* AppConfig
      const token = yield* Config.option(Config.Redacted("TELEGRAM_BOT_TOKEN"))
      const username = yield* Config.option(Config.String("TELEGRAM_BOT_USERNAME"))
      const updates = yield* Config.Literals(["polling", "webhook"], "TELEGRAM_UPDATES").pipe(
        Config.withDefault(app.env === "production" ? "webhook" as const : "polling" as const)
      )
      const webhookSecret = yield* Config.option(Config.Redacted("TELEGRAM_WEBHOOK_SECRET"))
      const webhookUrl = yield* Config.String("TELEGRAM_WEBHOOK_URL").pipe(
        Config.withDefault(new URL("/telegram/webhook", app.apiOrigin).toString())
      )
      return {
        token: Option.getOrUndefined(token),
        username: Option.getOrUndefined(username)?.replace(/^@/, ""),
        updates,
        webhookSecret: Option.getOrUndefined(webhookSecret),
        webhookUrl
      }
    })
  )
}
