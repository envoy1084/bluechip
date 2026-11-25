import { DevChain } from "@bluechip/chain/DevChain"
import * as Layer from "effect/Layer"
import { Accounts } from "./modules/accounts/Accounts.ts"
import { Activity } from "./modules/activity/Activity.ts"
import { AgentRequests } from "./modules/agents/AgentRequests.ts"
import { Agents } from "./modules/agents/Agents.ts"
import { AgentSessions } from "./modules/agents/AgentSessions.ts"
import { AgentStore } from "./modules/agents/AgentStore.ts"
import { Assistant } from "./modules/assistant/Assistant.ts"
import { AssistantToolsLive } from "./modules/assistant/AssistantTools.ts"
import { Budgets } from "./modules/assistant/Budgets.ts"
import { Cards } from "./modules/assistant/Cards.ts"
import { Conversations } from "./modules/assistant/Conversations.ts"
import { Memories } from "./modules/assistant/Memories.ts"
import { MemoryExtractor } from "./modules/assistant/MemoryExtractor.ts"
import { AuditLog } from "./modules/audit/AuditLog.ts"
import { Challenges } from "./modules/auth/Challenges.ts"
import { Sessions } from "./modules/auth/Sessions.ts"
import { WebAuthn } from "./modules/auth/WebAuthn.ts"
import { Transfers } from "./modules/funding/Transfers.ts"
import { Withdrawals } from "./modules/funding/Withdrawals.ts"
import { AgentExecutor } from "./modules/intents/AgentExecutor.ts"
import { DeskLive } from "./modules/intents/Desk.ts"
import { ExpireIntentsCron } from "./modules/intents/ExpireCron.ts"
import { Intents } from "./modules/intents/Intents.ts"
import { IntentStore } from "./modules/intents/IntentStore.ts"
import { Charts } from "./modules/market/Charts.ts"
import { MarketPrices } from "./modules/market/MarketPrices.ts"
import { Quoter } from "./modules/market/Quoter.ts"
import { ReferencePrices } from "./modules/market/ReferencePrices.ts"
import { Stocks } from "./modules/market/Stocks.ts"
import { SavedTemplates } from "./modules/policies/SavedTemplates.ts"
import { AccountBalances } from "./modules/portfolio/AccountBalances.ts"
import { PortfolioSnapshots } from "./modules/portfolio/PortfolioSnapshots.ts"
import { PortfolioSnapshotCron } from "./modules/portfolio/SnapshotCron.ts"
import { OwnerOperations } from "./modules/signing/OwnerOperations.ts"
import { SigningRequests } from "./modules/signing/SigningRequests.ts"
import { TradeLedger } from "./modules/trading/TradeLedger.ts"
import { Trades } from "./modules/trading/Trades.ts"
import { LiveEvents } from "./platform/live/LiveEvents.ts"
import { Namera } from "./platform/namera/Namera.ts"

/**
 * Every service of the app, wired to each other: what the HTTP handlers, the desk and the crons run on (`DevChain`
 * only answers on a local chain; the dev endpoints check the network first). Each line
 * provides the ones below it. Entrypoints and tests provide the rest: `AppConfig`, `Database`, `ChainClient`, `Alpaca`,
 * the assistant's models (`AssistantModels`) and the durable engine.
 */
export const ServicesLive = Layer.mergeAll(DeskLive, ExpireIntentsCron, PortfolioSnapshotCron, Assistant.layer).pipe(
  Layer.provideMerge(Layer.mergeAll(AssistantToolsLive, MemoryExtractor.layer, Conversations.layer)),
  Layer.provideMerge(Layer.mergeAll(Cards.layer, Budgets.layer)),
  Layer.provideMerge(Layer.mergeAll(Intents.layer, Memories.layer)),
  Layer.provideMerge(Layer.mergeAll(Trades.layer, Withdrawals.layer, Agents.layer, AgentRequests.layer)),
  Layer.provideMerge(Layer.mergeAll(SigningRequests.layer, AgentStore.layer, AgentExecutor.layer, TradeLedger.layer)),
  Layer.provideMerge(
    Layer.mergeAll(
      Accounts.layer,
      OwnerOperations.layer,
      AgentSessions.layer,
      IntentStore.layer,
      Quoter.layer,
      Charts.layer,
      Stocks.layer,
      PortfolioSnapshots.layer
    )
  ),
  Layer.provideMerge(
    Layer.mergeAll(
      MarketPrices.layer,
      AuditLog.layer,
      WebAuthn.layer,
      Challenges.layer,
      Sessions.layer,
      SavedTemplates.layer,
      Transfers.layer,
      Activity.layer
    )
  ),
  Layer.provideMerge(
    Layer.mergeAll(LiveEvents.layer, Namera.layer, AccountBalances.layer, ReferencePrices.layer, DevChain.layer)
  )
)
