// The mock API: `BluechipApi` served in the browser from the preview world, as a fetch handler.
import { BluechipApi } from "@bluechip/domain/Api"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import * as Layer from "effect/Layer"
import type { PreviewStore } from "../store.ts"
import { AccountGroupsLive } from "./account.ts"
import { AgentsGroupsLive } from "./agents.ts"
import { AssistantGroupsLive } from "./assistant.ts"
import { EventsHandlers, MiddlewareLive, SystemHandlers } from "./core.ts"
import { MarketGroupsLive } from "./market.ts"
import { Preview } from "./Preview.ts"

/** `fetch` for `/api/*`, answered from `store`'s world. */
export const mockApi = (store: PreviewStore) => {
  const groups = Layer.mergeAll(
    SystemHandlers,
    EventsHandlers,
    AccountGroupsLive,
    MarketGroupsLive,
    AgentsGroupsLive,
    AssistantGroupsLive
  )
  const app = HttpApiBuilder.layer(BluechipApi).pipe(
    Layer.provide(groups),
    Layer.provide(MiddlewareLive),
    Layer.provide(Layer.succeed(Preview, store)),
    Layer.provide(HttpServer.layerServices)
  )
  return HttpRouter.toWebHandler(app, { disableLogger: true })
}
