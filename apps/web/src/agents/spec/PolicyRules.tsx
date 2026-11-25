import type { Description } from "@bluechip/domain/policies/Policy"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"

function RuleList(
  { title, rules, kind }: Readonly<{ title: string; rules: ReadonlyArray<string>; kind: "can" | "never" }>
) {
  return (
    <div className="grid content-start gap-2.5 px-[18px] py-4">
      <h4 className="text-label-sm font-semibold text-g-500">{title}</h4>
      <ul className="grid gap-2">
        {rules.map((rule) => (
          <li key={rule} className="grid grid-cols-[18px_1fr] gap-1.5 text-[13.5px] leading-[1.45] text-g-800">
            <Icon
              name={kind === "can" ? "check" : "close"}
              size={14}
              className={cn("mt-0.5", kind === "can" ? "text-gain" : "text-loss")}
            />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * What an agent's policies let it do and what it can never do, in the catalog's sentences (`describeSpec`), in the
 * permission card's layout. Without `lockedUntil` it reads as a draft; `lockLine` says something else there (removed).
 */
export function PolicyRules(
  { description, lockedUntil, lockLine, footer, className }: Readonly<{
    description: Description
    /** "21 Feb": the day the Face ID lock runs out. */
    lockedUntil?: string | undefined
    lockLine?: string | undefined
    /** Beside the lock line, like an "Edit policies" button. */
    footer?: ReactNode
    className?: string
  }>
) {
  const { can, never } = description
  const locked = lockedUntil !== undefined

  return (
    <div
      className={cn(
        "@container w-full overflow-hidden rounded-lg bg-white shadow-e2",
        !locked &&
          "bg-[repeating-linear-gradient(135deg,#fff_0_10px,#fbfbfc_10px_20px)] shadow-[0_0_0_1px_rgba(10,11,13,.1)]",
        className
      )}
    >
      <div className="grid divide-y divide-g-100 @[520px]:grid-cols-2 @[520px]:divide-x @[520px]:divide-y-0">
        <RuleList title="It can" rules={can} kind="can" />
        <RuleList title="It can never" rules={never} kind="never" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-g-100 py-[11px] pr-3.5 pl-[18px]">
        <span className="inline-flex items-center gap-1.5 text-label-sm text-g-500">
          <Icon name="lock" size={14} />
          {lockLine ?? (locked ? `Locked with Face ID until ${lockedUntil}` : "Not locked yet")}
        </span>
        {footer}
      </div>
    </div>
  )
}
