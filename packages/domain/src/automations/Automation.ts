/**
 * An automation: a trigger, conditions and an action, each an entry of its catalog stored as `{ type, config }`,
 * with its settings, for one of your agents (or for your own trades). Automations only propose: every trade they
 * make is an intent the agent's onchain policies decide, or your Face ID. `checkAutomation` catches at setup what
 * could never run; `describeAutomation` says it in sentences before you confirm.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { AgentId, AutomationId, MessageId } from "../Ids.ts"
import type { StockSymbol } from "../market/Market.ts"
import type { AgentSpec } from "../policies/AgentSpec.ts"
import { ask } from "./actions/Ask.ts"
import { buy } from "./actions/Buy.ts"
import { notify } from "./actions/Notify.ts"
import { rebalance } from "./actions/Rebalance.ts"
import { sell, sellShare } from "./actions/Sell.ts"
import type { ConditionType } from "./Condition.ts"
import { holdingAtLeast } from "./conditions/HoldingAtLeast.ts"
import { judgment } from "./conditions/Judgment.ts"
import { all, any, not } from "./conditions/Logic.ts"
import { marketOpen, pricesFresh } from "./conditions/Market.ts"
import { priceAbove, priceBelow } from "./conditions/PriceLevel.ts"
import { timeWindow } from "./conditions/TimeWindow.ts"
import type { CheckContext, DescribeContext, EntryType, Field, FieldProblem } from "./Entry.ts"
import * as Settings from "./Settings.ts"
import type { TriggerType } from "./Trigger.ts"
import { drift } from "./triggers/Drift.ts"
import { news } from "./triggers/News.ts"
import { portfolioLevel } from "./triggers/PortfolioLevel.ts"
import { priceCross } from "./triggers/PriceCross.ts"
import { priceMove } from "./triggers/PriceMove.ts"
import { schedule } from "./triggers/Schedule.ts"

/**
 * Every trigger.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const TRIGGERS = [schedule, priceMove, priceCross, drift, portfolioLevel, news] as const

/**
 * Every condition.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const CONDITIONS = [
  marketOpen,
  pricesFresh,
  priceAbove,
  priceBelow,
  holdingAtLeast,
  timeWindow,
  all,
  any,
  not,
  judgment
] as const

/**
 * Every action.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const ACTIONS = [buy, sell, sellShare, rebalance, notify, ask] as const

/**
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Trigger = Schema.Union(TRIGGERS.map((trigger) => trigger.entry))

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Trigger = typeof Trigger.Type

/**
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Condition = Schema.Union(CONDITIONS.map((condition) => condition.entry))

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Condition = typeof Condition.Type

/**
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Action = Schema.Union(ACTIONS.map((action) => action.entry))

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Action = typeof Action.Type

type AnyEntry = EntryType<string, Schema.Codec<unknown>>

/**
 * The catalog's trigger for an entry.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const triggerOf = (entry: Trigger): TriggerType<string, Schema.Codec<unknown>> =>
  TRIGGERS.find((trigger) => trigger.type === entry.type)! as unknown as TriggerType<string, Schema.Codec<unknown>>

/**
 * The catalog's condition for an entry.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const conditionOf = (entry: Condition): ConditionType<string, Schema.Codec<unknown>> =>
  CONDITIONS.find((condition) => condition.type === entry.type)! as unknown as ConditionType<
    string,
    Schema.Codec<unknown>
  >

/**
 * The catalog's action for an entry.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const actionOf = (entry: Action): (typeof ACTIONS)[number] & AnyEntry =>
  ACTIONS.find((action) => action.type === entry.type)! as never

/**
 * An automation's name: 1 to 60 characters.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AutomationName = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(60))

/**
 * An automation before it is saved: from a form, the assistant or a template. `agentId` is the agent it trades
 * through; `null` proposes your own trades, each waiting for your Face ID.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AutomationDraft extends Schema.Class<AutomationDraft>(
  "@bluechip/domain/automations/Automation/AutomationDraft"
)({
  name: AutomationName,
  agentId: Schema.NullOr(AgentId),
  trigger: Trigger,
  conditions: Schema.Array(Condition),
  action: Action,
  settings: Settings.Settings
}) {}

/**
 * Where an automation is: `active` (watching), `paused` by you, `done` after its last fire, `expired` past its
 * expiry, `deleted`.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AutomationStatus = Schema.Literals(["active", "paused", "done", "expired", "deleted"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AutomationStatus = typeof AutomationStatus.Type

/**
 * Who set it up: you (a form), the assistant (you confirmed its card), or a template (with its agent).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const CreatedBy = Schema.Literals(["owner", "assistant", "template"])

/**
 * The automation in sentences: each part's phrase, the whole as one sentence, and its settings.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AutomationDescription extends Schema.Class<AutomationDescription>(
  "@bluechip/domain/automations/Automation/AutomationDescription"
)({
  sentence: Schema.String,
  trigger: Schema.String,
  conditions: Schema.Array(Schema.String),
  action: Schema.String,
  settings: Schema.Array(Schema.String)
}) {}

/**
 * A saved automation.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Automation extends Schema.Class<Automation>("@bluechip/domain/automations/Automation/Automation")({
  id: AutomationId,
  name: AutomationName,
  agentId: Schema.NullOr(AgentId),
  trigger: Trigger,
  conditions: Schema.Array(Condition),
  action: Action,
  settings: Settings.Settings,
  status: AutomationStatus,
  fires: Schema.Int,
  lastFiredAt: Schema.NullOr(Schema.DateTimeUtc),
  /** When a schedule runs next; `null` for other triggers. */
  nextRunAt: Schema.NullOr(Schema.DateTimeUtc),
  createdBy: CreatedBy,
  /** The assistant's message it came from, when it did. */
  createdFrom: Schema.NullOr(MessageId),
  description: AutomationDescription,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc
}) {}

