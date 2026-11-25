// What an agent started from, as its cards say it: a built-in template's title, a saved template's name, or "Custom"
// for one built from scratch (or from a saved template since deleted).
import type { Agent } from "@bluechip/domain/agents/Agent"
import { type SavedTemplate, TemplateId, TEMPLATES } from "@bluechip/domain/policies/Templates"
import type { AgentTemplateName } from "@bluechip/ui/bluechip/template-picker"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Schema from "effect/Schema"
import { templatesAtom } from "../atoms/policies.ts"

export const isTemplateId = Schema.is(TemplateId)

/** A built-in template's name in `@bluechip/ui` (`stock-picker`), for its picture and promise. */
export const uiTemplate = (template: TemplateId): AgentTemplateName =>
  template.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`) as AgentTemplateName

export const templateLabel = (template: string | null, saved: ReadonlyArray<SavedTemplate>): string => {
  if (template === null) return "Custom"
  if (isTemplateId(template)) return TEMPLATES[template].title
  return saved.find((candidate) => candidate.id === template)?.name ?? "Custom"
}

/** The agent's template label, naming a saved template once the templates have loaded. */
export function useTemplateLabel(agent: Agent): string {
  const templates = useAtomValue(templatesAtom)
  return templateLabel(agent.template, AsyncResult.isSuccess(templates) ? templates.value.saved : [])
}
