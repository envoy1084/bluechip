import type { Automation } from "@bluechip/domain/automations/Automation"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { changedKeys, removeAutomationAtom, updateAutomationAtom } from "../atoms/automations.ts"
import { saveProblem } from "../model/automationText.ts"

/** Pause, Resume and Delete for one automation, with whether one is under way and why the last one failed. */
export function useAutomationActions(automation: Pick<Automation, "id">) {
  const update = useAtomSet(updateAutomationAtom, { mode: "promise" })
  const remove = useAtomSet(removeAutomationAtom, { mode: "promise" })
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const act = async (change: () => Promise<unknown>) => {
    setBusy(true)
    setProblem(null)
    try {
      await change()
    } catch (error) {
      setProblem(saveProblem(error))
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    problem,
    setStatus: (next: "active" | "paused") =>
      act(() => update({ params: { id: automation.id }, payload: { status: next }, reactivityKeys: changedKeys })),
    remove: (then: () => Promise<unknown>) =>
      act(async () => {
        await remove({ params: { id: automation.id }, reactivityKeys: changedKeys })
        await then()
      })
  }
}
