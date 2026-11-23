import { Select as BaseSelect } from "@base-ui/react/select"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { fieldSurface } from "./input.tsx"
import { labelClassName } from "./label.tsx"

/** The floating list surface, shared by `Select` and `Combobox`. */
export const listboxPopupClassName = cn(
  "max-h-[min(380px,var(--available-height))] max-w-[min(320px,calc(100vw-16px))] min-w-[max(200px,var(--anchor-width))] overflow-y-auto overscroll-contain rounded-[12px] bg-white p-[5px] shadow-e3 outline-none",
  "origin-(--transform-origin) transition-[opacity,scale,translate] duration-base ease-brand",
  "data-starting-style:-translate-y-1 data-starting-style:scale-96 data-starting-style:opacity-0",
  "data-ending-style:scale-97 data-ending-style:opacity-0 data-ending-style:duration-[140ms] data-ending-style:ease-brand-in"
)

/** One option row, shared by `Select` and `Combobox`. */
export const listboxItemClassName = cn(
  "relative flex min-h-8 cursor-default items-center gap-[9px] rounded-[7px] px-2 text-[13.5px] whitespace-nowrap text-g-800 outline-none select-none",
  "data-highlighted:bg-g-100 data-highlighted:text-ink data-selected:font-[550] data-disabled:opacity-45"
)

/** Pick one value from a list that opens on click. Type a letter to jump to an option. */
export const Select = BaseSelect.Root

/** The label of a `Select`. Inside a `Field` use `FieldLabel` instead. */
export function SelectLabel({ className, ...props }: ComponentProps<typeof BaseSelect.Label>) {
  return <BaseSelect.Label data-slot="select-label" className={cn(labelClassName, className)} {...props} />
}

export const selectTriggerVariants = cva(
  [
    "flex w-full min-w-0 cursor-pointer items-center gap-2 bg-[linear-gradient(180deg,#fff,var(--color-canvas))] text-left font-sans outline-none",
    fieldSurface,
    "focus-visible:shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(0,0,255,.12)] data-popup-open:shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(0,0,255,.12)]",
    "data-disabled:cursor-not-allowed data-disabled:bg-g-50 data-disabled:bg-none data-disabled:text-g-400 data-disabled:shadow-[0_0_0_1px_rgba(10,11,13,.08)]"
  ],
  {
    variants: {
      size: {
        sm: "h-8 rounded-sm pr-2 pl-2.5 text-label",
        md: "h-[38px] rounded-md pr-2.5 pl-3 text-body-sm"
      }
    },
    defaultVariants: { size: "md" }
  }
)

export interface SelectTriggerProps
  extends ComponentProps<typeof BaseSelect.Trigger>, VariantProps<typeof selectTriggerVariants>
{}

/** The button that shows the chosen value and opens the list. */
export function SelectTrigger({ size, className, children, ...props }: SelectTriggerProps) {
  return (
    <BaseSelect.Trigger
      data-slot="select-trigger"
      className={cn(selectTriggerVariants({ size }), className)}
      {...props}
    >
      {children}
      <BaseSelect.Icon className="ml-auto flex text-g-400 transition-transform duration-base ease-brand in-data-popup-open:rotate-180">
        <Icon name="chevron-down" size={16} />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
}

/** The chosen value, or the placeholder in grey. */
export function SelectValue({ className, ...props }: ComponentProps<typeof BaseSelect.Value>) {
  return (
    <BaseSelect.Value
      data-slot="select-value"
      className={cn(
        "inline-flex min-w-0 items-center gap-2 truncate data-placeholder:text-g-400",
        className
      )}
      {...props}
    />
  )
}

/** The floating list of options, placed under the trigger at its width. */
export function SelectContent({ className, children, ...props }: ComponentProps<typeof BaseSelect.Popup>) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner className="z-50 outline-none" sideOffset={6} alignItemWithTrigger={false}>
        <BaseSelect.Popup data-slot="select-content" className={cn(listboxPopupClassName, className)} {...props}>
          <BaseSelect.List>{children}</BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
}

/** One option. Put extra detail after the text in a `ml-auto` span; the check sits at the end. */
export function SelectItem({ className, children, ...props }: ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item data-slot="select-item" className={cn(listboxItemClassName, className)} {...props}>
      <BaseSelect.ItemText className="flex min-w-0 flex-1 items-center gap-2">{children}</BaseSelect.ItemText>
      <span className="flex w-3.5 shrink-0 justify-end">
        <BaseSelect.ItemIndicator className="flex text-blue">
          <Icon name="check" size={14} strokeWidth={2.2} />
        </BaseSelect.ItemIndicator>
      </span>
    </BaseSelect.Item>
  )
}

/** A titled group of options. */
export function SelectGroup(props: ComponentProps<typeof BaseSelect.Group>) {
  return <BaseSelect.Group data-slot="select-group" {...props} />
}

/** The title of a `SelectGroup`. */
export function SelectGroupLabel({ className, ...props }: ComponentProps<typeof BaseSelect.GroupLabel>) {
  return (
    <BaseSelect.GroupLabel
      data-slot="select-group-label"
      className={cn("px-2 pt-2 pb-1 text-[11.5px] font-semibold tracking-[.01em] text-g-400", className)}
      {...props}
    />
  )
}

/** A hairline between groups. */
export function SelectSeparator({ className, ...props }: ComponentProps<typeof BaseSelect.Separator>) {
  return (
    <BaseSelect.Separator
      data-slot="select-separator"
      className={cn("-mx-[5px] my-[5px] h-px bg-g-100", className)}
      {...props}
    />
  )
}
