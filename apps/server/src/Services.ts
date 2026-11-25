import * as Layer from "effect/Layer"
import { Accounts } from "./accounts/Accounts.ts"
import { Activity } from "./activity/Activity.ts"
import { AgentRequests } from "./agents/AgentRequests.ts"
import { Agents } from "./agents/Agents.ts"
import { AgentSessions } from "./agents/AgentSessions.ts"
import { AgentStore } from "./agents/AgentStore.ts"
import { SavedTemplates } from "./agents/SavedTemplates.ts"
import { AuditLog } from "./audit/AuditLog.ts"
import { Challenges } from "./auth/Challenges.ts"
import { Sessions } from "./auth/Sessions.ts"
import { WebAuthn } from "./auth/WebAuthn.ts"
import { CronsLive } from "./engine/Crons.ts"
import { Transfers } from "./funding/Transfers.ts"
import { Withdrawals } from "./funding/Withdrawals.ts"
import { AgentExecutor } from "./intents/AgentExecutor.ts"
import { DeskLive } from "./intents/Desk.ts"
import { Intents } from "./intents/Intents.ts"
import { IntentStore } from "./intents/IntentStore.ts"
import { LiveEvents } from "./live/LiveEvents.ts"
import { Charts } from "./market/Charts.ts"
import { MarketPrices } from "./market/MarketPrices.ts"
import { Quoter } from "./market/Quoter.ts"
import { ReferencePrices } from "./market/ReferencePrices.ts"
import { Namera } from "./Namera.ts"
import { AccountBalances } from "./portfolio/AccountBalances.ts"
import { PortfolioSnapshots } from "./portfolio/PortfolioSnapshots.ts"
import { OwnerOperations } from "./signing/OwnerOperations.ts"
import { SigningRequests } from "./signing/SigningRequests.ts"
import { TradeLedger } from "./trading/TradeLedger.ts"
import { Trades } from "./trading/Trades.ts"

/**
 * Every service of the app, wired to each other: what the HTTP handlers, the desk and the crons run on. Each line
 * provides the ones below it. Entrypoints and tests provide the rest: `AppConfig`, `Database`, `ChainClient`, `Alpaca`
 * and the durable engine.
 */
export const ServicesLive = Layer.mergeAll(DeskLive, CronsLive).pipe(
  Layer.provideMerge(Intents.layer),
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
  Layer.provideMerge(Layer.mergeAll(LiveEvents.layer, Namera.layer, AccountBalances.layer, ReferencePrices.layer))
)
