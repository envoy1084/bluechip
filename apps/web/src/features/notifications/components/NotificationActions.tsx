import { ACTION_LABELS as LABELS, actionsOf, type NotificationAction } from "@bluechip/domain/notifications/Actions"
import type { NotificationKind } from "@bluechip/domain/notifications/Notification"
import { Button } from "@bluechip/ui/components/button"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { pauseAllAgentsAtom } from "../../../atoms/agents.ts"
import { cancelRecoveryAtom } from "../../../atoms/recovery.ts"
import { agentsReactivityKey, securityReactivityKey } from "../../../lib/api/client.ts"

const ICONS: Readonly<Record<NotificationAction, IconName>> = {
  review: "approvals",
  pauseAll: "pause",
  cancelRecovery: "stop"
}

/**
 * What a notification lets you do right here, of what is still worth doing (`live`): Review opens the approvals, Pause
 * all agents from a trade a policy stopped, Cancel recovery from one you didn't ask for. Pausing and cancelling need no
 * Face ID: both only take power away. Spent actions (nothing waiting, every agent paused, no recovery going) are left
 * out.
 */
export function NotificationActions(
  { kind, live, onReview }: Readonly<{
    kind: NotificationKind
    live: ReadonlySet<NotificationAction>
    onReview: () => void
  }>
) {
  const pauseAll = useAtomSet(pauseAllAgentsAtom, { mode: "promise" })
  const cancelRecovery = useAtomSet(cancelRecoveryAtom, { mode: "promise" })
  const [state, setState] = useState<Partial<Record<NotificationAction, "busy" | "done" | "failed">>>({})

  const run = async (action: NotificationAction) => {
    if (action === "review") return onReview()
    setState((current) => ({ ...current, [action]: "busy" }))
    const done = action === "pauseAll" ?
      pauseAll({ reactivityKeys: [agentsReactivityKey] }) :
      cancelRecovery({ reactivityKeys: [securityReactivityKey] })
    await done.then(
      () => setState((current) => ({ ...current, [action]: "done" })),
      () => setState((current) => ({ ...current, [action]: "failed" }))
    )
  }

  // One just done stays to say so, though it is spent now.
  const actions = actionsOf(kind).filter((action) => live.has(action) || state[action] === "done")
  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 pt-1.5">
      {actions.map((action) => (
        <Button
          key={action}
          variant={action === "cancelRecovery" && state[action] !== "done" ? "danger" : "secondary"}
          size="xs"
          loading={state[action] === "busy"}
          disabled={state[action] === "done"}
          onClick={() => void run(action)}
        >
          <Icon name={state[action] === "done" ? "check" : ICONS[action]} size={12} />
          {state[action] === "done" ?
            LABELS[action].done :
            state[action] === "failed" ?
            "Try again" :
            LABELS[action].idle}
        </Button>
      ))}
    </div>
  )
}
