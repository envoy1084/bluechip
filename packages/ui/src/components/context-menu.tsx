import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu"
import { cn } from "../lib/cn.ts"
import { menuPopupClassName } from "./dropdown-menu.tsx"

// A context menu's items are the dropdown menu's items (Base UI shares one Menu implementation).
export {
  DropdownMenuCheckboxItem as ContextMenuCheckboxItem,
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuLabel as ContextMenuLabel,
  DropdownMenuRadioGroup as ContextMenuRadioGroup,
  DropdownMenuRadioItem as ContextMenuRadioItem,
  DropdownMenuSeparator as ContextMenuSeparator,
  DropdownMenuShortcut as ContextMenuShortcut,
  DropdownMenuSub as ContextMenuSub,
  DropdownMenuSubContent as ContextMenuSubContent,
  DropdownMenuSubTrigger as ContextMenuSubTrigger
} from "./dropdown-menu.tsx"

/** Actions for the thing under the pointer. Opens on right-click or long-press. */
export function ContextMenu(props: BaseContextMenu.Root.Props) {
  return <BaseContextMenu.Root {...props} />
}

export function ContextMenuTrigger(props: BaseContextMenu.Trigger.Props) {
  return <BaseContextMenu.Trigger data-slot="context-menu-trigger" {...props} />
}

export function ContextMenuContent({ className, ...props }: BaseContextMenu.Popup.Props) {
  return (
    <BaseContextMenu.Portal>
      <BaseContextMenu.Positioner collisionPadding={8} className="z-50 outline-none">
        <BaseContextMenu.Popup
          data-slot="context-menu-content"
          className={cn(menuPopupClassName, className)}
          {...props}
        />
      </BaseContextMenu.Positioner>
    </BaseContextMenu.Portal>
  )
}
