import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { ChannelLinks } from "./ChannelLinks.ts"

export const ChannelsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "channels",
  Effect.fn(function*(handlers) {
    const links = yield* ChannelLinks

    return handlers.handleAll({
      links: () => CurrentUser.use((user) => links.list(user.id)),
      linkCode: ({ params }) => CurrentUser.use((user) => links.createCode(user.id, params.platform)),
      unlink: ({ params }) => CurrentUser.use((user) => links.unlink(user.id, params.id))
    })
  })
)
