import { configOf } from "@bluechip/domain/policies/Policy"
import { withConfig } from "@bluechip/domain/policies/SpecEdits"
import { tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import { useNow } from "../../../../../hooks/useNow.ts"
import { dailyResetText } from "../../../../../lib/localTime.ts"
import { FieldEditor } from "../fields/FieldEditor.tsx"
import type { EditorProps } from "./editorProps.ts"

/** How many trades it may send in a day. */
export function TradesPerDayEditor({ context, problemOf, onSpecChange }: EditorProps) {
  const now = useNow(60_000)
  const config = configOf(context.spec.policies, tradesPerDay)
  if (config === undefined) return null

  return (
    <FieldEditor
      field={tradesPerDay.fields.count}
      value={config.count}
      context={context}
      help={`The most trades it sends in a day. Resets at ${dailyResetText(now)}.`}
      problem={problemOf("count")}
      onChange={(count) => onSpecChange(withConfig(context.spec, "tradesPerDay", { count }))}
    />
  )
}
