/**
 * The `notify` action: tells you, with an optional message, and trades nothing.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import * as Action from "../Action.ts"
import { Field } from "../Entry.ts"

/**
 * @stability unstable
 * @category actions
 * @since 0.0.0
 */
export const notify = Action.make({
  type: "notify",
  title: "Tell me",
  summary: "Tells you, and trades nothing.",
  aliases: ["alert me", "let me know", "remind me", "notify"],
  examples: ["tell me when NVIDIA falls under $150"],
  config: Schema.Struct({ message: Schema.String.check(Schema.isMaxLength(200)) }),
  fields: { message: new Field({ label: "Message", unit: "text" }) },
  defaults: { message: "" },
  describe: (config) => config.message.trim() === "" ? "tell you" : `tell you: ${config.message.trim()}`,
  plan: null
})
