import { Menu } from "@base-ui/react/menu"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { popMotionClassName } from "./popover.tsx"

/** The menu panel shared by dropdown, context and menubar menus. */
export const menuPopupClassName = cn(
  "max-h-[min(380px,var(--available-height))] min-w-[200px] max-w-[min(320px,calc(100vw-16px))] overflow-y-auto overscroll-contain",
  "rounded-[12px] bg-white p-[5px] shadow-e3 outline-none",
  popMotionClassName
)

export const dropdownMenuItemVariants = cva(
  [
    "relative flex min-h-8 cursor-default items-center gap-[9px] rounded-[7px] px-2 text-[13.5px] whitespace-nowrap text-g-800 outline-none select-none",
    "data-highlighted:bg-g-100 data-highlighted:text-ink data-popup-open:bg-g-100",
    "data-disabled:opacity-45",
    "[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-g-500 data-highlighted:[&>svg]:text-ink"
  ],
  {
    variants: {
      variant: {
        default: "",
        destructive:
          "text-loss data-highlighted:bg-loss-wash data-highlighted:text-loss [&>svg]:text-loss data-highlighted:[&>svg]:text-loss"
      },
      inset: { true: "pl-8", false: "" }
    },
    defaultVariants: { variant: "default", inset: false }
  }
)

/** Actions and settings behind a button: groups, check items, submenus and shortcuts. */
export function DropdownMenu(props: Menu.Root.Props) {
  return <Menu.Root {...props} />
}

export function DropdownMenuTrigger(props: Menu.Trigger.Props) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

export interface DropdownMenuContentProps
  extends Menu.Popup.Props, Pick<Menu.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset">
{}

export function DropdownMenuContent(
  { className, side = "bottom", align = "start", sideOffset = 6, alignOffset = 0, ...props }: DropdownMenuContentProps
) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={8}
        className="z-50 outline-none"
      >
        <Menu.Popup data-slot="dropdown-menu-content" className={cn(menuPopupClassName, className)} {...props} />
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function DropdownMenuGroup(props: Menu.Group.Props) {
  return <Menu.Group data-slot="dropdown-menu-group" {...props} />
}

/** A heading for a `DropdownMenuGroup`; place it inside the group it names. */
export function DropdownMenuLabel({ className, ...props }: Menu.GroupLabel.Props) {
  return (
    <Menu.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn("px-2 pt-2 pb-1 text-caption font-semibold text-g-400", className)}
      {...props}
    />
  )
}

export interface DropdownMenuItemProps extends Menu.Item.Props, VariantProps<typeof dropdownMenuItemVariants> {}

export function DropdownMenuItem({ className, variant, inset, ...props }: DropdownMenuItemProps) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      data-variant={variant ?? "default"}
      className={cn(dropdownMenuItemVariants({ variant, inset }), className)}
      {...props}
    />
  )
}

const indicatorClassName = "grid size-4 shrink-0 place-items-center"

export function DropdownMenuCheckboxItem({ className, children, ...props }: Menu.CheckboxItem.Props) {
  return (
    <Menu.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(dropdownMenuItemVariants(), className)}
      {...props}
    >
      <span className={indicatorClassName}>
        <Menu.CheckboxItemIndicator className="text-blue">
          <Icon name="check" size={14} strokeWidth={2.2} />
        </Menu.CheckboxItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  )
}

export function DropdownMenuRadioGroup(props: Menu.RadioGroup.Props) {
  return <Menu.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

export function DropdownMenuRadioItem({ className, children, ...props }: Menu.RadioItem.Props) {
  return (
    <Menu.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(dropdownMenuItemVariants(), className)}
      {...props}
    >
      <span className={indicatorClassName}>
        <Menu.RadioItemIndicator className="size-[7px] rounded-full bg-blue" />
      </span>
      {children}
    </Menu.RadioItem>
  )
}

export function DropdownMenuSeparator({ className, ...props }: Menu.Separator.Props) {
  return (
    <Menu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-[5px] my-[5px] h-px bg-g-100", className)}
      {...props}
    />
  )
}

export function DropdownMenuShortcut({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="dropdown-menu-shortcut"
      className={cn("ml-auto pl-4 font-sans text-caption tracking-[.04em] text-g-400", className)}
      {...props}
    />
  )
}

export function DropdownMenuSub(props: Menu.SubmenuRoot.Props) {
  return <Menu.SubmenuRoot {...props} />
}

export function DropdownMenuSubTrigger({ className, children, ...props }: Menu.SubmenuTrigger.Props) {
  return (
    <Menu.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn(dropdownMenuItemVariants(), className)}
      {...props}
    >
      {children}
      <Icon name="chevron-right" size={14} className="ml-auto text-g-400" />
    </Menu.SubmenuTrigger>
  )
}

export function DropdownMenuSubContent(
  { side = "right", align = "start", sideOffset = 4, alignOffset = -5, ...props }: DropdownMenuContentProps
) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      side={side}
      align={align}
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      {...props}
    />
  )
}
