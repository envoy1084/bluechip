// The server as the browser suite (`apps/e2e`) runs it: the real server, on market data at the devnet's prices
// (`AlpacaFromChain`) and the assistant's recorded models (`RecordedModel`), with routes of its own for what a
// browser can't arrange:
//
// - `POST /e2e/replies` records the model's replies a test is about to ask for (a JSON array of `Reply`).
// - `POST /e2e/expire` runs the agents' expiry cron for one user (`{ userId, at }`) as if the server's clock read `at`
//   (ISO 8601), the way `AgentExpiry.test.ts` does: a session lasts 90 days.
//
// With `BLUECHIP_E2E_LIVE=1` the assistant runs on Anthropic's models instead (`ANTHROPIC_API_KEY`), for the suite's
// opt-in live smoke test, and replies can't be recorded. Configured by the environment like `src/main.ts`.
import type { UserId } from "@bluechip/domain/Ids"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as TestClock from "effect/testing/TestClock"
import { Agents } from "../../src/modules/agents/Agents.ts"
import { AssistantModels } from "../../src/modules/assistant/AssistantModels.ts"
import { makeServer } from "../../src/Server.ts"
import { RecordedModel, type Reply } from "../utils/RecordedModel.ts"
import { AlpacaFromChain } from "./AlpacaFromChain.ts"

const RepliesRoute = Layer.unwrap(Effect.gen(function*() {
  const recorded = yield* RecordedModel
  return HttpRouter.add("POST", "/e2e/replies", (request) =>
    Effect.gen(function*() {
      const replies = (yield* Effect.orDie(request.json)) as unknown as ReadonlyArray<Reply>
      yield* recorded.record(...replies)
      return HttpServerResponse.empty({ status: 204 })
    }))
}))

const ExpireRoute = Layer.unwrap(Effect.gen(function*() {
  const agents = yield* Agents
  return HttpRouter.add("POST", "/e2e/expire", (request) =>
    Effect.gen(function*() {
      const { at, userId } = (yield* Effect.orDie(request.json)) as unknown as {
        readonly userId: UserId
        readonly at: string
      }
      yield* Effect.gen(function*() {
        yield* TestClock.setTime(new Date(at).getTime())
        yield* agents.expire({ userId })
      }).pipe(Effect.provide(TestClock.layer()))
      return HttpServerResponse.empty({ status: 204 })
    }))
}))

const server = process.env["BLUECHIP_E2E_LIVE"] === "1" ?
  makeServer(Layer.merge(AlpacaFromChain, AssistantModels.layer), ExpireRoute) :
  makeServer(Layer.merge(AlpacaFromChain, RecordedModel.layer), Layer.merge(RepliesRoute, ExpireRoute))

NodeRuntime.runMain(Layer.launch(server))
