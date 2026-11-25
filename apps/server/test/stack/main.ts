// The server as the browser suite (`apps/e2e`) runs it: the real server, on fixed market data (`AlpacaTest`) and the
// assistant's recorded models (`RecordedModel`), with one route of its own: `POST /e2e/replies` records the model's
// replies a test is about to ask for (a JSON array of `Reply`). Configured by the environment like `src/main.ts`.
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import { makeServer } from "../../src/Server.ts"
import { AlpacaTest } from "../utils/AlpacaTest.ts"
import { RecordedModel, type Reply } from "../utils/RecordedModel.ts"

const RepliesRoute = Layer.unwrap(Effect.gen(function*() {
  const recorded = yield* RecordedModel
  return HttpRouter.add("POST", "/e2e/replies", (request) =>
    Effect.gen(function*() {
      const replies = (yield* Effect.orDie(request.json)) as unknown as ReadonlyArray<Reply>
      yield* recorded.record(...replies)
      return HttpServerResponse.empty({ status: 204 })
    }))
}))

const adapters = Layer.merge(AlpacaTest, RecordedModel.layer)

NodeRuntime.runMain(Layer.launch(makeServer(adapters, RepliesRoute)))
