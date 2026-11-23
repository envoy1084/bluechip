import { Menu } from "@base-ui/react/menu"
import { Menubar as BaseMenubar } from "@base-ui/react/menubar"
import { cn } from "../lib/cn.ts"

// Menubar menus use the dropdown menu's panel and items.
export {
  DropdownMenuCheckboxItem as MenubarCheckboxItem,
  DropdownMenuContent as MenubarContent,
  DropdownMenuGroup as MenubarGroup,
  DropdownMenuItem as MenubarItem,
  DropdownMenuLabel as MenubarLabel,
  DropdownMenuRadioGroup as MenubarRadioGroup,
  DropdownMenuRadioItem as MenubarRadioItem,
  DropdownMenuSeparator as MenubarSeparator,
  DropdownMenuShortcut as MenubarShortcut,
  DropdownMenuSub as MenubarSub,
  DropdownMenuSubContent as MenubarSubContent,
  DropdownMenuSubTrigger as MenubarSubTrigger
} from "./dropdown-menu.tsx"

/** A row of menus, desktop-app style. Left and Right move across menus while one is open. */
export function Menubar({ className, ...props }: BaseMenubar.Props) {
  return (
    <BaseMenubar
      data-slot="menubar"
      className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[11px] bg-white p-1 shadow-e1", className)}
      {...props}
    />
  )
}

export function MenubarMenu(props: Menu.Root.Props) {
  return <Menu.Root {...props} />
}

export function MenubarTrigger({ className, ...props }: Menu.Trigger.Props) {
  return (
    <Menu.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "h-[30px] shrink-0 cursor-pointer rounded-[7px] px-3 text-[13.5px] font-[550] text-g-700 outline-none",
        "hover:bg-g-100 hover:text-ink data-popup-open:bg-g-100 data-popup-open:text-ink",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue",
        className
      )}
      {...props}
    />
  )
}
