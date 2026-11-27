/**
 * Tools over automations: listing them (read), drafting one from the user's words or changing one (configure, a card
 * reading it back in sentences that the user confirms), and pausing or resuming one (configure). Automations only
 * propose trades: the agent's onchain policies, or the user's Face ID, still decide each one.
 *
 * @since 0.0.0
 */
import * as Tool from "effect/ai/Tool"
import * as Schema from "effect/Schema"
import { Card, describeCard } from "../assistant/Card.ts"
import { Action, Automation, AutomationName, Condition, Trigger } from "../automations/Automation.ts"
import { Settings } from "../automations/Settings.ts"
import { Caller, ToolProblem } from "./Caller.ts"
import { AgentIdParam, AutomationIdParam } from "./Params.ts"
import { Risk } from "./Risk.ts"
import { say } from "./Words.ts"

/**
 * An automation as the model drafts it: the catalogs' entries, `{ type, config }` each.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AutomationDraftParam = Schema.Struct({
  name: AutomationName.annotate({ description: "A short name, as the user would call it." }),
  agentId: Schema.NullOr(AgentIdParam).annotate({
    description: "The agent it trades through; null to propose the user's own trades (each needs their Face ID)."
  }),
  trigger: Trigger,
  conditions: Schema.Array(Condition).annotate({ description: "Checked in order when it fires; often empty." }),
  action: Action,
  settings: Settings.annotate({
    description: "cooldownMinutes 60, maxFires null, expiresAt null, quietHours null, marketHoursOnly null and " +
      "actDirectly false unless the user asks otherwise."
  })
})

const UNITS = "Amounts are in USDC units (1 dollar = 1000000), percentages in basis points (1% = 100, half = 5000), " +
  "prices per share in dollars times 100000000, written as strings of digits."

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ListAutomations = Tool.make("listAutomations", {
  description: "The user's automations (all, or one agent's): id, name, status and what each does in a sentence.",
  parameters: Schema.Struct({
    agentId: Schema.NullOr(AgentIdParam).annotate({ description: "Only this agent's; null for all." })
  }),
  success: Schema.Array(Automation),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (automations) =>
    say(
      automations.length === 0 ?
        "The user has no automations." :
        automations.map((automation) =>
          `${automation.id} "${automation.name}" (${automation.status}, ` +
          `${automation.agentId === null ? "your own trades" : `agent ${automation.agentId}`}): ` +
          automation.description.sentence
        )
    )
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const CreateAutomation = Tool.make("createAutomation", {
  description: "Drafts an automation from the user's words (a trigger, conditions and an action from the catalogs, " +
    "with settings) and returns it read back in a sentence: say that sentence to the user. Saved only when they " +
    "confirm. To change a saved automation (\"make it 8%\"), pass its automationId with the whole changed draft; to " +
    `change one not confirmed yet, call this again with the new draft. ${UNITS} If the draft has problems, this says ` +
    "which: fix them or ask the user. News and judgment conditions ask the user before trading unless they say " +
    "to act directly.",
  parameters: Schema.Struct({
    draft: AutomationDraftParam,
    automationId: Schema.NullOr(AutomationIdParam).annotate({
      description: "The saved automation this changes; null for a new one."
    })
  }),
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (card) => say(describeCard(card))
}).annotate(Risk, "configure")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const PauseAutomation = Tool.make("pauseAutomation", {
  description: "Asks the user to confirm pausing an automation (or resuming a paused one); applied once they " +
    "confirm. A paused automation fires nothing.",
  parameters: Schema.Struct({
    automationId: AutomationIdParam,
    resume: Schema.Boolean.annotate({ description: "true to resume a paused automation, false to pause it." })
  }),
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (card) => say(describeCard(card))
}).annotate(Risk, "configure").annotate(Tool.Strict, true)
