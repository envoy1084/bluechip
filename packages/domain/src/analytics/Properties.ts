/**
 * The properties analytics events share: who did something and where, the properties every event carries, and the
 * names no property may have.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"

/**
 * Who asked for a trade, in analytics' words: `you` (the owner), an `agent`'s own decision, an `automation`, the
 * `assistant` or `telegram`.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TradeSource = Schema.Literals(["you", "agent", "automation", "assistant", "telegram"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TradeSource = typeof TradeSource.Type

/**
 * Whose key signs: an agent's session key or the owner's passkey.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Executor = Schema.Literals(["agent", "owner"])

/**
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Side = Schema.Literals(["buy", "sell"])

/**
 * Where a person talked to bluechip.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Surface = Schema.Literals(["web", "telegram"])

/**
 * The deployment an event comes from. Analytics only runs on paper and production.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Environment = Schema.Literals(["paper", "production"])

/**
 * The properties every event carries, set by whoever sends it (the server's `Analytics`, the web's `track`), not by
 * the place that says what happened.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const CommonProperties = Schema.Struct({
  network: Schema.Literals(["sepolia", "base"]),
  environment: Environment,
  app_version: Schema.String,
  /** The server's trace, so an event opens its trace in Axiom. Server events only. */
  trace_id: Schema.optionalKey(Schema.String)
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type CommonProperties = typeof CommonProperties.Type

/**
 * Words no property name may contain: anything that could identify a person or their money outside bluechip, or
 * hold what they wrote (an address would let anyone reading analytics look up balances onchain).
 *
 * @stability unstable
 * @category privacy
 * @since 0.0.0
 */
export const FORBIDDEN_PROPERTY_WORDS: ReadonlyArray<string> = [
  "address",
  "email",
  "name",
  "balance",
  "key",
  "secret",
  "prompt",
  "password",
  "phone",
  "text",
  "message_body"
]

/**
 * Whether `property` is a name analytics never sends: it contains one of {@link FORBIDDEN_PROPERTY_WORDS} as a
 * snake_case word (`deposit_address`, `display_name`; not `symbol`).
 *
 * @stability unstable
 * @category privacy
 * @since 0.0.0
 */
export const isForbiddenProperty = (property: string): boolean => {
  const words = property.toLowerCase().split("_")
  return FORBIDDEN_PROPERTY_WORDS.some((forbidden) => {
    const parts = forbidden.split("_")
    return words.some((_, start) => parts.every((part, offset) => words[start + offset] === part))
  })
}
