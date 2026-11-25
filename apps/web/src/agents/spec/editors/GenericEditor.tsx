import { policyOf } from "@bluechip/domain/policies/Catalog"
import type { Field } from "@bluechip/domain/policies/Policy"
import { withConfig } from "@bluechip/domain/policies/SpecEdits"
import { FieldEditor } from "../fields/FieldEditor.tsx"
import type { EditorProps } from "./editorProps.ts"

/** Any policy, one field after another, from the catalog's hints for each. */
export function GenericEditor({ id, context, problemOf, onSpecChange }: EditorProps) {
  const policy = policyOf(id)
  const config = context.spec.policies.find((entry) => entry.id === id)?.config as Record<string, unknown>

  return (
    <div className="grid gap-4">
      {Object.entries(policy.fields as Record<string, Field>).map(([name, field]) => (
        <FieldEditor
          key={name}
          field={field}
          value={config[name]}
          context={context}
          problem={problemOf(name)}
          onChange={(value) => onSpecChange(withConfig(context.spec, id, { ...config, [name]: value }))}
        />
      ))}
    </div>
  )
}
