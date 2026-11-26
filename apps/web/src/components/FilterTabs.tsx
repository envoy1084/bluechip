import { Tabs, TabsCount, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"

/** One choice of a filter bar: its label, an optional icon, and how many it shows when that's known. */
export interface FilterOption<A extends string> {
  readonly value: A
  readonly label: string
  readonly icon?: IconName
  readonly count?: number
  /** Its count asks for a look (needs attention), so it's amber. */
  readonly warn?: boolean
}

/**
 * The one filter bar: segmented tabs, each with its count (hidden at zero), scrolling sideways on a phone with its
 * edge faded so you can tell there's more.
 */
export function FilterTabs<A extends string>(
  { label, value, options, onChange, className }: Readonly<{
    label: string
    value: A
    options: ReadonlyArray<FilterOption<A>>
    onChange: (value: A) => void
    className?: string
  }>
) {
  return (
    <Tabs
      variant="segmented"
      value={value}
      onValueChange={(next) => onChange(next as A)}
      className={cn("w-auto", className)}
    >
      <TabsList
        aria-label={label}
        className={cn(
          "max-w-full [&_[role=tab]]:h-[30px] [&_[role=tab]]:gap-1.5 [&_[role=tab]]:px-3 [&_[role=tab]]:text-label-sm",
          "max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)] max-sm:pr-6"
        )}
      >
        {options.map((option) => (
          <TabsTab key={option.value} value={option.value}>
            {option.icon === undefined ? null : <Icon name={option.icon} size={14} />}
            {option.label}
            {option.count === undefined || option.count === 0 ?
              null :
              <TabsCount className={option.warn === true ? "bg-warn-wash text-warn" : ""}>{option.count}</TabsCount>}
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  )
}
