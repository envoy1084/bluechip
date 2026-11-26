import type { Agent } from "@bluechip/domain/agents/Agent"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { useEffect, useId, useRef } from "react"
import type { AgentSigning } from "../../hooks/useAgentSigning.ts"

const buttonLabel = (signing: AgentSigning): string => {
  if (signing.status === "preparing") return "Removing…"
  if (signing.status === "signing") return "Waiting for Face ID…"
  return "Remove agent"
}

/** Asks before removing an agent for good; the answer it starts on is "Keep agent". */
export function RemoveConfirm(
  { agent, signing, onRemove, onKeep }: Readonly<{
    agent: Agent
    signing: AgentSigning
    onRemove: () => void
    onKeep: () => void
  }>
) {
  const titleId = useId()
  const keep = useRef<HTMLButtonElement>(null)
  useEffect(() => keep.current?.focus(), [])

  const busy = signing.status === "preparing" || signing.status === "signing"

  // Escape keeps the agent, as it closes a dialog; not while Face ID is on its way.
  useEffect(() => {
    if (busy) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onKeep()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [busy, onKeep])

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-2.5 rounded-lg bg-[linear-gradient(180deg,#fff,var(--color-loss-wash))] p-[18px] shadow-[inset_0_0_0_1px_var(--color-loss-line)]"
    >
      <b id={titleId} className="text-[15px] font-semibold">Remove {agent.name}?</b>
      <p className="text-[13.5px] text-g-700">
        {agent.status === "draft" ?
          "It was never locked, so it never traded. Nothing changes in your account." :
          "It stops right away and can never trade again. Your stocks and cash stay in your account; nothing is sold. Its history stays here."}
      </p>
      {signing.status === "failed" ? <p role="alert" className="text-label text-loss">{signing.message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button ref={keep} variant="secondary" size="sm" disabled={busy} onClick={onKeep}>Keep agent</Button>
        <Button variant="danger" size="sm" disabled={busy} aria-busy={busy || undefined} onClick={onRemove}>
          {busy ? <Spinner size={14} /> : <Icon name={agent.status === "draft" ? "trash" : "face-id"} size={14} />}
          <TextMorph>{buttonLabel(signing)}</TextMorph>
        </Button>
      </div>
    </section>
  )
}
