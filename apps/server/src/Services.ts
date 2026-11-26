import { DevChain } from "@bluechip/chain/DevChain"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Accounts } from "./modules/accounts/Accounts.ts"
import { Passkeys } from "./modules/accounts/Passkeys.ts"
import { Activity } from "./modules/activity/Activity.ts"
import { AgentRequests } from "./modules/agents/AgentRequests.ts"
import { Agents } from "./modules/agents/Agents.ts"
import { AgentSessions } from "./modules/agents/AgentSessions.ts"
import { AgentStore } from "./modules/agents/AgentStore.ts"
import { ExpireAgentsCron } from "./modules/agents/ExpireCron.ts"
import { Assistant } from "./modules/assistant/Assistant.ts"
import { AssistantToolsLive } from "./modules/assistant/AssistantTools.ts"
import { Budgets } from "./modules/assistant/Budgets.ts"
import { Cards } from "./modules/assistant/Cards.ts"
import { Conversations } from "./modules/assistant/Conversations.ts"
import { Titles } from "./modules/assistant/Titles.ts"
import { AuditLog } from "./modules/audit/AuditLog.ts"
import { Challenges } from "./modules/auth/Challenges.ts"
import { Sessions } from "./modules/auth/Sessions.ts"
import { WebAuthn } from "./modules/auth/WebAuthn.ts"
import { AutomationRunner } from "./modules/automations/AutomationRunner.ts"
import { AutomationRuns } from "./modules/automations/AutomationRuns.ts"
import { Automations } from "./modules/automations/Automations.ts"
import { FireAutomationLive } from "./modules/automations/FireAutomation.ts"
import { Judgments } from "./modules/automations/Judgments.ts"
import { NewsItems } from "./modules/automations/NewsItems.ts"
import { NewsWatcher } from "./modules/automations/watchers/NewsWatcher.ts"
import { PortfolioWatcher } from "./modules/automations/watchers/PortfolioWatcher.ts"
import { PriceWatcher } from "./modules/automations/watchers/PriceWatcher.ts"
import { ScheduleWatcher } from "./modules/automations/watchers/ScheduleWatcher.ts"
import { AnswerChatMessageLive, BotInteractionsLive, ChatHandlerLive } from "./modules/channels/BotHandlers.ts"
import { ChannelLinks } from "./modules/channels/ChannelLinks.ts"
import { ChatBot } from "./modules/channels/ChatBot.ts"
import { ChatNotifier } from "./modules/channels/ChatNotifier.ts"
import { TelegramConfig } from "./modules/channels/telegram/TelegramConfig.ts"
import { Transfers } from "./modules/funding/Transfers.ts"
import { Withdrawals } from "./modules/funding/Withdrawals.ts"
import { AgentExecutor } from "./modules/intents/AgentExecutor.ts"
import { DeskLive } from "./modules/intents/Desk.ts"
import { ExpireIntentsCron } from "./modules/intents/ExpireCron.ts"
import { Intents } from "./modules/intents/Intents.ts"
import { IntentStore } from "./modules/intents/IntentStore.ts"
import { AgentJournal } from "./modules/journal/AgentJournal.ts"
import { Knowledge } from "./modules/knowledge/Knowledge.ts"
import { KnowledgeRefreshCron } from "./modules/knowledge/RefreshCron.ts"
import { Ledger } from "./modules/ledger/Ledger.ts"
import { LedgerCron } from "./modules/ledger/LedgerCron.ts"
import { ReconcileCron } from "./modules/ledger/ReconcileCron.ts"
import { Reconciliation } from "./modules/ledger/Reconciliation.ts"
import { Charts } from "./modules/market/Charts.ts"
import { MarketPrices } from "./modules/market/MarketPrices.ts"
import { Quoter } from "./modules/market/Quoter.ts"
import { Stocks } from "./modules/market/Stocks.ts"
import { ConversationMemory } from "./modules/memory/ConversationMemory.ts"
import { MemoryDecayCron } from "./modules/memory/DecayCron.ts"
import { RecallEmbedCron } from "./modules/memory/EmbedCron.ts"
import { Memories } from "./modules/memory/Memories.ts"
import { MemoryExtractor } from "./modules/memory/MemoryExtractor.ts"
import { Recall } from "./modules/memory/Recall.ts"
import { RecallIndex } from "./modules/memory/RecallIndex.ts"
import { Deliveries, DeliverNotificationLive } from "./modules/notifications/Deliveries.ts"
import { DigestCron } from "./modules/notifications/DigestCron.ts"
import { NotificationFanout } from "./modules/notifications/Fanout.ts"
import { Notifications } from "./modules/notifications/Notifications.ts"
import { Notifiers } from "./modules/notifications/Notifiers.ts"
import { NotificationOutbox } from "./modules/notifications/Outbox.ts"
import { OutboxCron } from "./modules/notifications/OutboxCron.ts"
import { ReminderCron } from "./modules/notifications/ReminderCron.ts"
import { Reminders } from "./modules/notifications/Reminders.ts"
import { Drift } from "./modules/performance/Drift.ts"
import { DriftCron } from "./modules/performance/DriftCron.ts"
import { Performance } from "./modules/performance/Performance.ts"
import { SavedTemplates } from "./modules/policies/SavedTemplates.ts"
import { AccountBalances } from "./modules/portfolio/AccountBalances.ts"
import { PortfolioSnapshots } from "./modules/portfolio/PortfolioSnapshots.ts"
import { PortfolioSnapshotCron } from "./modules/portfolio/SnapshotCron.ts"
import { PushConfig } from "./modules/push/PushConfig.ts"
import { PushNotifier } from "./modules/push/PushNotifier.ts"
import { PushSubscriptions } from "./modules/push/PushSubscriptions.ts"
import { Recoveries } from "./modules/recovery/Recoveries.ts"
import { RecoveryKeys } from "./modules/recovery/RecoveryKeys.ts"
import { RecoveryOperations } from "./modules/recovery/RecoveryOperations.ts"
import { RecoveryStore } from "./modules/recovery/RecoveryStore.ts"
import { RpcProxy } from "./modules/rpc/RpcProxy.ts"
import { OwnerOperations } from "./modules/signing/OwnerOperations.ts"
import { SigningRequests } from "./modules/signing/SigningRequests.ts"
import { TradeLedger } from "./modules/trading/TradeLedger.ts"
import { Trades } from "./modules/trading/Trades.ts"
import { LiveEvents } from "./platform/live/LiveEvents.ts"
import { Namera } from "./platform/namera/Namera.ts"

