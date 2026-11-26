// The Telegram bot's transport: the Bot API adapter (@effect/chat-telegram) registered in the chat router, and how
// updates arrive. Long polling outside production (no public URL), as a cluster singleton because Telegram allows one
// consumer: it deletes any webhook first. In production, the webhook at `/telegram/webhook`, behind its secret header,
// registered once at start. Off without `TELEGRAM_BOT_TOKEN`.
import * as TelegramBotApi from "@effect/chat-telegram/TelegramBotApi"
import * as TelegramChat from "@effect/chat-telegram/TelegramChat"
import * as Singleton from "effect/cluster/Singleton"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { BotInteractions } from "../Interactions.ts"
import { TelegramConfig } from "./TelegramConfig.ts"

/** The webhook's path on the server. */
export const WEBHOOK_PATH = "/telegram/webhook"

// What a bot shows in its command menu.
const setCommands = TelegramChat.setCommands(BotInteractions).pipe(
  Effect.catch((error) => Effect.logWarning("Telegram's command menu couldn't be set", error))
)

const polling = Singleton.make(
  "telegram.updates",
  Effect.gen(function*() {
    const api = yield* TelegramBotApi.TelegramBotApi
    yield* api.call("deleteWebhook", { drop_pending_updates: false }, { write: true })
    yield* setCommands
    yield* Layer.build(TelegramChat.layerPolling())
    yield* Effect.logInfo("Telegram: polling for updates")
    return yield* Effect.never
  }).pipe(Effect.catch((error) => Effect.logError("Telegram polling couldn't start", error)))
)

/** The bot, when it has a token: the adapter, and polling or the webhook (with its registration). */
export const TelegramLive = Layer.unwrap(Effect.gen(function*() {
  const config = yield* TelegramConfig
  if (config.token === undefined) return Layer.empty

  const adapter = TelegramChat.layer({ token: config.token, unverified: { buttons: true, commands: true } })
  if (config.updates === "polling") return polling.pipe(Layer.provide(adapter))

  if (config.webhookSecret === undefined) {
    return yield* Effect.die(new Error("TELEGRAM_UPDATES=webhook needs TELEGRAM_WEBHOOK_SECRET"))
  }
  const secretToken = config.webhookSecret
  const register = Singleton.make(
    "telegram.webhook",
    Effect.gen(function*() {
      yield* TelegramChat.setWebhook({ url: config.webhookUrl, secretToken })
      yield* setCommands
      yield* Effect.logInfo(`Telegram: webhook at ${config.webhookUrl}`)
    }).pipe(Effect.catch((error) => Effect.logError("Telegram's webhook couldn't be set", error)))
  )
  return Layer.merge(TelegramChat.layerWebhook({ path: WEBHOOK_PATH, secretToken }), register).pipe(
    Layer.provide(adapter)
  )
}))
