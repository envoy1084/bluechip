/**
 * The `anyCall` policy: Namera's allow policy as the session's fallback action, so calls need no action policy each.
 * Set by bluechip: the trade policy checks every call of every operation more strictly than an allowlist would, and
 * each action would cost the lock a session entry.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import * as Policy from "./Policy.ts"

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const anyCall = Policy.make({
  id: "anyCall",
  kind: "namera",
  title: "Calls",
  summary: "Lets the trade policy, not a list of calls, decide what each operation may call.",
  aliases: [],
  examples: [],
  config: Schema.Struct({}),
  fields: {},
  required: true,
  hidden: true,
  defaults: {},
  describe: () => ({ can: [], never: [] }),
  compare: () => "same"
})
