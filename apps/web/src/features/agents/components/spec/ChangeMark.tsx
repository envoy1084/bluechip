import type { PolicyChange } from "@bluechip/domain/policies/Catalog"
import { cn } from "@bluechip/ui/lib/cn"

export type ChangeKind = PolicyChange["change"]

const CHANGE: Readonly<Record<Exclude<ChangeKind, "same">, { readonly label: string; readonly tone: string }>> = {
  tighter: { label: "Tighter", tone: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]" },
  added: { label: "New", tone: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]" },
  looser: { label: "Looser", tone: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]" },
  removed: { label: "Removed", tone: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]" }
}

/** How a policy compares with the one in force: tighter, looser, new or removed; nothing when it's the same. */
export function ChangeMark({ change }: Readonly<{ change: ChangeKind | undefined }>) {
  if (change === undefined || change === "same") return null
  return (
    <span
      data-change={change}
      className={cn(
        "rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap",
        CHANGE[change].tone
      )}
    >
      {CHANGE[change].label}
    </span>
  )
}