/**
 * The schedules and watchers that sweep everyone's rows: crons, the automation watchers and the ledger's repair at
 * startup. Off when `SCHEDULES_ENABLED` is `false`: test servers share one database across workers, each on its own
 * chain, so a sweep from one would act on another's users; tests run each sweep for their own user instead.
 */
const Schedules = Layer.unwrap(Effect.gen(function*() {
  const enabled = yield* Config.Boolean("SCHEDULES_ENABLED").pipe(Config.withDefault(true))
  if (!enabled) return Layer.empty

  return Layer.mergeAll(
    ExpireIntentsCron,
    ExpireAgentsCron,
    PortfolioSnapshotCron,
    LedgerCron,
    ReconcileCron,
    DriftCron,
    Ledger.repairOnStart,
    RecallEmbedCron,
    MemoryDecayCron,
    PriceWatcher.watch,
    ScheduleWatcher.watch,
    PortfolioWatcher.watch,
    NewsWatcher.watch,
    ReminderCron,
    DigestCron,
    OutboxCron
  )
}))

/**
 * Every service of the app, wired to each other: what the HTTP handlers, the desk and the crons run on (`DevChain`
 * only answers on a local chain; the dev endpoints check the network first). Each line
 * provides the ones below it. Entrypoints and tests provide the rest: `AppConfig`, `Database`, `ChainClient`, the
 * chain's prices (`ReferencePrices`, uncached in tests), `Alpaca`, the assistant's models (`AssistantModels`), the
 * embedder (`Embeddings`), the chat router (`Chat`, with Telegram's adapter or `ChatTest`'s), the `HttpClient` push
 * services are reached with, and the durable engine.
 */
export const ServicesLive = Layer.mergeAll(
  DeskLive,
  Schedules,
  KnowledgeRefreshCron,
  Knowledge.refreshOnStart,
  FireAutomationLive,
  NotificationFanout.listen,
  DeliverNotificationLive,
  AnswerChatMessageLive,
  ChatHandlerLive,
  BotInteractionsLive
).pipe(
  Layer.provideMerge(Layer.mergeAll(ChatBot.layer, Deliveries.layer, Reminders.layer, NotificationFanout.layer)),
  Layer.provideMerge(Layer.mergeAll(Assistant.layer, Notifiers.layer)),
  Layer.provideMerge(Layer.mergeAll(PushNotifier.layer, ChatNotifier.layer)),
  Layer.provideMerge(
    Layer.mergeAll(PriceWatcher.layer, ScheduleWatcher.layer, PortfolioWatcher.layer, NewsWatcher.layer)
  ),
  Layer.provideMerge(AutomationRunner.layer),
  Layer.provideMerge(
    Layer.mergeAll(
      AssistantToolsLive,
      MemoryExtractor.layer,
      Titles.layer,
      ConversationMemory.layer,
      Judgments.layer,
      NewsItems.layer
    )
  ),
  Layer.provideMerge(Conversations.layer),
  Layer.provideMerge(Layer.mergeAll(Cards.layer, Budgets.layer)),
  Layer.provideMerge(Layer.mergeAll(Intents.layer, Memories.layer, Automations.layer, RecoveryKeys.layer, Drift.layer)),
  Layer.provideMerge(Recoveries.layer),
  Layer.provideMerge(
    Layer.mergeAll(Trades.layer, Withdrawals.layer, Agents.layer, AgentRequests.layer, Passkeys.layer)
  ),
  Layer.provideMerge(Layer.mergeAll(
    SigningRequests.layer,
    AgentStore.layer,
    AgentExecutor.layer,
    TradeLedger.layer,
    RecoveryOperations.layer,
    Reconciliation.layer,
    Performance.layer
  )),
  Layer.provideMerge(
    Layer.mergeAll(
      Accounts.layer,
      Sessions.layer,
      OwnerOperations.layer,
      RecoveryStore.layer,
      AgentSessions.layer,
      IntentStore.layer,
      Quoter.layer,
      Charts.layer,
      Stocks.layer,
      PortfolioSnapshots.layer,
      ChannelLinks.layer,
      Ledger.layer
    )
  ),
  Layer.provideMerge(
    Layer.mergeAll(
      MarketPrices.layer,
      AuditLog.layer,
      WebAuthn.layer,
      Challenges.layer,
      SavedTemplates.layer,
      Transfers.layer,
      Activity.layer,
      AutomationRuns.layer,
      Recall.layer,
      Knowledge.layer
    )
  ),
  Layer.provideMerge(Layer.mergeAll(AgentJournal.layer, Notifications.layer)),
  Layer.provideMerge(
    Layer.mergeAll(
      LiveEvents.layer,
      Namera.layer,
      AccountBalances.layer,
      DevChain.layer,
      RecallIndex.layer,
      PushSubscriptions.layer,
      PushConfig.layer,
      TelegramConfig.layer,
      NotificationOutbox.layer,
      RpcProxy.layer
    )
  )
)
