// The API served over HTTP on this worker's devnet, as `ServerLive` serves it, with test layers at the edges.
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"
import { ApiRoutes } from "../../src/Api.ts"
import { AppConfig } from "../../src/config/AppConfig.ts"
import { ReferencePrices } from "../../src/modules/market/ReferencePrices.ts"
import { Database } from "../../src/platform/db/Database.ts"
import { OriginCheckMiddleware } from "../../src/platform/http/OriginCheck.ts"
import { ServicesLive } from "../../src/Services.ts"
import { AlpacaTest } from "./AlpacaTest.ts"
import { EngineTest } from "./EngineTest.ts"
import { RecordedModel } from "./RecordedModel.ts"
import { TestConfig } from "./TestConfig.ts"

/**
 * The API on a test server (`NodeHttpServer.layerTest`, a random port), with every service of the app, Alpaca's test
 * layer, the chain's prices read fresh each time (so a test that moves the chain's clock or a feed sees it at once), the assistant on recorded models (`RecordedModel`), the in-memory engine, the test database and the devnet. Provides an `HttpClient` that sends to the server, and
 * the devnet's controls (`Devnet`, `DevChain`, `ChainClient`) for arranging the chain.
 *
 * The server runs on the real clock: its engine, crons and the chain advance with time, so files using it build their
 * layer with `excludeTestServices`.
 */
export const TestServer = HttpRouter.serve(Layer.mergeAll(ApiRoutes, OriginCheckMiddleware), {
  disableListenLog: true,
  disableLogger: true
}).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
  Layer.provideMerge(ServicesLive),
  Layer.provideMerge(RecordedModel.layer),
  Layer.provide(ReferencePrices.layerUncached),
  Layer.provide(Layer.mergeAll(AlpacaTest, Database.layer, AppConfig.layer)),
  Layer.provideMerge(EngineTest),
  Layer.provide(TestConfig),
  Layer.provideMerge(DevnetTest.layer)
)
