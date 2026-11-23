import { NavigationMenu as BaseNavigationMenu } from "@base-ui/react/navigation-menu"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

/** Site navigation with rich panels. Opens on hover or click; Esc closes and returns focus. */
export function NavigationMenu({ className, children, ...props }: BaseNavigationMenu.Root.Props) {
  return (
    <BaseNavigationMenu.Root data-slot="navigation-menu" className={cn("relative", className)} {...props}>
      {children}
      <BaseNavigationMenu.Portal>
        <BaseNavigationMenu.Positioner
          sideOffset={6}
          collisionPadding={8}
          align="start"
          className="z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-base ease-brand data-instant:transition-none"
        >
          <BaseNavigationMenu.Popup
            data-slot="navigation-menu-popup"
            className={cn(
              "relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-white shadow-e3 outline-none",
              "transition-[opacity,scale,width,height] duration-base ease-brand",
              "data-starting-style:scale-96 data-starting-style:opacity-0",
              "data-ending-style:scale-97 data-ending-style:opacity-0 data-ending-style:duration-fast data-ending-style:ease-brand-in"
            )}
          >
            <BaseNavigationMenu.Viewport className="relative size-full overflow-hidden" />
          </BaseNavigationMenu.Popup>
        </BaseNavigationMenu.Positioner>
      </BaseNavigationMenu.Portal>
    </BaseNavigationMenu.Root>
  )
}

export function NavigationMenuList({ className, ...props }: BaseNavigationMenu.List.Props) {
  return (
    <BaseNavigationMenu.List data-slot="navigation-menu-list" className={cn("flex gap-0.5", className)} {...props} />
  )
}

export function NavigationMenuItem(props: BaseNavigationMenu.Item.Props) {
  return <BaseNavigationMenu.Item data-slot="navigation-menu-item" {...props} />
}

/** Trigger and top-level link share this look. */
export const navigationMenuTriggerClassName = cn(
  "inline-flex h-[34px] cursor-pointer items-center gap-[5px] rounded-sm px-[11px] text-body-sm font-medium text-g-700 no-underline outline-none",
  "hover:bg-g-100 hover:text-ink data-popup-open:bg-g-100 data-popup-open:text-ink",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue"
)

export function NavigationMenuTrigger({ className, children, ...props }: BaseNavigationMenu.Trigger.Props) {
  return (
    <BaseNavigationMenu.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerClassName, className)}
      {...props}
    >
      {children}
      <BaseNavigationMenu.Icon className="text-g-400 transition-transform duration-base ease-brand data-popup-open:rotate-180">
        <Icon name="chevron-down" size={14} />
      </BaseNavigationMenu.Icon>
    </BaseNavigationMenu.Trigger>
  )
}

export function NavigationMenuContent({ className, ...props }: BaseNavigationMenu.Content.Props) {
  return (
    <BaseNavigationMenu.Content
      data-slot="navigation-menu-content"
      className={cn(
        "w-[min(620px,calc(100vw-16px))] p-2.5",
        "transition-[opacity,translate] duration-base ease-brand data-starting-style:opacity-0 data-ending-style:opacity-0",
        "data-starting-style:data-[activation-direction=left]:-translate-x-1/4 data-starting-style:data-[activation-direction=right]:translate-x-1/4",
        "data-ending-style:data-[activation-direction=left]:translate-x-1/4 data-ending-style:data-[activation-direction=right]:-translate-x-1/4",
        className
      )}
      {...props}
    />
  )
}

/** A rich link in a panel: icon tile, title and a line of description. */
export function NavigationMenuLink({ className, ...props }: BaseNavigationMenu.Link.Props) {
  return (
    <BaseNavigationMenu.Link
      data-slot="navigation-menu-link"
      className={cn(
        "flex gap-[11px] rounded-[9px] p-2.5 text-ink no-underline outline-none hover:bg-g-100 focus-visible:bg-g-100 focus-visible:shadow-[inset_0_0_0_2px_var(--color-blue)]",
        className
      )}
      {...props}
    />
  )
}
