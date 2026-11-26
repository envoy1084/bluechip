/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Authentication } from "../Auth.ts"
import { NotFound } from "../Errors.ts"
import { PushSubscriptionId } from "../Ids.ts"
import { NewPushSubscription, PushDevice } from "../push/Push.ts"

/**
 * Web push, per device: the server's VAPID public key (`null` when push isn't set up on this server), the devices
 * that opted in, opting a device in (its subscription; the same endpoint again replaces it) and out.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class PushApi extends HttpApiGroup.make("push").add(
  HttpApiEndpoint.get("key", "/push/key", {
    success: Schema.Struct({ publicKey: Schema.NullOr(Schema.String) })
  }),
  HttpApiEndpoint.get("devices", "/push/devices", {
    success: Schema.Array(PushDevice)
  }),
  HttpApiEndpoint.post("subscribe", "/push/devices", {
    payload: NewPushSubscription,
    success: PushDevice
  }),
  HttpApiEndpoint.delete("unsubscribe", "/push/devices/:id", {
    params: { id: PushSubscriptionId },
    success: Schema.Void,
    error: NotFound
  })
).middleware(Authentication) {}
