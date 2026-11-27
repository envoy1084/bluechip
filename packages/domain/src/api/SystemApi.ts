/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"

/**
 * What the server runs: its release, its contract version, the network it runs against (`local`, `sepolia` for
 * paper money, or `base`; a web app built for another refuses it) and its clock.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export class ServerVersion extends Schema.Class<ServerVersion>("@bluechip/domain/api/SystemApi/ServerVersion")({
  version: Schema.String,
  contract: Schema.Int,
  network: Schema.Literals(["local", "sepolia", "base"]),
  serverTime: Schema.DateTimeUtc
}) {}

/**
 * `GET /api/version`.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class SystemApi extends HttpApiGroup.make("system").add(
  HttpApiEndpoint.get("version", "/version", { success: ServerVersion })
) {}
