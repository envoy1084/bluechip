import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as AgUiServer from "effect/ai/AgUiServer"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Assistant } from "./Assistant.ts"
import { Budgets } from "./Budgets.ts"
import { Cards } from "./Cards.ts"
import { Conversations } from "./Conversations.ts"
import { Memories } from "./Memories.ts"

export const AssistantHandlers = HttpApiBuilder.group(
  BluechipApi,
  "assistant",
  Effect.fn(function*(handlers) {
    const assistant = yield* Assistant
    const conversations = yield* Conversations
    const cards = yield* Cards
    const memories = yield* Memories
    const budgets = yield* Budgets

    return handlers.handleAll({
      conversations: ({ query }) => CurrentUser.use((user) => conversations.list(user, query)),
      startConversation: ({ payload }) => CurrentUser.use((user) => conversations.start(user, payload)),
      conversation: ({ params }) => CurrentUser.use((user) => conversations.thread(user, params.id)),
      run: Effect.fnUntraced(function*({ payload }) {
        const events = yield* assistant.run(yield* CurrentUser, payload)
        return yield* AgUiServer.handler(() => events)({ payload })
      }),
      cancel: ({ params }) => CurrentUser.use((user) => assistant.cancel(user, params.id)),
      confirmCard: ({ params }) => CurrentUser.use((user) => cards.confirm(user, params.id)),
      dismissCard: ({ params }) => CurrentUser.use((user) => cards.dismiss(user, params.id)),
      memories: () => CurrentUser.use((user) => memories.list(user)),
      deleteMemory: ({ params }) => CurrentUser.use((user) => Effect.asVoid(memories.remove(user, params.id))),
      deleteMemories: () => CurrentUser.use((user) => memories.removeAll(user)),
      budget: () => CurrentUser.use((user) => budgets.today(user))
    })
  })
)
