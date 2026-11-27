/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Authentication } from "../Auth.ts"
import { FaucetLimitReached, Forbidden, InvalidRequest, Unavailable } from "../Errors.ts"
import { Usdc } from "../market/Units.ts"
import { FaucetAllowance, FaucetGrant } from "../paper/Faucet.ts"

/**
 * Test money where money is pretend (paper money on Base Sepolia, the local chain): `GET /api/faucet` is what the
 * signed-in account can still get today, `POST /api/faucet` sends it `amount` of test USDC. On Base both answer
 * `Forbidden`.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class FaucetApi extends HttpApiGroup.make("faucet").add(
  HttpApiEndpoint.get("allowance", "/faucet", {
    success: FaucetAllowance,
    error: Forbidden
  }),
  HttpApiEndpoint.post("claim", "/faucet", {
    payload: Schema.Struct({ amount: Usdc }),
    success: FaucetGrant,
    error: [Forbidden, InvalidRequest, FaucetLimitReached, Unavailable]
  })
).middleware(Authentication) {}