/**
 * Why a draft can't be saved, as a sentence about one part (its index among the conditions) and one of its fields.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AutomationProblem extends Schema.Class<AutomationProblem>(
  "@bluechip/domain/automations/Automation/AutomationProblem"
)({
  part: Schema.Literals(["name", "trigger", "conditions", "action", "settings"]),
  index: Schema.NullOr(Schema.Int),
  field: Schema.NullOr(Schema.String),
  message: Schema.String
}) {}

/**
 * Whether the trades an automation makes wait for your approval: an `ask` action, or a trade started by news or a
 * judgment that the settings don't let act directly.
 *
 * @stability unstable
 * @category predicates
 * @since 0.0.0
 */
export const asksFirst = (draft: Pick<AutomationDraft, "trigger" | "conditions" | "action" | "settings">): boolean => {
  if (draft.action.type === "ask") return true
  if (draft.action.type === "notify") return false
  const unsure = triggerOf(draft.trigger).asks || draft.conditions.some((condition) => condition.type === "judgment")
  return unsure && !draft.settings.actDirectly
}

const rangeProblems = (entry: AnyEntry, config: unknown): ReadonlyArray<FieldProblem> =>
  Object.entries(entry.fields as Record<string, Field>).flatMap(([name, field]): ReadonlyArray<FieldProblem> => {
    const value = (config as Record<string, unknown>)[name]
    if (typeof value !== "number" && typeof value !== "bigint") return []
    if (field.min !== undefined && value < field.min) return [{ field: name, message: "Too small." }]
    if (field.max !== undefined && value > field.max) return [{ field: name, message: "Too large." }]
    return []
  })

