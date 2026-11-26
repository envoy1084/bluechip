/**
 * Chat platforms linked to your account: a chat (Telegram today) where you talk to the same assistant as in the
 * app and receive notifications. A chat is linked with a one-time code shown in the app and sent to the bot, and
 * unlinked from either side.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { ChannelLinkId } from "../Ids.ts"

/**
 * The chat platforms bluechip talks on.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Platform = Schema.Literals(["telegram"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Platform = typeof Platform.Type

/**
 * How long a link code works, in minutes.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const LINK_CODE_MINUTES = 10

/**
 * A linked chat: the platform, the name the platform gives the person who linked it, and when.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class ChannelLink extends Schema.Class<ChannelLink>("@bluechip/domain/channels/Channel/ChannelLink")({
  id: ChannelLinkId,
  platform: Platform,
  /** The person's name on the platform, when it gives one. */
  name: Schema.NullOr(Schema.String),
  linkedAt: Schema.DateTimeUtc
}) {}

/**
 * A one-time code to send to the bot, its deep link (opens the chat with the code ready to send) and when it stops
 * working. `deepLink` is `null` when the platform isn't set up on this server.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class LinkCode extends Schema.Class<LinkCode>("@bluechip/domain/channels/Channel/LinkCode")({
  platform: Platform,
  code: Schema.String,
  /** The bot's handle, `@bluechip_market_bot`. */
  bot: Schema.NullOr(Schema.String),
  deepLink: Schema.NullOr(Schema.String),
  expiresAt: Schema.DateTimeUtc
}) {}

/**
 * The letters a link code uses: no 0/O or 1/I/L, so it reads back without mistakes.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

/**
 * The link code in a message sent to the bot, `/start CODE` or the code on its own, in any case and spacing; `null`
 * when the message isn't one.
 *
 * **Example** (The deep link's start message)
 *
 * ```ts import.meta.vitest
 * import { linkCodeIn } from "@bluechip/domain/channels/Channel"
 *
 * linkCodeIn("/start K7MQ2X9P") // => "K7MQ2X9P"
 * linkCodeIn("what's my balance?") // => null
 * ```
 *
 * @stability unstable
 * @category parsing
 * @since 0.0.0
 */
export const linkCodeIn = (text: string): string | null => {
  const match = /^(?:\/start(?:@\w+)?\s+)?([A-Za-z0-9]{8})$/.exec(text.trim().replaceAll("-", ""))
  if (match === null) return null
  const code = match[1]!.toUpperCase()
  return [...code].every((letter) => LINK_CODE_ALPHABET.includes(letter)) ? code : null
}
