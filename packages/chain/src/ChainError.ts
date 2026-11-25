/**
 * @since 0.0.0
 */
import * as Data from "effect/Data"

/**
 * A call to the chain failed: the node is unreachable, it refused the request, or the call reverted.
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class ChainError extends Data.TaggedError("ChainError")<{
  readonly operation: string
  readonly cause: unknown
}> {}
