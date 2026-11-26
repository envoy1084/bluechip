import type { PolicyChange } from "@bluechip/domain/policies/Catalog"
import { StatusPill, type StatusTone } from "@bluechip/ui/bluechip/status-pill"
import type { IconName } from "@bluechip/ui/icons/icon"

export type ChangeKind = PolicyChange["change"]

/** How a policy compares with the one in force, in a word: safer is positive, looser worth a look. */
export const CHANGE: Readonly<
  Record<Exclude<ChangeKind, "same">, { readonly label: string; readonly tone: StatusTone; readonly icon: IconName }>
> = {
  tighter: { label: "Tighter", tone: "positive", icon: "shield" },
  added: { label: "New", tone: "positive", icon: "shield" },
  looser: { label: "Looser", tone: "attention", icon: "unlock" },
  removed: { label: "Removed", tone: "attention", icon: "unlock" }
}

/** How a policy compares with the one in force: tighter, looser, new or removed; nothing when it's the same. */
export function ChangeMark({ change, icon = false }: Readonly<{ change: ChangeKind | undefined; icon?: boolean }>) {
  if (change === undefined || change === "same") return null
  const { label, tone, icon: name } = CHANGE[change]
  return <StatusPill data-change={change} tone={tone} {...(icon ? { icon: name } : {})}>{label}</StatusPill>
}
