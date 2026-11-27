import { ChainClient } from "@bluechip/chain/ChainClient"
import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as Chat from "effect/chat/Chat"
import * as Config from "effect/Config"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"
import { createServer } from "node:http"
import { ApiRoutes } from "./Api.ts"
import { AppConfig } from "./config/AppConfig.ts"
import { LoggingLive } from "./config/Logging.ts"
import { Analytics } from "./modules/analytics/Analytics.ts"
import { AssistantModels } from "./modules/assistant/AssistantModels.ts"
import { TelegramLive } from "./modules/channels/telegram/Telegram.ts"
import { Alpaca } from "./modules/market/alpaca/Alpaca.ts"
import { ReferencePrices } from "./modules/market/ReferencePrices.ts"
import { Database } from "./platform/db/Database.ts"
import { Embeddings } from "./platform/embeddings/Embeddings.ts"
import { EngineLive } from "./platform/engine/Engine.ts"
import { CorsMiddleware } from "./platform/http/Cors.ts"
import { HealthRoutes } from "./platform/http/Health.ts"
import { OriginCheckMiddleware } from "./platform/http/OriginCheck.ts"
import { RequestIdMiddleware } from "./platform/http/RequestId.ts"
import { RequestTelemetryMiddleware } from "./platform/http/RequestTelemetry.ts"
import { TelemetryLive } from "./platform/telemetry/Telemetry.ts"
import { TelemetryProxyRoutes } from "./platform/telemetry/TelemetryProxy.ts"
import { ServicesLive } from "./Services.ts"

/**
 * Every HTTP route the server answers: health, the API under `/api` (passkey auth included) and the web app's
 * telemetry route (`/api/sync/*`), open to the web app's origin only (CORS, the origin check), every request measured.
 */
export const Routes = Layer.mergeAll(
  HealthRoutes,
  ApiRoutes,
  TelemetryProxyRoutes,
  RequestIdMiddleware,
  CorsMiddleware,
  OriginCheckMiddleware,
  RequestTelemetryMiddleware
)

/**
 * The server with its market data, the assistant's models and the embedder given: routes, Node HTTP on `PORT`, the app's services
 * (the desk and crons among them) on the durable engine, the Telegram bot when it has a token, the database, the chain,
 * config, telemetry (exported to Axiom on paper and production) and logging. Namera checks at
 * startup that the bundler and paymaster work together, and refuses to boot otherwise. The browser suite runs it with
 * fixed market data, recorded models and a route of its own (`test/stack/`).
 */
export const makeServer = <Out, E, RA = never, R = never>(
  adapters: Layer.Layer<Alpaca | AssistantModels | Embeddings | Out, E, RA>,
  routes: Layer.Layer<never, never, R> = Layer.empty as Layer.Layer<never, never, R>
) =>
  // No log line per request: failed requests are logged by `RequestTelemetryMiddleware`, the rest are in the traces.
  HttpRouter.serve(Layer.mergeAll(Routes, TelegramLive, routes), { disableLogger: true }).pipe(
    Layer.provide(NodeHttpServer.layerConfig(createServer, {
      port: Config.Port("PORT").pipe(Config.withDefault(8080)),
      // Live streams never finish on their own; cut them quickly on shutdown so clients reconnect to the next process.
      gracefulShutdownTimeout: Config.succeed("2 seconds")
    })),
    Layer.provideMerge(ServicesLive),
    Layer.provide(ReferencePrices.layer),
    Layer.provide(adapters),
    Layer.provide(Analytics.layer),
    Layer.provide(Layer.merge(Chat.layer, FetchHttpClient.layer)),
    Layer.provide(EngineLive),
    Layer.provide(Database.layer),
    Layer.provide(Layer.merge(ChainClient.layer, ChainDeployment.layer)),
    Layer.provide(AppConfig.layer),
    Layer.provide(TelemetryLive),
    Layer.provide(LoggingLive)
  )

/** The server on Alpaca's market data, Anthropic's models and Voyage's embeddings. */
export const ServerLive = makeServer(Layer.mergeAll(Alpaca.layer, AssistantModels.layer, Embeddings.layer))
