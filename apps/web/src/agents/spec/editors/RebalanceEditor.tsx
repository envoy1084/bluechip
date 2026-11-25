import { formatPercent } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import { withConfig } from "@bluechip/domain/policies/SpecEdits"
import { FieldEditor } from "../fields/FieldEditor.tsx"
import type { EditorProps } from "./editorProps.ts"

/** The target mix it trades toward, and how far the portfolio drifts before it starts. */
export function RebalanceEditor({ context, problemOf, onSpecChange }: EditorProps) {
  const config = configOf(context.spec.policies, rebalance)
  if (config === undefined) return null
  const set = (patch: Partial<typeof config>) =>
    onSpecChange(withConfig(context.spec, "rebalance", { ...config, ...patch }))

  return (
    <div className="grid gap-4">
      <FieldEditor
        field={rebalance.fields.targets}
        value={config.targets}
        context={context}
        problem={problemOf("targets")}
        onChange={(targets) => set({ targets: targets as typeof config.targets })}
      />
      <FieldEditor
        field={rebalance.fields.triggerBps}
        value={config.triggerBps}
        context={context}
        help={`It starts trading once your mix is ${formatPercent(config.triggerBps)} off target.`}
        problem={problemOf("triggerBps")}
        onChange={(triggerBps) => set({ triggerBps: triggerBps as number })}
      />
    </div>
  )
}
