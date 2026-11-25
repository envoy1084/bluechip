/**
 * The version of the HTTP contract. Bump it when a change breaks clients built against the previous one; clients send
 * it in the `x-contract-version` header and are told to reload on a mismatch.
 *
 * @since 0.0.0
 */
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import { ClientOutdated, Internal } from "./Errors.ts"

/**
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const ContractVersion = 1

/**
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const contractVersionHeader = "x-contract-version"

/**
 * Fails a request whose `x-contract-version` differs from {@link ContractVersion}. Requests without the header (curl,
 * the docs page) pass.
 *
 * @stability unstable
 * @category middleware
 * @since 0.0.0
 */
export class ContractCheck
  extends HttpApiMiddleware.Service<ContractCheck>()("@bluechip/domain/Contract/ContractCheck", {
    error: ClientOutdated
  })
{}

/**
 * Turns an unexpected failure (a defect) into {@link Internal} with the request id, so clients get a typed error and
 * the details stay in the server logs.
 *
 * @stability unstable
 * @category middleware
 * @since 0.0.0
 */
export class DefectReporting extends HttpApiMiddleware.Service<DefectReporting>()(
  "@bluechip/domain/Contract/DefectReporting",
  { error: Internal }
) {}
