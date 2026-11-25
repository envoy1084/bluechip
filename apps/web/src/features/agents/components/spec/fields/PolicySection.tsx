import type { PolicyChange } from "@bluechip/domain/policies/Catalog"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"

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

/** One block of the policies card, with its title, change mark and the problem that blocks locking it. */
export function PolicySection(
  { title, titleId, description, change, problem, actions, children }: Readonly<{
    title: string
    titleId?: string
    description?: string
    change?: ChangeKind | undefined
    problem?: string | undefined
    actions?: ReactNode
    children?: ReactNode
  }>
) {
  return (
    <div className="grid gap-2.5 border-b border-g-100 px-[18px] py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span id={titleId} className="text-[13.5px] font-semibold">{title}</span>
            <ChangeMark change={change} />
          </div>
          {description === undefined ? null : <p className="text-label-sm text-g-500">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
