import type { Agent } from "@bluechip/domain/agents/Agent"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { templatesAtom } from "../atoms/policies.ts"
import { templateLabel } from "../model/templateLabel.ts"

/** The agent's template label, naming a saved template once the templates have loaded. */
export function useTemplateLabel(agent: Agent): string {
  const templates = useAtomValue(templatesAtom)
  return templateLabel(agent.template, AsyncResult.isSuccess(templates) ? templates.value.saved : [])
}
