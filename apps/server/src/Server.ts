import { ChainClient } from "@bluechip/chain/ChainClient"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as Config from "effect/Config"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"
import { createServer } from "node:http"
import { Agents } from "./agents/Agents.ts"
import { SavedTemplates } from "./agents/SavedTemplates.ts"
import { ApiRoutes } from "./api/Api.ts"
import { AppConfig } from "./Config.ts"
import { Database } from "./db/Database.ts"
import { CronsLive } from "./engine/Crons.ts"
import { EngineLive } from "./engine/Engine.ts"
import { Withdrawals } from "./funding/Withdrawals.ts"
import { HealthRoutes } from "./http/Health.ts"
import { OriginCheckMiddleware } from "./http/OriginCheck.ts"
import { RequestIdMiddleware } from "./http/RequestId.ts"
import { DeskLive } from "./intents/Desk.ts"
import { Intents } from "./intents/Intents.ts"
import { LiveEvents } from "./live/LiveEvents.ts"
import { LoggingLive } from "./Logging.ts"
import { Alpaca } from "./market/alpaca/Alpaca.ts"
import { Charts } from "./market/Charts.ts"
import { MarketPrices } from "./market/MarketPrices.ts"
import { ReferencePrices } from "./market/ReferencePrices.ts"
import { Namera } from "./Namera.ts"
import { AccountBalances } from "./portfolio/AccountBalances.ts"
import { Trades } from "./trading/Trades.ts"

/** Every HTTP route the server answers: health and the API under `/api` (passkey auth included). */
export const Routes = Layer.mergeAll(HealthRoutes, ApiRoutes, RequestIdMiddleware, OriginCheckMiddleware)

/** The server: routes, Node HTTP on `PORT`, the durable engine and its crons, the database, the chain, Namera, config and logging. */
export const ServerLive = HttpRouter.serve(Routes).pipe(
  Layer.provide(NodeHttpServer.layerConfig(createServer, {
    port: Config.Port("PORT").pipe(Config.withDefault(8080)),
    // Live streams never finish on their own; cut them quickly on shutdown so clients reconnect to the next process.
    gracefulShutdownTimeout: Config.succeed("2 seconds")
  })),
  // Namera checks at startup that the bundler and paymaster work together, and refuses to boot otherwise.
  Layer.merge(Layer.mergeAll(CronsLive, DeskLive)),
  Layer.provide(Intents.layer),
  Layer.provide(Layer.mergeAll(Withdrawals.layer, Trades.layer, Agents.layer, Charts.layer)),
  Layer.provide(
    Layer.mergeAll(AccountBalances.layer, MarketPrices.layer, ReferencePrices.layer, Namera.layer, SavedTemplates.layer)
  ),
  Layer.provide(Alpaca.layer),
  Layer.provide(LiveEvents.layer),
  Layer.provide(EngineLive),
  Layer.provide(Database.layer),
  Layer.provide(ChainClient.layer),
  Layer.provide(AppConfig.layer),
  Layer.provide(LoggingLive)
)
