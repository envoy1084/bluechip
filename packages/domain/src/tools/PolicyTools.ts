/**
 * Tools over the policy catalog: what an agent can be made of, the templates to start from, a check of a draft, and
 * saving a set of policies as a template (configure, a card you confirm).
 *
 * @since 0.0.0
 */
import * as Tool from "effect/ai/Tool"
import * as Schema from "effect/Schema"
import { Card, describeCard } from "../assistant/Card.ts"
import { AgentId } from "../Ids.ts"
import { PolicyInfo, SpecCheck } from "../policies/Catalog.ts"
import { formatDollars, formatPercent } from "../policies/Format.ts"
import type { Field } from "../policies/Policy.ts"
import { SavedTemplate, TemplateInfo, TemplateName } from "../policies/Templates.ts"
import { Caller, ToolProblem } from "./Caller.ts"
import { Risk } from "./Risk.ts"
import { SpecDraft, SpecPatch } from "./SpecPatch.ts"
import { say } from "./Words.ts"

const range = (field: Field): string => {
  if (field.min === undefined || field.max === undefined) return ""
  switch (field.unit) {
    case "usd":
      return ` from ${formatDollars(field.min)} to ${formatDollars(field.max)}`
    case "bps":
      return ` from ${formatPercent(field.min)} to ${formatPercent(field.max)}`
    default:
      return ` from ${field.min} to ${field.max}`
  }
}

const settable: ReadonlyArray<string> = ["usd", "bps", "count", "toggle"]

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ListPolicies = Tool.make("listPolicies", {
  description: "The policy catalog: every policy an agent can carry, what it does, examples of what people ask for, " +
    "and its settings with their units and ranges (for the settings of draftAgent and changeAgentPolicies).",
  success: Schema.Array(PolicyInfo),
  failure: ToolProblem,
  failureMode: "return",
  toModelOutput: (policies) =>
    say(
      policies.filter((policy) => !policy.hidden).map((policy) =>
        [
          `${policy.id} (${policy.title}${policy.required ? ", every agent has it" : ""}): ${policy.summary}`,
          `  Asked as: ${policy.examples.join("; ")}`,
          ...policy.fields.filter(({ field }) => settable.includes(field.unit)).map(({ field, name }) =>
            `  ${name}: ${field.label}, ${field.unit}${range(field)}`
          )
        ].join("\n")
      )
    )
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ListTemplates = Tool.make("listTemplates", {
  description: "The templates an agent starts from: bluechip's built-in ones and the user's saved ones.",
  success: Schema.Struct({ builtIn: Schema.Array(TemplateInfo), saved: Schema.Array(SavedTemplate) }),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: ({ builtIn, saved }) =>
    say([
      ...builtIn.map((template) => `${template.id} (${template.title}): ${template.summary}`),
      ...saved.map((template) => `Saved: ${template.id} "${template.name}"`)
    ])
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const CheckAgentSpec = Tool.make("checkAgentSpec", {
  description: "Checks a new agent's draft, or changes to an existing agent, against the catalog: the problems to " +
    "fix, what it can and never does, and for changes whether they loosen or tighten its policies. Changes nothing.",
  parameters: Schema.Struct({
    agentId: Schema.NullOr(AgentId).annotate({ description: "The agent to change; null for a new agent." }),
    draft: Schema.NullOr(SpecDraft).annotate({ description: "A new agent's draft; null when changing an agent." }),
    changes: Schema.NullOr(SpecPatch).annotate({ description: "Changes to the agent; null for a new agent." })
  }),
  success: SpecCheck,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (check) =>
    say([
      check.problems.length === 0 ?
        "No problems." :
        `Problems: ${check.problems.map((problem) => `${problem.policy}: ${problem.message}`).join(" ")}`,
      `It can: ${check.description.can.join("; ")}.`,
      `It never: ${check.description.never.join("; ")}.`,
      ...(check.changes === null ? [] : [`Overall the change is ${check.changes.overall}.`])
    ])
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const SaveTemplate = Tool.make("saveTemplate", {
  description: "Shows a card to save a set of policies as a template (an existing agent's, or a draft), saved once " +
    "the user confirms.",
  parameters: Schema.Struct({
    name: TemplateName,
    agentId: Schema.NullOr(AgentId).annotate({ description: "Save this agent's policies; null to save a draft." }),
    draft: Schema.NullOr(SpecDraft).annotate({ description: "The draft to save; null when saving an agent's." })
  }),
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (card) => say(describeCard(card))
}).annotate(Risk, "configure")
