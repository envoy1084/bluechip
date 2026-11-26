import { stocks } from "@bluechip/chain/Contracts"
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
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { AgentStore } from "../agents/AgentStore.ts"
import { Notifications } from "./Notifications.ts"

export const stockName = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol

/**
 * Notifications from what happens: every user's live events, read as they are published, turned into notifications
 * by the domain's drafts (intents reaching a step worth telling, agents paused or renewed, money moving, automations'
 * runs). One that fails to store is logged; the stream goes on.
 */
export const NotificationFanout = Layer.effectDiscard(Effect.gen(function*() {
  const live = yield* LiveEvents
  const notifications = yield* Notifications
  const agents = yield* AgentStore

  const draftOf = Effect.fnUntraced(function*(event: LiveEvent): Effect.fn.Return<NotificationDraft | undefined> {
    switch (event._tag) {
      case "IntentChanged": {
        const { intent } = event
        const agent = intent.agentId === null ? undefined : yield* agents.get(intent.agentId as `agent_${string}`)
        return notificationOfIntent(intent, { agent: agent?.name ?? null, stock: stockName })
      }
      case "AgentChanged":
        return event.change === undefined ?
          undefined :
          notificationOfAgent(event.agent, event.change, DateTime.formatIso(yield* DateTime.now))
      case "TransferUpdated":
        return notificationOfTransfer(event.transfer, stockName)
      case "AutomationRan":
        return notificationOfRun(event.run, event.automationName)
      default:
        return undefined
    }
  })

  const stream = yield* live.subscribeAll
  yield* stream.pipe(
    Stream.runForEach(({ event, to }) =>
      to === undefined ?
        Effect.void :
        Effect.flatMap(draftOf(event), (draft) =>
          draft === undefined ? Effect.void : notifications.add(to as UserId, draft)).pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("A notification couldn't be made", cause)
            )
          )
    ),
    Effect.forkScoped
  )
}))
