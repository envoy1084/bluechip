import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Card, DraftAutomation } from "@bluechip/domain/assistant/Card"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { Switch } from "@bluechip/ui/components/switch"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { keepCardAutomationAtom, startCardAutomationsAtom } from "../../atoms/assistant.ts"

const PROBLEM = "We couldn't reach bluechip just now. Try again."

/**
 * The automations a drafted agent comes with: each kept or left out with its switch while it is a draft, then the
 * kept ones started for it once it's live (each once, so coming back to the card starts nothing twice).
 */
export function DraftAutomations(
  { card, agent }: Readonly<{ card: Extract<Card, { _tag: "DraftAgent" }>; agent: Agent }>
) {
  const keep = useAtomSet(keepCardAutomationAtom, { mode: "promise" })
  const start = useAtomSet(startCardAutomationsAtom, { mode: "promise" })
  const [automations, setAutomations] = useState<ReadonlyArray<DraftAutomation>>(card.automations ?? [])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const starting = useRef(false)

  const draft = agent.status === "draft"
  const waiting = agent.status === "active" &&
    automations.some((automation) => automation.kept && automation.automationId === null)

  const answered = (next: Card) => {
    if (next._tag === "DraftAgent") setAutomations(next.automations ?? [])
  }

  const startKept = async () => {
    setBusy(true)
    setProblem(null)
    await start({ params: { id: card.id } }).then(answered, () => setProblem(PROBLEM)).finally(() => setBusy(false))
  }

  useEffect(() => {
    if (!waiting || starting.current) return
    starting.current = true
    void startKept()
  })

  if (automations.length === 0) return null
  const shown = draft ? automations : automations.filter((automation) => automation.kept)
  if (shown.length === 0) return null

  return (
    <div className="grid gap-1.5 rounded-[12px] px-3.5 py-3 surface-well">
      <span className="text-[13px] font-semibold text-g-700">
        {draft ? "It comes with these automations. They start once it's live." : "Its automations"}
      </span>
      <ul aria-label="Its automations" className="grid gap-2">
        {shown.map((automation) => (
          <li
            key={automation.requestId}
            className={`flex items-start gap-3 text-[13.5px] ${automation.kept ? "text-g-800" : "text-g-500"}`}
          >
            <span className="grid min-w-0 flex-1 gap-0.5">
              {automation.automationId === null ?
                (
                  <span className="font-medium">
                    <span className={automation.kept ? undefined : "line-through decoration-g-400"}>
                      {automation.draft.name}
                    </span>
                    {automation.kept ? null : <span className="ml-1.5 text-label-sm font-normal">Left out</span>}
                  </span>
                ) :
                (
                  <Link
                    to="/automations/$automationId"
                    params={{ automationId: automation.automationId }}
                    className="font-medium text-ink hover:text-blue"
                  >
                    {automation.draft.name}
                  </Link>
                )}
              <span className="text-label-sm text-g-500">{automation.sentence}</span>
            </span>
            {draft ?
              (
                <Switch
                  checked={automation.kept}
                  disabled={busy}
                  aria-label={`Keep: ${automation.draft.name}`}
                  onCheckedChange={(kept) => {
                    setBusy(true)
                    setProblem(null)
                    keep({ params: { id: card.id, requestId: automation.requestId }, payload: { kept } })
                      .then(answered, () => setProblem(PROBLEM))
                      .finally(() => setBusy(false))
                  }}
                />
              ) :
              automation.automationId === null ?
              <Spinner size={14} className="mt-[3px]" /> :
              <Icon name="zap" size={14} className="mt-[3px] text-blue" />}
          </li>
        ))}
      </ul>
      {problem === null ? null : (
        <span className="flex flex-wrap items-center gap-2 text-label-sm text-loss">
          {problem}
          {waiting ? <Button variant="ghost" size="xs" onClick={() => void startKept()}>Try again</Button> : null}
        </span>
      )}
    </div>
  )
}
