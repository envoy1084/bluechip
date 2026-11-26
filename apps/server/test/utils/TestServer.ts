// The API served over HTTP on this worker's devnet, as `ServerLive` serves it, with test layers at the edges.
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import type * as Chat from "effect/chat/Chat"
import type * as ChatAdapter from "effect/chat/ChatAdapter"
import * as ChatTest from "effect/chat/ChatTest"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"
import { ApiRoutes } from "../../src/Api.ts"
import { AppConfig } from "../../src/config/AppConfig.ts"
import { ReferencePrices } from "../../src/modules/market/ReferencePrices.ts"
import { Database } from "../../src/platform/db/Database.ts"
import { Embeddings } from "../../src/platform/embeddings/Embeddings.ts"
import { OriginCheckMiddleware } from "../../src/platform/http/OriginCheck.ts"
import { ServicesLive } from "../../src/Services.ts"
import { AlpacaTest } from "./AlpacaTest.ts"
import { EngineTest } from "./EngineTest.ts"
import { PushServiceTest } from "./PushServiceTest.ts"
import { RecordedModel } from "./RecordedModel.ts"
import { TestClocks } from "./TestClocks.ts"
import { TestConfig } from "./TestConfig.ts"

/**
 * Telegram as an in-memory chat (`ChatTest`) with the Telegram adapter's capabilities: buttons and commands, no
 * private answers to commands.
 */
export const TelegramTest = ChatTest.layer({
  platform: "telegram",
  capabilities: ["edit", "delete", "replyTo", "download", "getThread", "getUser", "buttons", "commands"]
})

/**
 * The API on a test server (`NodeHttpServer.layerTest`, a random port), with every service of the app, Alpaca's test
 * layer, the chain's prices read fresh each time (so a test that moves the chain's clock or a feed sees it at once),
 * the assistant on recorded models (`RecordedModel`) and the deterministic embedder, `chat` as the chat router
 * (`TelegramTest` unless a test runs Telegram's real adapter), push services in process (`PushServiceTest`), the
 * in-memory engine and the test database; the devnet's controls (`Devnet`, `DevChain`, `ChainClient`) come from the
 * devnet it is given. Provides an `HttpClient` that sends to the server and the database (for harness services that
 * read what tests can't ask the API).
 *
 * The server runs on the real clock: its engine, crons and the chain advance with time, so files using it build their
 * layer with `excludeTestServices`.
 */
const serve = <A, E, R>(chat: Layer.Layer<A | Chat.Chat | ChatAdapter.Registry, E, R>) =>
  HttpRouter.serve(Layer.mergeAll(ApiRoutes, OriginCheckMiddleware), {
    disableListenLog: true,
    disableLogger: true
  }).pipe(
    Layer.provideMerge(NodeHttpServer.layerTest),
    Layer.provideMerge(ServicesLive),
    Layer.provideMerge(Layer.mergeAll(RecordedModel.layer, Embeddings.layerTest, chat, PushServiceTest.layer)),
    Layer.provide(ReferencePrices.layerUncached),
    Layer.provide(Layer.merge(AlpacaTest, AppConfig.layer)),
    Layer.provideMerge(Database.layer),
    Layer.provideMerge(EngineTest),
    Layer.provide(TestConfig)
  )

/** The test server on the worker's shared devnet, with `chat` as the chat router. */
export const testServer = <A, E, R>(chat: Layer.Layer<A | Chat.Chat | ChatAdapter.Registry, E, R>) =>
  serve(chat).pipe(Layer.provideMerge(DevnetTest.layer))

/** The test server with Telegram in memory. */
export const TestServer = testServer(TelegramTest)

/**
 * The test server with Telegram in memory, on a devnet of the file's own (`DevnetTest.layerIsolated`), with clocks
 * that move ahead together (`TestClocks`): the chain's, the bundler's and the server's.
 */
export const IsolatedTestServer = serve(TelegramTest).pipe(
  Layer.provideMerge(TestClocks.layer),
  Layer.provideMerge(DevnetTest.layerIsolated)
)
