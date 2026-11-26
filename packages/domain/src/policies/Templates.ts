/**
 * Ready-made agents: each template is a set of policies with defaults, and three presets set its amounts, so nobody
 * faces a page of sliders first. A template is only a starting point: the spec it drafts can be changed like any
 * other, and `checkSpec` decides what can be locked.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { SavedTemplateId } from "../Ids.ts"
import type { StockSymbol } from "../market/Market.ts"
import { Usdc } from "../market/Units.ts"
import { AgentSpec, type PolicyEntry, PolicyId } from "./AgentSpec.ts"
import { complete } from "./Catalog.ts"
import { dollars } from "./Format.ts"
import type { Target } from "./Rebalance.ts"
import { Direction } from "./Trade.ts"

/**
 * The agents bluechip offers: a Rebalancer keeps your target mix, a Stock picker trades a few stocks both ways, a
 * Weekly buyer buys on a schedule, and a Stop-loss guard only sells.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TemplateId = Schema.Literals(["stockPicker", "weeklyBuyer", "stopLossGuard", "rebalancer"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TemplateId = typeof TemplateId.Type

/**
 * The three starting points: small and careful, the one most people start with, and more room that is still capped.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Preset = Schema.Literals(["conservative", "balanced", "active"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Preset = typeof Preset.Type

/**
 * What a template sets: its direction and trade count, whether it trades while prices are paused, the most it spends
 * a day whatever the preset, the optional rules it carries, and the ones the editor offers it without adding them.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Template {
  readonly id: TemplateId
  readonly title: string
  readonly summary: string
  readonly direction: Direction
  readonly tradesPerDay: number
  readonly tradeWhilePaused: boolean
  readonly maxDailyBudget: bigint
  readonly rules: ReadonlyArray<PolicyId>
  readonly options: ReadonlyArray<PolicyId>
  /** The stocks a new agent starts with before you pick: a mix needs some to be a mix. */
  readonly defaultStocks: ReadonlyArray<StockSymbol>
  /** Its own budget and largest trade per preset, where the shared ones are too small for it. */
  readonly presets?: Partial<Record<Preset, { readonly dailyBudget: bigint; readonly maxPerTrade: bigint }>>
}

