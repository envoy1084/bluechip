import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import type { LiveEvent } from "@bluechip/domain/Events"
import type { UserId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import {
  notificationOfAgent,
  notificationOfIntent,
  notificationOfRun,
  notificationOfTransfer
} from "@bluechip/domain/notifications/Drafts"
import type { NotificationDraft } from "@bluechip/domain/notifications/Notification"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { AgentStore } from "../agents/AgentStore.ts"
import { Notifications } from "./Notifications.ts"
import { NotificationOutbox, type OutboxEvent } from "./Outbox.ts"

// The events whose outbox rows are worth draining as soon as they are heard: those the outbox holds, and those
// published after a draft was written as it is (account safety, chats, the balances' reconciliation).
const TOLD = new Set<LiveEvent["_tag"]>([
  "IntentChanged",
  "AgentChanged",
  "TransferUpdated",
  "AutomationRan",
  "AccountChanged",
  "PortfolioChanged"
])

/**
 * Notifications from what happens, at least once: producers write each event that tells a change to the outbox in
 * the change's transaction (intents reaching a step worth telling, agents paused or renewed, money moving,
 * automations' runs, or a draft as it is), and the fan-out turns the outbox's rows into notifications through the domain's drafts, then
 * deletes them. Hearing the event live drains its user's rows at once; the sweep (`OutboxCron`) takes what a stopped
 * process left. A row handled twice makes one notification (`dedupe_key`); one that fails stays for the sweep.
 */
export class NotificationFanout extends Context.Service<NotificationFanout, {
  /** Turns claimable outbox rows (one user's, or everyone's written before `before`) into notifications. */
  readonly drain: (options: {
    readonly userId?: UserId | undefined
    readonly before?: DateTime.Utc | undefined
  }) => Effect.Effect<number>
}>()("@bluechip/server/NotificationFanout") {
  static readonly layer = Layer.effect(
    NotificationFanout,
    Effect.gen(function*() {
      const notifications = yield* Notifications
      const outbox = yield* NotificationOutbox
      const agents = yield* AgentStore
      const { paper, stocks } = yield* ChainDeployment
      const stockName = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol

      // `at` keys an agent's change: the outbox row's time, the same however often the row is handled.
      const draftOf = Effect.fnUntraced(function*(
        event: OutboxEvent,
        at: DateTime.Utc
      ): Effect.fn.Return<NotificationDraft | undefined> {
        switch (event._tag) {
          case "IntentChanged": {
            const { intent } = event
            const agent = intent.agentId === null ? undefined : yield* agents.get(intent.agentId as `agent_${string}`)
            return notificationOfIntent(intent, { agent: agent?.name ?? null, stock: stockName })
          }
          case "AgentChanged":
            return event.change === undefined ?
              undefined :
              notificationOfAgent(event.agent, event.change, DateTime.formatIso(at))
          case "TransferUpdated":
            return notificationOfTransfer(event.transfer, stockName, { paper: paper !== null })
          case "AutomationRan":
            return notificationOfRun(event.run, event.automationName)
          case "NotificationDrafted":
            return event.draft
          default:
            return undefined
        }
      })

      const drain = Effect.fn("NotificationFanout.drain")(function*(options: {
        readonly userId?: UserId | undefined
        readonly before?: DateTime.Utc | undefined
      }) {
        const rows = yield* outbox.claim(options)
        for (const row of rows) {
          yield* draftOf(row.event, row.createdAt).pipe(
            Effect.flatMap((draft) =>
              draft === undefined ? Effect.void : notifications.add(row.userId as UserId, draft)
            ),
            Effect.andThen(outbox.done(row.id)),
            Effect.catchCause((cause) =>
              Effect.logWarning("A notification couldn't be made; the sweep retries it", cause)
            )
          )
        }
        return rows.length
      })

      return NotificationFanout.of({ drain })
    })
  )

  /** Drains a user's outbox whenever one of their changes is heard live. */
  static readonly listen = Layer.effectDiscard(Effect.gen(function*() {
    const live = yield* LiveEvents
    const fanout = yield* NotificationFanout

    const stream = yield* live.subscribeAll
    yield* stream.pipe(
      Stream.filter(({ event, to }) => to !== undefined && TOLD.has(event._tag)),
      Stream.runForEach(({ to }) => fanout.drain({ userId: to })),
      Effect.forkScoped
    )
  }))
}
