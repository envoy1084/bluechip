// A Bot API update with a message from a person in their private chat with the bot (its id is theirs), a command when
// the text starts with one.
export const telegramMessage = (chatId: number, text: string, updateId: number) => ({
  update_id: updateId,
  message: {
    message_id: updateId,
    date: 1_800_000_000,
    chat: { id: chatId, type: "private", first_name: "Sam" },
    from: { id: chatId, is_bot: false, first_name: "Sam" },
    text,
    ...(text.startsWith("/") ?
      { entities: [{ type: "bot_command", offset: 0, length: text.includes(" ") ? text.indexOf(" ") : text.length }] } :
      {})
  }
})