/**
 * Each template.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const TEMPLATES: Readonly<Record<TemplateId, Template>> = {
  rebalancer: {
    id: "rebalancer",
    title: "Rebalancer",
    summary: "Keeps your target mix, trading only to bring you back to it.",
    direction: "rebalance",
    tradesPerDay: 500,
    tradeWhilePaused: true,
    maxDailyBudget: dollars(5000),
    rules: ["stockCap", "cashReserve", "rebalance", "slippageBudget"],
    options: [],
    defaultStocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
    // A rebalance moves a share of everything at once: room for it in a day, in a few trades.
    presets: {
      conservative: { dailyBudget: dollars(500), maxPerTrade: dollars(200) },
      balanced: { dailyBudget: dollars(2000), maxPerTrade: dollars(500) },
      active: { dailyBudget: dollars(5000), maxPerTrade: dollars(1000) }
    }
  },
  stockPicker: {
    id: "stockPicker",
    title: "Stock picker",
    summary: "Buys and sells a few stocks you pick.",
    direction: "both",
    tradesPerDay: 500,
    tradeWhilePaused: true,
    maxDailyBudget: dollars(2000),
    rules: ["stockCap", "cashReserve", "slippageBudget"],
    options: [],
    defaultStocks: []
  },
  weeklyBuyer: {
    id: "weeklyBuyer",
    title: "Weekly buyer",
    summary: "Buys the stocks you pick on a schedule.",
    direction: "buy",
    tradesPerDay: 500,
    tradeWhilePaused: true,
    maxDailyBudget: dollars(500),
    rules: ["stockCap", "cashReserve", "slippageBudget"],
    options: [],
    defaultStocks: []
  },
  stopLossGuard: {
    id: "stopLossGuard",
    title: "Stop-loss guard",
    summary: "Only sells, to protect what you hold.",
    direction: "sell",
    tradesPerDay: 500,
    tradeWhilePaused: true,
    maxDailyBudget: BigInt(0),
    rules: ["slippageBudget"],
    options: ["stopLossFloor"],
    defaultStocks: []
  }
}

/**
 * The amounts a preset sets.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const PRESETS: Readonly<
  Record<Preset, {
    readonly dailyBudget: bigint
    readonly maxPerTrade: bigint
    readonly stockCapBps: number
    readonly cashReserveBps: number
  }>
> = {
  conservative: { dailyBudget: dollars(100), maxPerTrade: dollars(50), stockCapBps: 2000, cashReserveBps: 2000 },
  balanced: { dailyBudget: dollars(250), maxPerTrade: dollars(100), stockCapBps: 3000, cashReserveBps: 1000 },
  active: { dailyBudget: dollars(1000), maxPerTrade: dollars(400), stockCapBps: 4000, cashReserveBps: 500 }
}

const min = (a: bigint, b: bigint) => (a < b ? a : b)

/**
 * A template's spec from a preset, with the stocks (and, for a Rebalancer, the target mix) you picked. The daily
 * budget never passes the template's, and the price settings start at their standard values.
 *
 * **Example** (An active Weekly buyer)
 *
 * ```ts import.meta.vitest
 * import { draftSpec } from "@bluechip/domain/policies/Templates"
 *
 * const spec = draftSpec({ template: "weeklyBuyer", preset: "active", stocks: ["NVDA"], targets: [] })
 * spec.policies[0] // => { id: "trade", config: { stocks: ["NVDA"], direction: "buy", dailyBudget: 500000000n } }
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const draftSpec = (options: {
  readonly template: TemplateId
  readonly preset: Preset
  readonly stocks: ReadonlyArray<StockSymbol>
  readonly targets: ReadonlyArray<Target>
}): AgentSpec => {
  const template = TEMPLATES[options.template]
  const preset = { ...PRESETS[options.preset], ...template.presets?.[options.preset] }
  const dailyBudget = Usdc.make(min(preset.dailyBudget, template.maxDailyBudget))
  const maxPerTrade = Usdc.make(dailyBudget > BigInt(0) ? min(preset.maxPerTrade, dailyBudget) : preset.maxPerTrade)

  const rules: Record<string, PolicyEntry> = {
    stockCap: { id: "stockCap", config: { maxBps: preset.stockCapBps } },
    cashReserve: { id: "cashReserve", config: { minBps: preset.cashReserveBps } },
    rebalance: { id: "rebalance", config: { targets: options.targets, triggerBps: 500 } },
    slippageBudget: { id: "slippageBudget", config: { weeklyBps: 100 } }
  }

  return complete(
    new AgentSpec({
      policies: [
        { id: "trade", config: { stocks: options.stocks, direction: template.direction, dailyBudget } },
        { id: "tradeSize", config: { maxPerTrade, minPerTrade: Usdc.make(dollars(5)) } },
        { id: "fairPrice", config: { collarBps: 100, tradeWhilePaused: template.tradeWhilePaused } },
        ...template.rules.map((id) => rules[id]!),
        { id: "tradesPerDay", config: { count: template.tradesPerDay } }
      ]
    })
  )
}

/**
 * A built-in template as the API describes it; clients draft its spec with `draftSpec`.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class TemplateInfo extends Schema.Class<TemplateInfo>("@bluechip/domain/policies/Templates/TemplateInfo")({
  id: TemplateId,
  title: Schema.String,
  summary: Schema.String,
  direction: Direction,
  rules: Schema.Array(PolicyId),
  options: Schema.Array(PolicyId)
}) {}

/**
 * The built-in templates as the API describes them.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const templateInfos = (): ReadonlyArray<TemplateInfo> =>
  TemplateId.literals.map((id) => {
    const { direction, options, rules, summary, title } = TEMPLATES[id]
    return new TemplateInfo({ id, title, summary, direction, rules, options })
  })

/**
 * The longest name a saved template may have.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MAX_TEMPLATE_NAME_LENGTH = 40

/**
 * A saved template's name: 1 to 40 characters without leading or trailing spaces.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TemplateName = Schema.Trimmed.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_TEMPLATE_NAME_LENGTH))

/**
 * A set of policies you saved to start agents from.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class SavedTemplate extends Schema.Class<SavedTemplate>("@bluechip/domain/policies/Templates/SavedTemplate")({
  id: SavedTemplateId,
  name: TemplateName,
  /** The template it was made from: a built-in's id or another saved template's, `null` when built from scratch. */
  basedOn: Schema.NullOr(Schema.String),
  spec: AgentSpec,
  createdAt: Schema.DateTimeUtc
}) {}
