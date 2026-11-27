import { configOf } from "@bluechip/domain/policies/Policy"
import { setDirection, setStocks, withConfig } from "@bluechip/domain/policies/SpecEdits"
import { trade } from "@bluechip/domain/policies/Trade"
import { StockField } from "../../../../../components/fields/StockField.tsx"
import { useNow } from "../../../../../hooks/useNow.ts"
import { dailyResetText } from "../../../../../lib/localTime.ts"
import { DirectionField } from "../fields/DirectionField.tsx"
import { FieldEditor } from "../fields/FieldEditor.tsx"
import type { EditorProps } from "./editorProps.ts"

/** Which part of the trade policy an editor shows: the new agent form splits it between two sections. */
type TradePart = "stocks" | "direction" | "budget"

const EVERY_PART: ReadonlyArray<TradePart> = ["stocks", "direction", "budget"]

/** The stocks it trades, which way, and what it may spend a day; or only `parts` of them. */
export function TradeEditor(
  { context, problemOf, onSpecChange, parts = EVERY_PART }: EditorProps & {
    readonly parts?: ReadonlyArray<TradePart>
  }
) {
  const now = useNow(60_000)
  const config = configOf(context.spec.policies, trade)
  if (config === undefined) return null

  return (
    <div className="grid gap-4">
      {parts.includes("stocks") && (
        <StockField
          label={trade.fields.stocks.label}
          value={config.stocks}
          stocks={context.stocks}
          problem={problemOf("stocks")}
          onChange={(stocks) => onSpecChange(setStocks(context.spec, stocks))}
        />
      )}
      {parts.includes("direction") && (
        <DirectionField
          label={trade.fields.direction.label}
          value={config.direction}
          problem={problemOf("direction")}
          onChange={(direction) => onSpecChange(setDirection(context.spec, direction))}
        />
      )}
      {!parts.includes("budget") ? null : config.direction === "sell" ?
        <p className="text-label-sm text-g-500">It only sells, so it has no daily budget.</p> :
        (
          <FieldEditor
            field={trade.fields.dailyBudget}
            value={config.dailyBudget}
            context={context}
            help={`The most it can spend on buys in a day. Resets at ${dailyResetText(now)}.`}
            problem={problemOf("dailyBudget")}
            onChange={(dailyBudget) => onSpecChange(withConfig(context.spec, "trade", { ...config, dailyBudget }))}
          />
        )}
    </div>
  )
}
