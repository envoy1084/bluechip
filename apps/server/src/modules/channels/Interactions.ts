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

/** Pauses every agent, from a notification of their trades: the kill switch in a chat. */
export const PauseAll = ChatInteraction.button("pauseAll", {
  label: "Pause all agents",
  style: "danger",
  value: Schema.String
})

/** Cancels the account's recovery waiting out its delay, from its notification. */
export const CancelRecovery = ChatInteraction.button("cancelRecovery", {
  label: "Cancel recovery",
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
  ChatInteraction.command("cancel_recovery", { description: "Cancel a recovery of your account you didn't ask for" }),
  ChatInteraction.command("unlink", { description: "Unlink this chat from your account" }),
  ChatInteraction.command("help", { description: "What this bot can do" })
] as const

/** Everything a chat can click or type to the bot. */
export const BotInteractions = ChatInteraction.group(
  ConfirmCard,
  CancelCard,
  PauseAgent,
  PauseAll,
  CancelRecovery,
  ...Commands
)
