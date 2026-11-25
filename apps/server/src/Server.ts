import { ChainClient } from "@bluechip/chain/ChainClient"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as Config from "effect/Config"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"
import { createServer } from "node:http"
import { ApiRoutes } from "./Api.ts"
import { AppConfig } from "./config/AppConfig.ts"
import { LoggingLive } from "./config/Logging.ts"
import { AssistantModels } from "./modules/assistant/AssistantModels.ts"
import { Alpaca } from "./modules/market/alpaca/Alpaca.ts"
import { ReferencePrices } from "./modules/market/ReferencePrices.ts"
import { Database } from "./platform/db/Database.ts"
import { EngineLive } from "./platform/engine/Engine.ts"
import { HealthRoutes } from "./platform/http/Health.ts"
import { OriginCheckMiddleware } from "./platform/http/OriginCheck.ts"
import { RequestIdMiddleware } from "./platform/http/RequestId.ts"
import { ServicesLive } from "./Services.ts"

/** Every HTTP route the server answers: health and the API under `/api` (passkey auth included). */
export const Routes = Layer.mergeAll(HealthRoutes, ApiRoutes, RequestIdMiddleware, OriginCheckMiddleware)

/**
 * The server with its market data and the assistant's models given: routes, Node HTTP on `PORT`, the app's services
 * (the desk and crons among them) on the durable engine, the database, the chain, config and logging. Namera checks at
 * startup that the bundler and paymaster work together, and refuses to boot otherwise. The browser suite runs it with
 * fixed market data, recorded models and a route of its own (`test/stack/`).
 */
export const makeServer = <Out, E, R = never>(
  adapters: Layer.Layer<Alpaca | AssistantModels | Out, E>,
  routes: Layer.Layer<never, never, R> = Layer.empty as Layer.Layer<never, never, R>
) =>
  HttpRouter.serve(Layer.merge(Routes, routes)).pipe(
    Layer.provide(NodeHttpServer.layerConfig(createServer, {
      port: Config.Port("PORT").pipe(Config.withDefault(8080)),
      // Live streams never finish on their own; cut them quickly on shutdown so clients reconnect to the next process.
      gracefulShutdownTimeout: Config.succeed("2 seconds")
    })),
    Layer.provideMerge(ServicesLive),
    Layer.provide(ReferencePrices.layer),
    Layer.provide(adapters),
    Layer.provide(EngineLive),
    Layer.provide(Database.layer),
    Layer.provide(ChainClient.layer),
    Layer.provide(AppConfig.layer),
    Layer.provide(LoggingLive)
  )

/** The server on Alpaca's market data and Anthropic's models. */
export const ServerLive = makeServer(Layer.merge(Alpaca.layer, AssistantModels.layer))
