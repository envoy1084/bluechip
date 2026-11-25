import type { Agent } from "@bluechip/domain/agents/Agent"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { useRenewAgent } from "./useRenewAgent.ts"

/** Renews the agent's session with Face ID, saying why when it doesn't go. */
export function RenewButton(
  { agent, variant = "secondary" }: Readonly<{ agent: Agent; variant?: "primary" | "secondary" }>
) {
  const { signing, busy, renew } = useRenewAgent(agent)

  return (
    <span className="inline-grid justify-items-end gap-1">
      <Button
        size="sm"
        variant={variant}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => void renew()}
      >
        {busy ? <Spinner size={14} /> : <Icon name="face-id" size={14} />}
        <TextMorph>{signing.status === "signing" ? "Waiting for Face ID…" : "Renew"}</TextMorph>
      </Button>
      {signing.status === "failed"
        ? <span role="alert" className="text-caption text-loss">{signing.message}</span>
        : null}
    </span>
  )
}
