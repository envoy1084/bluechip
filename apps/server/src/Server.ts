import { ChainClient } from "@bluechip/chain/ChainClient"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as Config from "effect/Config"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"
import { createServer } from "node:http"
import { ApiRoutes } from "./api/Api.ts"
import { AppConfig } from "./Config.ts"
import { Database } from "./db/Database.ts"
import { EngineLive } from "./engine/Engine.ts"
import { HealthRoutes } from "./http/Health.ts"
import { OriginCheckMiddleware } from "./http/OriginCheck.ts"
import { RequestIdMiddleware } from "./http/RequestId.ts"
import { LoggingLive } from "./Logging.ts"
import { Alpaca } from "./market/alpaca/Alpaca.ts"
import { ServicesLive } from "./Services.ts"

/** Every HTTP route the server answers: health and the API under `/api` (passkey auth included). */
export const Routes = Layer.mergeAll(HealthRoutes, ApiRoutes, RequestIdMiddleware, OriginCheckMiddleware)

/**
 * The server: routes, Node HTTP on `PORT`, the app's services (the desk and crons among them) on the durable engine,
 * the database, the chain, Alpaca, config and logging. Namera checks at startup that the bundler and paymaster work
 * together, and refuses to boot otherwise.
 */
export const ServerLive = HttpRouter.serve(Routes).pipe(
  Layer.provide(NodeHttpServer.layerConfig(createServer, {
    port: Config.Port("PORT").pipe(Config.withDefault(8080)),
    // Live streams never finish on their own; cut them quickly on shutdown so clients reconnect to the next process.
    gracefulShutdownTimeout: Config.succeed("2 seconds")
  })),
  Layer.provideMerge(ServicesLive),
  Layer.provide(Alpaca.layer),
  Layer.provide(EngineLive),
  Layer.provide(Database.layer),
  Layer.provide(ChainClient.layer),
  Layer.provide(AppConfig.layer),
  Layer.provide(LoggingLive)
)
