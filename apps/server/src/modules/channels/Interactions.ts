import * as ChatInteraction from "effect/chat/ChatInteraction"
import * as Schema from "effect/Schema"

/** Applies a card that waits for you (its id): the chat's Confirm. */
export const ConfirmCard = ChatInteraction.button("confirm", {
  label: "Confirm",
  style: "primary",
  value: Schema.String
})

/** Dismisses a card that waits for you (its id). */
export const CancelCard = ChatInteraction.button("cancel", { label: "Cancel", value: Schema.String })

/** Pauses an agent (its id) from `/pause`. */
export const PauseAgent = ChatInteraction.button("pauseAgent", {
  label: "Pause",
  style: "danger",
  value: Schema.String
})

/** The bot's commands, as Telegram's menu lists them. */
export const Commands = [
  ChatInteraction.command("start", { description: "Link this chat with the code from bluechip" }),
  ChatInteraction.command("portfolio", { description: "Your cash, stocks and total value" }),
  ChatInteraction.command("agents", { description: "Your agents and how they stand" }),
  ChatInteraction.command("pause", { description: "Pause one agent" }),
  ChatInteraction.command("pause_all", { description: "Pause every agent at once" }),
  ChatInteraction.command("unlink", { description: "Unlink this chat from your account" }),
  ChatInteraction.command("help", { description: "What this bot can do" })
] as const

/** Everything a chat can click or type to the bot. */
export const BotInteractions = ChatInteraction.group(ConfirmCard, CancelCard, PauseAgent, ...Commands)
