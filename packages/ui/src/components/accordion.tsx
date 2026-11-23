import { Accordion as BaseAccordion } from "@base-ui/react/accordion"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

/** Stacked questions that open one at a time (`multiple` opens several). Arrow keys move between them. */
export function Accordion({ className, ...props }: BaseAccordion.Root.Props) {
  return (
    <BaseAccordion.Root
      data-slot="accordion"
      className={cn("rounded-lg bg-white px-5 shadow-e1", className)}
      {...props}
    />
  )
}

export function AccordionItem({ className, ...props }: BaseAccordion.Item.Props) {
  return (
    <BaseAccordion.Item
      data-slot="accordion-item"
      className={cn("border-b border-g-100 last:border-b-0", className)}
      {...props}
    />
  )
}

export function AccordionTrigger({ className, children, ...props }: BaseAccordion.Trigger.Props) {
  return (
    <BaseAccordion.Header data-slot="accordion-header" className="m-0">
      <BaseAccordion.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-4 py-[18px] text-left text-body font-[550] tracking-[-0.01em] text-ink",
          "hover:not-data-disabled:text-blue data-disabled:cursor-not-allowed data-disabled:text-g-400",
          "focus-visible:rounded-[6px] focus-visible:outline-offset-2",
          "[&>svg]:shrink-0 [&>svg]:text-g-400 [&>svg]:transition-transform [&>svg]:duration-base [&>svg]:ease-brand data-panel-open:[&>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <Icon name="chevron-down" size={16} />
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  )
}

export function AccordionContent({ className, children, ...props }: BaseAccordion.Panel.Props) {
  return (
    <BaseAccordion.Panel
      data-slot="accordion-content"
      className={cn(
        "h-(--accordion-panel-height) overflow-hidden transition-[height] duration-slow ease-brand",
        "data-starting-style:h-0 data-ending-style:h-0"
      )}
      {...props}
    >
      <div className={cn("max-w-[64ch] pb-[18px] text-body-sm text-g-600", className)}>{children}</div>
    </BaseAccordion.Panel>
  )
}
