import { ACTION_LABELS as LABELS, actionsOf, type NotificationAction } from "@bluechip/domain/notifications/Actions"
import type { NotificationKind } from "@bluechip/domain/notifications/Notification"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { pauseAllAgentsAtom } from "../../../atoms/agents.ts"
import { cancelRecoveryAtom } from "../../../atoms/recovery.ts"
import { agentsReactivityKey, securityReactivityKey } from "../../../lib/api/client.ts"

/**
 * What a notification lets you do right here: pause every agent from news of their trades, or cancel a recovery you
 * didn't ask for. Neither needs Face ID: both only take power away.
 */
export function NotificationActions({ kind }: Readonly<{ kind: NotificationKind }>) {
  const pauseAll = useAtomSet(pauseAllAgentsAtom, { mode: "promise" })
  const cancelRecovery = useAtomSet(cancelRecoveryAtom, { mode: "promise" })
  const [state, setState] = useState<Partial<Record<NotificationAction, "busy" | "done" | "failed">>>({})

  const run = async (action: NotificationAction) => {
    setState((current) => ({ ...current, [action]: "busy" }))
    const done = action === "pauseAll" ?
      pauseAll({ reactivityKeys: [agentsReactivityKey] }) :
      cancelRecovery({ reactivityKeys: [securityReactivityKey] })
    await done.then(
      () => setState((current) => ({ ...current, [action]: "done" })),
      () => setState((current) => ({ ...current, [action]: "failed" }))
    )
  }

  const actions = actionsOf(kind)
  if (actions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 pb-2 pl-[52px]">
      {actions.map((action) => (
        <Button
          key={action}
          variant={state[action] === "done" ? "secondary" : "danger"}
          size="sm"
          loading={state[action] === "busy"}
          disabled={state[action] === "done"}
          onClick={() => void run(action)}
        >
          <Icon name={action === "pauseAll" ? "pause" : "stop"} size={13} />
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
