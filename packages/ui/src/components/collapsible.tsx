import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible"
import { cn } from "../lib/cn.ts"

/** Shows or hides one block of extra detail. */
export function Collapsible(props: BaseCollapsible.Root.Props) {
  return <BaseCollapsible.Root data-slot="collapsible" {...props} />
}

export function CollapsibleTrigger(props: BaseCollapsible.Trigger.Props) {
  return <BaseCollapsible.Trigger data-slot="collapsible-trigger" {...props} />
}

export function CollapsibleContent({ className, ...props }: BaseCollapsible.Panel.Props) {
  return (
    <BaseCollapsible.Panel
      data-slot="collapsible-content"
      className={cn(
        "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-slow ease-brand",
        "data-starting-style:h-0 data-ending-style:h-0",
        className
      )}
      {...props}
    />
  )
}
