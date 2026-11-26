import { fairPrice } from "@bluechip/domain/policies/FairPrice"
import { formatPercent } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { withConfig } from "@bluechip/domain/policies/SpecEdits"
import { FieldEditor } from "../fields/FieldEditor.tsx"
import type { EditorProps } from "./editorProps.ts"

const COLLARS: Readonly<Record<number, string>> = { 50: "Strict", 100: "Standard", 200: "Relaxed" }

/** How far from Chainlink's price a trade may fill, and whether it trades while prices are paused. */
export function FairPriceEditor({ context, problemOf, onSpecChange }: EditorProps) {
  const config = configOf(context.spec.policies, fairPrice)
  if (config === undefined) return null
  const set = (patch: Partial<typeof config>) =>
    onSpecChange(withConfig(context.spec, "fairPrice", { ...config, ...patch }))

  return (
    <div className="grid gap-4">
      <FieldEditor
        field={fairPrice.fields.collarBps}
        value={config.collarBps}
        context={context}
        help={`Every trade stays within ${formatPercent(config.collarBps)} of Chainlink's price.`}
        choiceLabel={(bps) =>
          COLLARS[bps] === undefined ? formatPercent(bps) : `${COLLARS[bps]}, ${formatPercent(bps)}`}
        problem={problemOf("collarBps")}
        onChange={(collarBps) => set({ collarBps: collarBps as number })}
      />
      <FieldEditor
        field={fairPrice.fields.tradeWhilePaused}
        value={config.tradeWhilePaused}
        context={context}
        help="On weekends and holidays, within half that distance."
        problem={problemOf("tradeWhilePaused")}
        onChange={(tradeWhilePaused) => set({ tradeWhilePaused: tradeWhilePaused as boolean })}
      />
    </div>
  )
}
