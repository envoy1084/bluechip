import { LINKED, NOT_LINKED } from "@bluechip/domain/channels/ChatReplies"
import { assert, describe, layer } from "@effect/vitest"
import * as Chat from "effect/chat/Chat"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import { TelegramLive } from "../../../../src/modules/channels/telegram/Telegram.ts"
import { TelegramConfig } from "../../../../src/modules/channels/telegram/TelegramConfig.ts"
import { telegramMessage } from "../../../fixtures/Telegram.ts"
import { BOT_TOKEN, BotApiTest } from "../../../utils/BotApiTest.ts"
import { testServer } from "../../../utils/TestServer.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The bot on Telegram's real adapter, polling a Bot API in process. Chat ids here are numbers no other test uses.
const server = testServer(Chat.layer)
const botApi = BotApiTest.layer
const bot = TelegramLive.pipe(
  Layer.provide(Layer.succeed(TelegramConfig, {
    token: Redacted.make(BOT_TOKEN),
    username: "bluechip_test_bot",
    updates: "polling",
    webhookSecret: undefined,
    webhookUrl: "https://bluechip.test/telegram/webhook"
  })),
  Layer.provide(botApi),
  // Only the webhook adds a route; polling needs none.
  Layer.provide(HttpRouter.layer),
  Layer.provide(server)
)

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestUsers.layerNoDeps.pipe(Layer.provideMerge(server)), bot, botApi), {
  excludeTestServices: true
})("Telegram transport", (it) => {
  describe("long polling", () => {
    it.effect("starts by deleting any webhook, then sets the command menu and polls", () =>
      Effect.gen(function*() {
        const api = yield* BotApiTest
        yield* api.update(telegramMessage(910_001, "hello", 1))
        yield* api.sent

        const methods = (yield* api.calls).map((call) => call.method)

        assert.deepStrictEqual(methods.slice(0, 3), ["deleteWebhook", "setMyCommands", "getUpdates"])
      }))

    it.effect("a stranger's message: only how to link, sent to that chat", () =>
      Effect.gen(function*() {
        const api = yield* BotApiTest

        yield* api.update(telegramMessage(910_002, "What's my balance?", 2))
        const sent = yield* api.sent

        assert.strictEqual(sent.params["chat_id"], 910_002)
        assert.include(JSON.stringify(sent.params["rich_message"]), NOT_LINKED.slice(0, 40))
      }))

    it.effect("/start with the app's code links the chat", () =>
      Effect.gen(function*() {
        const api = yield* BotApiTest
        const user = yield* (yield* TestUsers).signUp
        const { code } = yield* user.api.channels.linkCode({ params: { platform: "telegram" } })

        yield* api.update(telegramMessage(910_003, `/start ${code}`, 3))
        const sent = yield* api.sent
        const links = yield* user.api.channels.links()

        assert.deepStrictEqual([sent.params["chat_id"], links.map((link) => link.platform)], [910_003, ["telegram"]])
        assert.include(JSON.stringify(sent.params["rich_message"]), LINKED.slice(0, 30))
      }))
  })
})
