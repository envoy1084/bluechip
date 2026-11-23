import { Drawer as BaseDrawer } from "@base-ui/react/drawer"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

/** A bottom sheet for phones. Swipe it down, tap outside or press Esc to dismiss. */
export function Drawer({ swipeDirection = "down", ...props }: BaseDrawer.Root.Props) {
  return <BaseDrawer.Root swipeDirection={swipeDirection} {...props} />
}

export function DrawerTrigger(props: BaseDrawer.Trigger.Props) {
  return <BaseDrawer.Trigger data-slot="drawer-trigger" {...props} />
}

export function DrawerClose(props: BaseDrawer.Close.Props) {
  return <BaseDrawer.Close data-slot="drawer-close" {...props} />
}

export function DrawerContent({ className, children, ...props }: BaseDrawer.Popup.Props) {
  return (
    <BaseDrawer.Portal>
      <BaseDrawer.Backdrop
        data-slot="drawer-backdrop"
        className={cn(
          "fixed inset-0 bg-ink backdrop-blur-[2px] opacity-[calc(.32*(1-var(--drawer-swipe-progress,0)))]",
          "transition-opacity duration-slow ease-brand data-swiping:duration-0",
          "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*320ms)]"
        )}
      />
      <BaseDrawer.Viewport data-slot="drawer-viewport" className="fixed inset-0 flex items-end justify-center">
        <BaseDrawer.Popup
          data-slot="drawer-content"
          className={cn(
            "grid max-h-[92dvh] w-[min(520px,100vw)] overflow-y-auto overscroll-contain rounded-t-[22px] bg-white pb-[env(safe-area-inset-bottom)] shadow-e4 outline-none",
            "[transform:translateY(var(--drawer-swipe-movement-y,0px))] transition-transform duration-slow ease-brand data-swiping:duration-0 data-swiping:select-none",
            "data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)]",
            "data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*320ms)]",
            className
          )}
          {...props}
        >
          <div
            aria-hidden="true"
            data-slot="drawer-handle"
            className="relative h-[26px] w-full cursor-grab touch-none before:absolute before:top-2.5 before:left-1/2 before:h-[5px] before:w-10 before:-translate-x-1/2 before:rounded-full before:bg-g-200 active:cursor-grabbing"
          />
          <BaseDrawer.Content data-slot="drawer-body" className="grid gap-[18px] px-[22px] pt-1.5 pb-[22px]">
            {children}
          </BaseDrawer.Content>
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
    </BaseDrawer.Portal>
  )
}

export function DrawerHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("grid justify-items-center gap-1.5 text-center", className)}
      {...props}
    />
  )
}

export function DrawerFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="drawer-footer" className={cn("grid gap-2", className)} {...props} />
}

export function DrawerTitle({ className, ...props }: BaseDrawer.Title.Props) {
  return (
    <BaseDrawer.Title data-slot="drawer-title" className={cn("text-title-3 font-semibold", className)} {...props} />
  )
}

export function DrawerDescription({ className, ...props }: BaseDrawer.Description.Props) {
  return (
    <BaseDrawer.Description
      data-slot="drawer-description"
      className={cn("text-body-sm text-g-600", className)}
      {...props}
    />
  )
}
