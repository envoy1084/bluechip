import { Combobox as BaseCombobox } from "@base-ui/react/combobox"
import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { inputGroupVariants } from "./input-group.tsx"
import { listboxItemClassName, listboxPopupClassName } from "./select.tsx"

/**
 * Search a long list as you type, then pick one. Pass `items` and render them with `ComboboxList`; arrows move,
 * Enter picks, Escape closes.
 */
export const Combobox = BaseCombobox.Root

export interface ComboboxInputProps extends ComponentProps<typeof BaseCombobox.Input> {
  /** Shows a button that opens the full list. */
  readonly showTrigger?: boolean
}

/** The search field: a magnifier, the input and a show-all button, styled as one input group. */
export function ComboboxInput({ showTrigger = true, className, ...props }: ComboboxInputProps) {
  return (
    <BaseCombobox.InputGroup data-slot="combobox-input-group" className={cn(inputGroupVariants(), className)}>
      <Icon name="search" size={16} />
      <BaseCombobox.Input
        data-slot="combobox-input"
        className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-inherit outline-none placeholder:text-g-400"
        {...props}
      />
      {showTrigger && (
        <BaseCombobox.Trigger
          aria-label="Show all"
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[7px] text-g-500 hover:bg-g-100 hover:text-ink [&_svg]:transition-transform [&_svg]:duration-base data-popup-open:[&_svg]:rotate-180"
        >
          <Icon name="chevron-down" size={16} />
        </BaseCombobox.Trigger>
      )}
    </BaseCombobox.InputGroup>
  )
}

/** The floating panel under the input, at its width. Holds `ComboboxEmpty` and `ComboboxList`. */
export function ComboboxContent({ className, ...props }: ComponentProps<typeof BaseCombobox.Popup>) {
  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner className="z-50 outline-none" sideOffset={6}>
        <BaseCombobox.Popup
          data-slot="combobox-content"
          className={cn(listboxPopupClassName, "w-(--anchor-width) scroll-py-[5px]", className)}
          {...props}
        />
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  )
}

/** The filtered options. Pass a render function: `{(item) => <ComboboxItem value={item} />}`. */
export function ComboboxList({ className, ...props }: ComponentProps<typeof BaseCombobox.List>) {
  return <BaseCombobox.List data-slot="combobox-list" className={cn("outline-none", className)} {...props} />
}

/** One option, with a check at the end once chosen. */
export function ComboboxItem({ className, children, ...props }: ComponentProps<typeof BaseCombobox.Item>) {
  return (
    <BaseCombobox.Item data-slot="combobox-item" className={cn(listboxItemClassName, className)} {...props}>
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      <span className="flex w-3.5 shrink-0 justify-end">
        <BaseCombobox.ItemIndicator className="flex text-blue">
          <Icon name="check" size={14} strokeWidth={2.2} />
        </BaseCombobox.ItemIndicator>
      </span>
    </BaseCombobox.Item>
  )
}

/** Shown in place of the list when nothing matches. Say what was searched and what exists. */
export function ComboboxEmpty({ className, ...props }: ComponentProps<typeof BaseCombobox.Empty>) {
  return (
    <BaseCombobox.Empty
      data-slot="combobox-empty"
      className={cn(
        "px-3 text-center text-label whitespace-normal text-g-500 not-empty:py-[18px]",
        className
      )}
      {...props}
    />
  )
}
