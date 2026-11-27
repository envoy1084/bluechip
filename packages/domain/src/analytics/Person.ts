/**
 * What analytics knows about a person, set by the server (the source of truth) on the events that change it: when
 * they joined and first did each thing, counts and ranges, never balances, addresses, names or anything they wrote.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { FundedBucket } from "./Buckets.ts"

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

/**
 * A person's properties, each optional: an event sets only the ones it changes (`$set`), and the `first_*` and
 * `signed_up_at` ones only once (`$set_once`). Times are ISO strings.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PersonProperties = Schema.Struct({
  signed_up_at: Schema.optionalKey(Schema.String),
  network: Schema.optionalKey(Schema.Literals(["local", "sepolia", "base"])),
  eligibility: Schema.optionalKey(Schema.Literals(["eligible", "us_person"])),
  has_funded: Schema.optionalKey(Schema.Boolean),
  first_funded_at: Schema.optionalKey(Schema.String),
  funded_bucket: Schema.optionalKey(FundedBucket),
  trades_count: Schema.optionalKey(Count),
  first_trade_at: Schema.optionalKey(Schema.String),
  agents_count: Schema.optionalKey(Count),
  active_agents_count: Schema.optionalKey(Count),
  first_agent_at: Schema.optionalKey(Schema.String),
  automations_count: Schema.optionalKey(Count),
  telegram_linked: Schema.optionalKey(Schema.Boolean),
  push_enabled: Schema.optionalKey(Schema.Boolean),
  passkeys_count: Schema.optionalKey(Count),
  has_recovery_passkey: Schema.optionalKey(Schema.Boolean),
  assistant_conversations_count: Schema.optionalKey(Count)
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PersonProperties = typeof PersonProperties.Type

/**
 * Every person property's name, for the privacy check.
 *
 * @stability unstable
 * @category catalog
 * @since 0.0.0
 */
export const PERSON_PROPERTIES: ReadonlyArray<string> = Object.keys(PersonProperties.fields)
