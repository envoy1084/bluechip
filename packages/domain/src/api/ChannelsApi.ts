/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Authentication } from "../Auth.ts"
import { ChannelLink, LinkCode, Platform } from "../channels/Channel.ts"
import { NotFound } from "../Errors.ts"
import { ChannelLinkId } from "../Ids.ts"

/**
 * Chats linked to your account: the linked chats, a one-time code to link one (send it to the bot; a new code
 * replaces the last), and unlinking one. Linking and unlinking are security notifications on every channel.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class ChannelsApi extends HttpApiGroup.make("channels").add(
  HttpApiEndpoint.get("links", "/channels", {
    success: Schema.Array(ChannelLink)
  }),
  HttpApiEndpoint.post("linkCode", "/channels/:platform/link-code", {
    params: { platform: Platform },
    success: LinkCode
  }),
  HttpApiEndpoint.delete("unlink", "/channels/links/:id", {
    params: { id: ChannelLinkId },
    success: Schema.Void,
    error: NotFound
  })
).middleware(Authentication) {}
