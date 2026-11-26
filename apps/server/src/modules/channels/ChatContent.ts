import type { ChatReply } from "@bluechip/domain/channels/ChatCards"
import * as ChatUi from "effect/chat/ChatUi"
import { CancelCard, CancelRecovery, ConfirmCard, PauseAll } from "./Interactions.ts"

/**
 * A reply as a chat message's content: its Markdown, Confirm and Cancel for a card that waits, a notification's own
 * buttons (pause all, cancel a recovery), and its links into the app as link buttons. Chat apps refuse buttons to a
 * local address, so off `https` the links go in the text.
 */
export const chatContent = (reply: ChatReply, origin: string) => {
  const linkable = origin.startsWith("https://")
  const url = (path: string) => new URL(path, origin).toString()
  const textLinks = linkable ?
    [] :
    reply.actions.flatMap((action) => action._tag === "Open" ? [`${action.label}: ${url(action.path)}`] : [])
  return {
    markdown: [reply.markdown, ...textLinks].join("\n\n"),
    actions: reply.actions.flatMap((action): ReadonlyArray<ChatUi.Action> => {
      switch (action._tag) {
        case "Answer":
          return [ConfirmCard.of(action.cardId), CancelCard.of(action.cardId)]
        case "PauseAll":
          return [PauseAll.of("all")]
        case "CancelRecovery":
          return [CancelRecovery.of("latest")]
        case "Open":
          return linkable ? [ChatUi.linkButton({ label: action.label, url: url(action.path) })] : []
      }
    })
  }
}
