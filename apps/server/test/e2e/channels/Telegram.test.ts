import { CODE_REFUSED, LINKED, NOT_LINKED, PRIVATE_ONLY, UNLINKED } from "@bluechip/domain/channels/ChatReplies"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Notifications } from "../../../src/modules/notifications/Notifications.ts"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestNotifications } from "../../utils/TestNotifications.ts"
import { TestRecovery } from "../../utils/TestRecovery.ts"
import { TestTelegram } from "../../utils/TestTelegram.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`). Telegram is the in-memory chat (`TelegramTest`).
layer(
  Layer.mergeAll(TestTelegram.layer, TestAgents.layer, TestNotifications.layer, TestRecovery.layer),
  { excludeTestServices: true }
)(
  "Telegram",
  (it) => {
    describe("a chat that isn't linked", () => {
      it.effect("a question: only how to link, never data", () =>
        Effect.gen(function*() {
          const telegram = yield* TestTelegram
          const chat = yield* telegram.chat()

          const replies = yield* telegram.say(chat, "What's my balance?")

          assert.deepStrictEqual(replies.map((reply) => reply.text), [NOT_LINKED])
        }))

      it.effect("/portfolio: only how to link", () =>
        Effect.gen(function*() {
          const telegram = yield* TestTelegram
          const chat = yield* telegram.chat()

          const reply = yield* telegram.command(chat, "portfolio")

          assert.deepStrictEqual(reply, { _tag: "Respond", markdown: NOT_LINKED, visibility: "public" })
        }))

      it.effect("someone else in a linked chat: only how to link", () =>
        Effect.gen(function*() {
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(yield* (yield* TestUsers).signUp)

          const replies = yield* telegram.say({ ...chat, person: "someone-else" }, "What's my balance?")

          assert.deepStrictEqual(replies.map((reply) => reply.text), [NOT_LINKED])
        }))
    })

    describe("linking", () => {
      it.effect("the code from the app, in a private chat: linked, listed, and a security notification", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const telegram = yield* TestTelegram
          const chat = yield* telegram.chat()
          const { bot, code, deepLink } = yield* user.api.channels.linkCode({ params: { platform: "telegram" } })

          const replies = yield* telegram.say(chat, code.toLowerCase())
          const links = yield* user.api.channels.links()
          const { notification } = yield* user.events.next("NotificationAdded")

          assert.deepStrictEqual(
            [
              replies.map((reply) => reply.text),
              links.map((link) => link.platform),
              [notification.kind, notification.severity],
              bot,
              deepLink
            ],
            [
              [LINKED],
              ["telegram"],
              ["chatLinked", "security"],
              "@bluechip_test_bot",
              `https://t.me/bluechip_test_bot?start=${code}`
            ]
          )
          assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/)
        }))

      it.effect("/start with the code, as the deep link sends it: linked", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const telegram = yield* TestTelegram
          const chat = yield* telegram.chat()
          const { code } = yield* user.api.channels.linkCode({ params: { platform: "telegram" } })

          const reply = yield* telegram.command(chat, "start", code)
          const links = yield* user.api.channels.links()

          assert.deepStrictEqual([reply, links.length], [
            { _tag: "Respond", markdown: LINKED, visibility: "public" },
            1
          ])
        }))

      it.effect("a code used once already: refused", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const telegram = yield* TestTelegram
          const { code } = yield* user.api.channels.linkCode({ params: { platform: "telegram" } })
          yield* telegram.say(yield* telegram.chat(), code)

          const replies = yield* telegram.say(yield* telegram.chat(), code)

          assert.deepStrictEqual(replies.map((reply) => reply.text), [CODE_REFUSED])
        }))

      it.effect("a code replaced by a newer one: refused", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const telegram = yield* TestTelegram
          const { code } = yield* user.api.channels.linkCode({ params: { platform: "telegram" } })
          yield* user.api.channels.linkCode({ params: { platform: "telegram" } })

          const replies = yield* telegram.say(yield* telegram.chat(), code)

          assert.deepStrictEqual(replies.map((reply) => reply.text), [CODE_REFUSED])
        }))

      it.effect("a code in a group: refused, links are private", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const telegram = yield* TestTelegram
          const { code } = yield* user.api.channels.linkCode({ params: { platform: "telegram" } })

          const replies = yield* telegram.say(yield* telegram.chat("channel"), code)
          const links = yield* user.api.channels.links()

          assert.deepStrictEqual([replies.map((reply) => reply.text), links], [[PRIVATE_ONLY], []])
        }))
    })

    describe("unlinking", () => {
      it.effect("from the app: the chat no longer reaches the account, and a security notification", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)
          const [link] = yield* user.api.channels.links()

          yield* user.api.channels.unlink({ params: { id: link!.id } })
          const replies = yield* telegram.say(chat, "What's my balance?")
          const page = yield* user.api.notifications.list({ query: {} })

          assert.deepStrictEqual(
            [replies.map((reply) => reply.text), page.items.map((item) => item.kind)],
            [[NOT_LINKED], ["chatUnlinked", "chatLinked"]]
          )
        }))

      it.effect("/unlink from the chat", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)

          const reply = yield* telegram.command(chat, "unlink")
          const links = yield* user.api.channels.links()

          assert.deepStrictEqual([reply, links], [{ _tag: "Respond", markdown: UNLINKED, visibility: "public" }, []])
        }))

      it.effect("the person blocked the bot: the chat is unlinked, and a security notification says why", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const telegram = yield* TestTelegram
          yield* telegram.linked(user)
          const [link] = yield* user.api.channels.links()

          yield* telegram.blocks
          const added = yield* (yield* Notifications).add(user.id, {
            kind: "intentFilled",
            title: "You bought $50.00 of NVIDIA",
            body: "It filled.",
            link: "/activity",
            subjectType: null,
            subjectId: null,
            dedupeKey: `blocked:${link!.id}`
          })
          const deliveries = yield* (yield* TestNotifications).delivered(added!.id)
          const links = yield* user.api.channels.links()
          const { notification } = yield* user.events.next(
            "NotificationAdded",
            ({ notification }) => notification.kind === "chatUnlinked"
          )

          assert.deepStrictEqual(
            [deliveries, links, [notification.severity, notification.body]],
            [
              [{ channel: "telegram", status: "skipped", error: null }],
              [],
              [
                "security",
                `The bot was blocked in Telegram (${link!.name}), so bluechip unlinked it. Link it again in ` +
                "Settings to hear from bluechip there."
              ]
            ]
          )
        }))
    })

    describe("the assistant in a chat", () => {
      it.effect("a question: answered with what its tools read", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).funded
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)
          yield* (yield* RecordedModel).record({
            to: "How much cash do I have?",
            rounds: [[{ call: "getPortfolio", params: {} }], [{ text: "You have $1,000.00 in cash." }]]
          })

          const replies = yield* telegram.say(chat, "How much cash do I have?")
          const { items: [conversation] } = yield* user.api.assistant.conversations({ query: {} })
          const thread = yield* user.api.assistant.conversation({ params: { id: conversation!.id } })

          assert.deepStrictEqual(
            [
              replies.map((reply) => reply.text),
              conversation!.surface,
              thread.messages[1]?.parts.find((part) => part.type === "toolResult")?.name
            ],
            [["You have $1,000.00 in cash."], "telegram", "getPortfolio"]
          )
        }))

      it.effect("a trade within the agent's policies: sent by the agent, then filled, and told in the chat", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)
          yield* (yield* RecordedModel).record({
            to: "Buy $50 of Nvidia with my picker",
            rounds: [
              [{
                call: "proposeTrade",
                params: {
                  agentId: agent.id,
                  symbol: "NVDA",
                  side: "buy",
                  dollars: 50,
                  shares: null,
                  reason: "Asked in Telegram."
                }
              }],
              [{ text: "Your picker is on it." }]
            ]
          })

          const linked = (yield* telegram.posted(chat)).length
          yield* telegram.say(chat, "Buy $50 of Nvidia with my picker")
          const { intent } = yield* user.events.next(
            "IntentChanged",
            ({ intent }) => intent.agentId === agent.id && intent.status === "filled"
          )
          const { notification } = yield* user.events.next(
            "NotificationAdded",
            ({ notification }) => notification.kind === "intentFilled"
          )
          const deliveries = yield* (yield* TestNotifications).delivered(notification.id)
          const posted = (yield* telegram.posted(chat)).slice(linked).map((message) => message.text.split("\n")[0])

          // The fill can be told while the turn is still writing: what was posted, in any order.
          assert.deepStrictEqual([[...posted].sort(), intent.source, deliveries], [
            [
              "**Buy $50.00 of NVIDIA**: sent within the agent's policies.",
              `**${agent.name} bought $50.00 of NVIDIA**`,
              "Your picker is on it."
            ],
            "channel",
            [{ channel: "telegram", status: "sent", error: null }]
          ])
        }))

      it.effect("a trade over the agent's largest trade: a link to approve here, and the notification only elsewhere", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)
          const other = yield* telegram.linked(user)
          const notifications = yield* TestNotifications
          yield* (yield* RecordedModel).record({
            to: "Buy $150 of Nvidia with my picker",
            rounds: [
              [{
                call: "proposeTrade",
                params: { agentId: agent.id, symbol: "NVDA", side: "buy", dollars: 150, shares: null, reason: "Asked." }
              }],
              [{ text: "It needs your Face ID." }]
            ]
          })

          // Each chat hears of the other's link first.
          const linking = yield* user.api.notifications.list({ query: {} })
          yield* Effect.forEach(linking.items, (item) => notifications.delivered(item.id))
          const [here, there] = [(yield* telegram.posted(chat)).length, (yield* telegram.posted(other)).length]
          yield* telegram.say(chat, "Buy $150 of Nvidia with my picker")
          const { notification } = yield* user.events.next(
            "NotificationAdded",
            ({ notification }) => notification.kind === "approvalNeeded"
          )
          const deliveries = yield* notifications.delivered(notification.id)
          const postedHere = (yield* telegram.posted(chat)).slice(here)
          const postedThere = (yield* telegram.posted(other)).slice(there)

          assert.deepStrictEqual(
            [postedHere.map((message) => message.text), postedThere.map((message) => message.text), deliveries],
            [
              [
                "**Buy $150.00 of NVIDIA**. Over its $100 limit, so it needs your approval. Approve it " +
                "in bluechip.\n\nApprove in bluechip: http://localhost:3000/home?sheet=approvals",
                "It needs your Face ID."
              ],
              [
                `**${agent.name} needs your approval**\nBuy $150.00 of NVIDIA. Approve or decline it in bluechip with Face ` +
                "ID.\n\nApprove in bluechip: http://localhost:3000/home?sheet=approvals"
              ],
              [{ channel: "push", status: "skipped", error: null }, {
                channel: "telegram",
                status: "sent",
                error: null
              }]
            ]
          )
        }))

      it.effect("a trade as you: a link to the conversation in the app, where Face ID signs it", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).funded
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)
          yield* (yield* RecordedModel).record({
            to: "Buy $20 of Apple for me",
            rounds: [
              [{
                call: "proposeTrade",
                params: { agentId: null, symbol: "AAPL", side: "buy", dollars: 20, shares: null, reason: "Asked." }
              }],
              [{ text: "Approve it in bluechip." }]
            ]
          })

          const [card] = yield* telegram.say(chat, "Buy $20 of Apple for me")
          const { items: [conversation] } = yield* user.api.assistant.conversations({ query: {} })
          const activity = yield* user.api.activity.list({ query: { kind: "trades" } })

          assert.deepStrictEqual([card?.text, activity.items.length], [
            "**Buy $20.00 of Apple** is ready for your Face ID. Nothing happens until you approve it in bluechip." +
            `\n\nOpen in bluechip: http://localhost:3000/chat/${conversation!.id}`,
            0
          ])
        }))

      it.effect("a pause the assistant proposes: Confirm in the chat pauses the agent", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)
          yield* (yield* RecordedModel).record({
            to: "Pause my picker",
            rounds: [[{ call: "pauseAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card." }]]
          })

          const [card] = yield* telegram.say(chat, "Pause my picker")
          const confirmed = yield* telegram.click(chat, card!, "confirm")
          const paused = yield* user.api.agents.agent({ params: { id: agent.id } })

          assert.deepStrictEqual([card?.text, confirmed, paused.paused], [
            `Pause ${agent.name}? It stops trading until you resume it.`,
            `${agent.name} is paused.`,
            true
          ])
        }))

      it.effect("Cancel on a card: nothing changes", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)
          yield* (yield* RecordedModel).record({
            to: "Pause my picker, please",
            rounds: [[{ call: "pauseAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card." }]]
          })

          const [card] = yield* telegram.say(chat, "Pause my picker, please")
          const cancelled = yield* telegram.click(chat, card!, "cancel")
          const kept = yield* user.api.agents.agent({ params: { id: agent.id } })

          assert.deepStrictEqual([cancelled, kept.paused], ["Nothing changed.", false])
        }))
    })

    describe("commands", () => {
      it.effect("/portfolio: cash and stocks", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).funded
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)

          const reply = yield* telegram.command(chat, "portfolio")

          assert.deepStrictEqual(reply, {
            _tag: "Respond",
            markdown: "**Total value: $1,000.00**\nCash: $1,000.00\nNo stocks yet.",
            visibility: "public"
          })
        }))

      it.effect("/agents: each agent and how it stands", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)

          const reply = yield* telegram.command(chat, "agents")

          assert.deepStrictEqual(reply, {
            _tag: "Respond",
            markdown: `**Your agents**\n${agent.name}: trading`,
            visibility: "public"
          })
        }))

      it.effect("/pause: a button per trading agent", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)

          const reply = yield* telegram.command(chat, "pause")

          assert.deepStrictEqual(reply, {
            _tag: "Respond",
            markdown: "Which agent should stop trading?",
            actions: [{ _tag: "Button", id: "pauseAgent", label: agent.name, style: "danger", value: agent.id }],
            visibility: "public"
          })
        }))

      it.effect("/pause_all: every agent paused at once", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(user)

          const reply = yield* telegram.command(chat, "pause_all")
          const paused = yield* user.api.agents.agent({ params: { id: agent.id } })

          assert.deepStrictEqual([reply, paused.paused], [{
            _tag: "Respond",
            markdown: "Every agent is paused. Nothing was sold. Resume them in bluechip.",
            visibility: "public"
          }, true])
        }))
    })

    describe("a recovery of the account", () => {
      it.effect("/cancel_recovery: the recovery waiting out its delay is cancelled from the chat", () =>
        Effect.gen(function*() {
          const recoveries = yield* TestRecovery
          const telegram = yield* TestTelegram
          const user = yield* (yield* TestUsers).funded
          yield* recoveries.request(user, yield* recoveries.setUp(user))
          const chat = yield* telegram.linked(user)

          const reply = yield* telegram.command(chat, "cancel_recovery")
          const recovery = yield* user.api.accountRecovery.get()

          assert.deepStrictEqual([reply, recovery.request?.cancelledFrom], [{
            _tag: "Respond",
            markdown: "The recovery is cancelled. Your passkeys stay as they are. If you didn't ask for it, remove " +
              "your recovery key in bluechip's Settings.",
            visibility: "public"
          }, "telegram"])
        }))

      it.effect("/cancel_recovery with nothing under way", () =>
        Effect.gen(function*() {
          const telegram = yield* TestTelegram
          const chat = yield* telegram.linked(yield* (yield* TestUsers).signUp)

          const reply = yield* telegram.command(chat, "cancel_recovery")

          assert.deepStrictEqual(reply, {
            _tag: "Respond",
            markdown: "There's no recovery of your account waiting to be cancelled.",
            visibility: "public"
          })
        }))
    })
  }
)
