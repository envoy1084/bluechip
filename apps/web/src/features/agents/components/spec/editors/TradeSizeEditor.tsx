import { configOf } from "@bluechip/domain/policies/Policy"
import { withConfig } from "@bluechip/domain/policies/SpecEdits"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { FieldEditor } from "../fields/FieldEditor.tsx"
import type { EditorProps } from "./editorProps.ts"

/** The largest trade it makes on its own (bigger ones wait for Face ID), and the smallest it bothers with. */
export function TradeSizeEditor({ context, problemOf, onSpecChange }: EditorProps) {
  const config = configOf(context.spec.policies, tradeSize)
  if (config === undefined) return null
  const set = (patch: Partial<typeof config>) =>
    onSpecChange(withConfig(context.spec, "tradeSize", { ...config, ...patch }))

  return (
    <div className="grid gap-4">
      <FieldEditor
        field={tradeSize.fields.maxPerTrade}
        value={config.maxPerTrade}
        context={context}
        help="Bigger trades wait for your approval."
        problem={problemOf("maxPerTrade")}
        onChange={(maxPerTrade) => set({ maxPerTrade: maxPerTrade as typeof config.maxPerTrade })}
      />
      <FieldEditor
        field={tradeSize.fields.minPerTrade}
        value={config.minPerTrade}
        context={context}
        help="It never makes a trade smaller than this."
        problem={problemOf("minPerTrade")}
        onChange={(minPerTrade) => set({ minPerTrade: minPerTrade as typeof config.minPerTrade })}
      />
    </div>
  )
}
