import { ChainClient } from "@bluechip/chain/ChainClient"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as Config from "effect/Config"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"
import { createServer } from "node:http"
import { ApiRoutes } from "./api/Api.ts"
import { AppConfig } from "./Config.ts"
import { Database } from "./db/Database.ts"
import { HealthRoutes } from "./http/Health.ts"
import { RequestIdMiddleware } from "./http/RequestId.ts"
import { LoggingLive } from "./Logging.ts"
import { Namera } from "./Namera.ts"

/** Every HTTP route the server answers: health, the API under `/api`; auth (`/auth/*`) joins in phase 006. */
export const Routes = Layer.mergeAll(HealthRoutes, ApiRoutes, RequestIdMiddleware)

/** The server: routes, Node HTTP on `PORT`, the database, the chain, Namera, config and logging. */
export const ServerLive = HttpRouter.serve(Routes).pipe(
  // Built at startup even before a route needs it, so a bundler and paymaster that cannot work together stop boot.
  Layer.merge(Namera.layer.pipe(Layer.provide(ChainClient.layer))),
  Layer.provide(NodeHttpServer.layerConfig(createServer, {
    port: Config.Port("PORT").pipe(Config.withDefault(4000)),
    // Live streams never finish on their own; cut them quickly on shutdown so clients reconnect to the next process.
    gracefulShutdownTimeout: Config.succeed("2 seconds")
  })),
  Layer.provide(Database.layer),
  Layer.provide(AppConfig.layer),
  Layer.provide(LoggingLive)
)
