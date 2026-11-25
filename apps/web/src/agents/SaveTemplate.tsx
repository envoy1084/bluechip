import { InvalidSpec } from "@bluechip/domain/Errors"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { MAX_TEMPLATE_NAME_LENGTH } from "@bluechip/domain/policies/Templates"
import { Button } from "@bluechip/ui/components/button"
import { Input } from "@bluechip/ui/components/input"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useId, useState } from "react"
import { saveTemplateAtom } from "../atoms/policies.ts"
import { templatesReactivityKey } from "../lib/api/client.ts"

type Saving =
  | { readonly status: "closed" }
  | { readonly status: "naming" }
  | { readonly status: "saving" }
  | { readonly status: "saved"; readonly name: string }
  | { readonly status: "failed"; readonly message: string }

/** Saves a set of policies as a template, to start the next agent from; it never changes an agent. */
export function SaveTemplate(
  { spec, basedOn, defaultName }: Readonly<{ spec: AgentSpec; basedOn: string | null; defaultName: string }>
) {
  const id = useId()
  const save = useAtomSet(saveTemplateAtom, { mode: "promise" })
  const [saving, setSaving] = useState<Saving>({ status: "closed" })
  const [name, setName] = useState(defaultName)
  const trimmed = name.trim()

  const submit = async () => {
    setSaving({ status: "saving" })
    try {
      await save({ payload: { name: trimmed, basedOn, spec }, reactivityKeys: [templatesReactivityKey] })
      setSaving({ status: "saved", name: trimmed })
    } catch (error) {
      setSaving({
        status: "failed",
        message: error instanceof InvalidSpec ?
          error.problems.map((problem) => problem.message).join(" ") :
          "We couldn't save it just now. Try again."
      })
    }
  }

  if (saving.status === "closed") {
    return (
      <Button variant="ghost" size="sm" onClick={() => setSaving({ status: "naming" })}>
        <Icon name="plus" size={14} />Save as template
      </Button>
    )
  }
  if (saving.status === "saved") {
    return (
      <output className="inline-flex items-center gap-1.5 text-label-sm text-gain">
        <Icon name="check-circle" size={14} />
        Saved as {saving.name}. It's with your templates for the next agent.
      </output>
    )
  }

  return (
    <form
      className="grid w-full gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <label htmlFor={id} className="text-[13.5px] font-semibold">Template name</label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={id}
          value={name}
          maxLength={MAX_TEMPLATE_NAME_LENGTH}
          autoComplete="off"
          onChange={(event) => setName(event.currentTarget.value)}
          className="max-w-[260px] flex-1"
        />
        <Button type="submit" size="sm" loading={saving.status === "saving"} disabled={trimmed === ""}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSaving({ status: "closed" })}>
          Cancel
        </Button>
      </div>
      {saving.status === "failed" ? <p role="alert" className="text-label-sm text-loss">{saving.message}</p> : null}
    </form>
  )
}
