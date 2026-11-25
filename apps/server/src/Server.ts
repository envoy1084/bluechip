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

/** Every HTTP route the server answers: health, the API under `/api`; auth (`/auth/*`) joins in phase 006. */
export const Routes = Layer.mergeAll(HealthRoutes, ApiRoutes, RequestIdMiddleware)

/** The server: routes, Node HTTP on `PORT`, the database, config and logging. */
export const ServerLive = HttpRouter.serve(Routes).pipe(
  Layer.provide(NodeHttpServer.layerConfig(createServer, { port: Config.Port("PORT").pipe(Config.withDefault(4000)) })),
  Layer.provide(Database.layer),
  Layer.provide(AppConfig.layer),
  Layer.provide(LoggingLive)
)
