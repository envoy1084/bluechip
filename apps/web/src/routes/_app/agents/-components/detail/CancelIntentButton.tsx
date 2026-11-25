import type { Intent } from "@bluechip/domain/intents/Intent"
import { Button } from "@bluechip/ui/components/button"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { cancelIntentAtom } from "../../../../../atoms/intents.ts"
import { intentProblem } from "../../../../../intents/intentText.ts"

/** Stops a trade that hasn't been sent yet; it then moves on through live `IntentChanged` events. */
export function CancelIntentButton({ intent }: Readonly<{ intent: Intent }>) {
  const cancel = useAtomSet(cancelIntentAtom, { mode: "promise" })
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setProblem(null)
    try {
      await cancel({ params: { id: intent.id } })
    } catch (error) {
      setProblem(intentProblem(error, intent.leg.side))
    }
    setBusy(false)
  }

  return (
    <span className="inline-grid justify-items-end gap-1">
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void run()}>Cancel trade</Button>
      {problem === null ? null : <span role="alert" className="text-caption text-loss">{problem}</span>}
    </span>
  )
}
