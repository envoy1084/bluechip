import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import type { FieldContext } from "../fields/FieldEditor.tsx"

/** What every policy editor gets: the whole draft (a change may touch other policies), and its problems by field. */
export interface EditorProps {
  readonly id: PolicyId
  readonly context: FieldContext
  readonly problemOf: (field: string) => string | undefined
  readonly onSpecChange: (spec: AgentSpec) => void
}
