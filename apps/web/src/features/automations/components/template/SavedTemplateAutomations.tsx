import type { Agent } from "@bluechip/domain/agents/Agent"
import { AutomationDraft } from "@bluechip/domain/automations/Automation"
import type { Automation } from "@bluechip/domain/automations/Automation"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { changedKeys, createAutomationAtom } from "../../atoms/automations.ts"
import { saveProblem } from "../../model/automationText.ts"
import type { TemplateAutomation } from "./TemplateAutomations.tsx"

type Saving =
  | { readonly status: "saving" }
  | { readonly status: "saved"; readonly automation: Automation }
  | { readonly status: "failed"; readonly problem: string }

/**
 * The automations kept on the review, saved for the agent now that it's live (each once, by its request id), listed
 * with the way to each, or to try one again.
 */
export function SavedTemplateAutomations(
  { agent, automations }: Readonly<{ agent: Agent; automations: ReadonlyArray<TemplateAutomation> }>
) {
  const create = useAtomSet(createAutomationAtom, { mode: "promise" })
  const kept = automations.filter((automation) => automation.kept)
  const [saving, setSaving] = useState<ReadonlyArray<Saving>>(() => kept.map(() => ({ status: "saving" })))
  const started = useRef(false)

  const save = (index: number) => {
    const { id, draft, edited } = kept[index]!
    setSaving((all) => all.map((each, at) => at === index ? { status: "saving" } : each))
    return create({
      payload: {
        requestId: id,
        draft: new AutomationDraft({ ...draft, agentId: agent.id }, { disableChecks: true }),
        createdBy: edited ? "owner" : "template"
      },
      reactivityKeys: changedKeys
    }).then(
      (automation) => setSaving((all) => all.map((each, at) => at === index ? { status: "saved", automation } : each)),
      (error) =>
        setSaving((all) =>
          all.map((each, at) => at === index ? { status: "failed", problem: saveProblem(error) } : each)
        )
    )
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    // One at a time: overlapping calls of one mutation atom interrupt each other and settle with the last one's result.
    kept.reduce((previous, _, index) => previous.then(() => save(index)), Promise.resolve())
  })

  if (kept.length === 0) return null

  return (
    <ul aria-label="Its automations" className="grid gap-1.5 rounded-[12px] px-3.5 py-3 surface-well">
      {kept.map(({ id, draft }, index) => {
        const state = saving[index]!
        return (
          <li key={id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-1.5 text-[13.5px] text-g-800">
            {state.status === "saving" ?
              <Spinner size={14} className="mt-[3px]" /> :
              <Icon name={state.status === "saved" ? "zap" : "error"} size={14} className="mt-[3px] text-blue" />}
            <span className="grid gap-0.5">
              {state.status === "saved" ?
                (
                  <Link
                    to="/automations/$automationId"
                    params={{ automationId: state.automation.id }}
                    className="font-medium text-ink hover:text-blue"
                  >
                    {state.automation.name}
                  </Link>
                ) :
                <span className="font-medium">{draft.name}</span>}
              {state.status === "failed" ?
                (
                  <span className="flex flex-wrap items-center gap-2 text-label-sm text-loss">
                    {state.problem}
                    <Button variant="ghost" size="xs" onClick={() => save(index)}>Try again</Button>
                  </span>
                ) :
                (
                  <span className="text-label-sm text-g-500">
                    {state.status === "saving" ? "Starting it" : state.automation.description.sentence}
                  </span>
                )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