/**
 * Every reason `draft` can't be saved for an agent with `spec` (`null`: your own trades); empty when it can. It
 * catches what the agent's policies could never pass (a sale for an agent that only buys, a buy over its daily
 * budget, drift without a target mix); the chain still decides every trade.
 *
 * **Example** (A sale for a Weekly buyer)
 *
 * ```ts import.meta.vitest
 * import { AutomationDraft, checkAutomation } from "@bluechip/domain/automations/Automation"
 * import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
 * import { draftSpec } from "@bluechip/domain/policies/Templates"
 *
 * const spec = draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA"], targets: [] })
 * const draft = new AutomationDraft({
 *   name: "Stop loss",
 *   agentId: null,
 *   trigger: { type: "priceMove", config: { symbol: "NVDA", reference: "trailingHigh", bps: 1000, direction: "down" } },
 *   conditions: [],
 *   action: { type: "sellShare", config: { symbol: "NVDA", bps: 5000 } },
 *   settings: DEFAULT_SETTINGS
 * })
 * checkAutomation(draft, spec)[0]?.message // => "This agent only buys."
 * ```
 *
 * @stability unstable
 * @category validation
 * @since 0.0.0
 */
export const checkAutomation = (draft: AutomationDraft, spec: AgentSpec | null): ReadonlyArray<AutomationProblem> => {
  const context: CheckContext = { spec, trigger: draft.trigger.type, asking: asksFirst(draft) }
  const problems: Array<AutomationProblem> = []
  const add = (part: AutomationProblem["part"], index: number | null, found: ReadonlyArray<FieldProblem>) =>
    found.forEach(({ field, message }) => problems.push(new AutomationProblem({ part, index, field, message })))

  if (draft.name.trim().length === 0) add("name", null, [{ field: null, message: "Give it a name." }])

  const trigger = triggerOf(draft.trigger)
  add("trigger", null, [
    ...rangeProblems(trigger, draft.trigger.config),
    ...trigger.check(draft.trigger.config, context)
  ])

  draft.conditions.forEach((entry, index) => {
    const condition = conditionOf(entry)
    add("conditions", index, [...rangeProblems(condition, entry.config), ...condition.check(entry.config, context)])
  })

  const action = actionOf(draft.action)
  add("action", null, [...rangeProblems(action, draft.action.config), ...action.check(draft.action.config, context)])

  const quiet = draft.settings.quietHours
  if (quiet !== null && quiet.from === quiet.to) {
    add("settings", null, [{ field: "quietHours", message: "Pick a different end for the quiet hours." }])
  }
  return problems
}

const describeOf = (
  entry: { readonly type: string; readonly config: unknown },
  kind: AnyEntry,
  name: DescribeContext
) => kind.describe(entry.config, name)

const capitalize = (text: string) => text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1)

/**
 * The automation in sentences, naming stocks with `name`: "Every Monday at 10:00 New York time, buy $50 of Apple."
 *
 * **Example** (A weekly buy)
 *
 * ```ts import.meta.vitest
 * import { AutomationDraft, describeAutomation } from "@bluechip/domain/automations/Automation"
 * import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
 *
 * const draft = new AutomationDraft({
 *   name: "Weekly Apple",
 *   agentId: null,
 *   trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
 *   conditions: [],
 *   action: { type: "buy", config: { amount: 50_000_000n, split: [{ symbol: "AAPL", weight: 10_000 }] } },
 *   settings: DEFAULT_SETTINGS
 * } as never)
 * describeAutomation(draft, () => "Apple").sentence // => "Every Monday at 10:00 New York time, buy $50 of Apple."
 * ```
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const describeAutomation = (
  draft: Pick<AutomationDraft, "trigger" | "conditions" | "action" | "settings">,
  name: (symbol: StockSymbol) => string
): AutomationDescription => {
  const context: DescribeContext = { name }
  const trigger = triggerOf(draft.trigger)
  const triggerPhrase = describeOf(draft.trigger, trigger, context)
  const conditions = draft.conditions.map((entry) => describeOf(entry, conditionOf(entry), context))
  const plain = describeOf(draft.action, actionOf(draft.action), context)
  const action = asksFirst(draft) && draft.action.type !== "ask" ? `ask you whether to ${plain}` : plain
  return new AutomationDescription({
    sentence: `${capitalize([triggerPhrase, ...conditions, action].join(", "))}.`,
    trigger: triggerPhrase,
    conditions,
    action,
    settings: Settings.describeSettings(draft.settings, trigger)
  })
}
