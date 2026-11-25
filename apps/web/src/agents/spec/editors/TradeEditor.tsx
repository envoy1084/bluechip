import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { DirectionField } from "../fields/DirectionField.tsx"
import { FieldEditor } from "../fields/FieldEditor.tsx"
import { StockField } from "../fields/StockField.tsx"
import { setDirection, setStocks, withConfig } from "../specEdits.ts"
import type { EditorProps } from "./editorProps.ts"

/** The stocks it trades, which way, and what it may spend a day. */
export function TradeEditor({ context, problemOf, onSpecChange }: EditorProps) {
  const config = configOf(context.spec.policies, trade)
  if (config === undefined) return null

  return (
    <div className="grid gap-4">
      <StockField
        label={trade.fields.stocks.label}
        value={config.stocks}
        stocks={context.stocks}
        problem={problemOf("stocks")}
        onChange={(stocks) => onSpecChange(setStocks(context.spec, stocks))}
      />
      <DirectionField
        label={trade.fields.direction.label}
        value={config.direction}
        problem={problemOf("direction")}
        onChange={(direction) => onSpecChange(setDirection(context.spec, direction))}
      />
      {config.direction === "sell" ?
        <p className="text-label-sm text-g-500">It only sells, so it has no daily budget.</p> :
        (
          <FieldEditor
            field={trade.fields.dailyBudget}
            value={config.dailyBudget}
            context={context}
            help="The most it can spend on buys in a day. Resets at midnight UTC."
            problem={problemOf("dailyBudget")}
            onChange={(dailyBudget) => onSpecChange(withConfig(context.spec, "trade", { ...config, dailyBudget }))}
          />
        )}
    </div>
  )
}
