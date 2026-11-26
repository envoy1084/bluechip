import type { Intent } from "@bluechip/domain/intents/Intent"

/** A card in your approvals: the trade you approve, and the others of its plan one Face ID sends with it. */
export interface ApprovalGroup {
  readonly intent: Intent
  readonly together: ReadonlyArray<Intent>
}

/**
 * `approvals` as one card per signature, in their order: a plan's trades waiting for you go together, one per stock,
 * led by its first; a second trade of a stock leads a card of its own. Picked in the plan's order (its waves, then as
 * they were made), as the server picks what one signature sends.
 */
export const approvalGroups = (approvals: ReadonlyArray<Intent>): ReadonlyArray<ApprovalGroup> => {
  const planOrder = [...approvals].sort((a, b) =>
    (a.batch?.wave ?? 0) - (b.batch?.wave ?? 0) || a.id.localeCompare(b.id)
  )
  const groups: Array<{ intent: Intent; together: Array<Intent> }> = []
  for (const intent of planOrder) {
    const group = intent.batch === null ?
      undefined :
      groups.find(({ intent: lead, together }) =>
        lead.batch?.id === intent.batch!.id && lead.agentId === intent.agentId &&
        ![lead, ...together].some((taken) => taken.leg.symbol === intent.leg.symbol)
      )
    if (group === undefined) groups.push({ intent, together: [] })
    else group.together.push(intent)
  }
  return groups.sort((a, b) => approvals.indexOf(a.intent) - approvals.indexOf(b.intent))
}
