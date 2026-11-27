import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button } from "./button.tsx"
import { overlayBackdropClassName, useHeldWhileClosing, useModalOpen } from "./dialog.tsx"

export const sheetVariants = cva(
  [
    "fixed z-50 flex flex-col bg-white shadow-e4 outline-none",
    "transition-transform duration-slow ease-brand data-ending-style:duration-[180ms] data-ending-style:ease-brand-in"
  ],
  {
    variants: {
      side: {
        right: [
          "inset-y-0 right-0 w-[min(400px,92vw)] rounded-none pt-[env(safe-area-inset-top)]",
          "data-starting-style:translate-x-full data-ending-style:translate-x-full"
        ],
        left: [
          "inset-y-0 left-0 w-[min(300px,86vw)] rounded-none pt-[env(safe-area-inset-top)]",
          "data-starting-style:-translate-x-full data-ending-style:-translate-x-full"
        ],
        top: [
          "inset-x-0 top-0 max-h-[80dvh] rounded-b-xl pt-[env(safe-area-inset-top)]",
          "data-starting-style:-translate-y-full data-ending-style:-translate-y-full"
        ],
        bottom: [
          "inset-x-0 bottom-0 max-h-[80dvh] rounded-t-xl",
          "data-starting-style:translate-y-full data-ending-style:translate-y-full"
        ]
      }
    },
    defaultVariants: { side: "right" }
  }
)

/** A panel that slides in from an edge, for details you can read without leaving the page. Modal. */
export function Sheet({ children, defaultOpen, onOpenChange, open, ...props }: BaseDialog.Root.Props) {
  const modal = useModalOpen({ defaultOpen, onOpenChange, open })
  return modal.provider(
    <BaseDialog.Root open={modal.open} onOpenChange={modal.onOpenChange} {...props}>{children}</BaseDialog.Root>
  )
}

export function SheetTrigger(props: BaseDialog.Trigger.Props) {
  return <BaseDialog.Trigger data-slot="sheet-trigger" {...props} />
}

export function SheetClose(props: BaseDialog.Close.Props) {
  return <BaseDialog.Close data-slot="sheet-close" {...props} />
}

export interface SheetContentProps extends BaseDialog.Popup.Props, VariantProps<typeof sheetVariants> {
  readonly showCloseButton?: boolean
}

export function SheetContent({ side, className, children, showCloseButton = true, ...props }: SheetContentProps) {
  const shown = useHeldWhileClosing(children)
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop data-slot="sheet-backdrop" className={overlayBackdropClassName} />
      <BaseDialog.Popup
        data-slot="sheet-content"
        data-side={side ?? "right"}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {shown}
        {showCloseButton && (
          <BaseDialog.Close
            data-slot="sheet-close"
            aria-label="Close"
            className="absolute top-3.5 right-3.5"
            render={<Button variant="ghost" size="icon-sm" />}
          >
            <Icon name="close" size={16} />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("grid gap-1 border-b border-g-100 px-6 pt-[22px] pb-4 pr-14", className)}
      {...props}
    />
  )
}

export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        "grid flex-1 grid-cols-1 content-start gap-5 overflow-y-auto overscroll-contain px-6 py-5",
        className
      )}
      {...props}
    />
  )
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex justify-between gap-2 border-t border-g-100 px-6 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  )
}

export function SheetTitle({ className, ...props }: BaseDialog.Title.Props) {
  return <BaseDialog.Title data-slot="sheet-title" className={cn("text-title-3 font-semibold", className)} {...props} />
}

export function SheetDescription({ className, ...props }: BaseDialog.Description.Props) {
  return (
    <BaseDialog.Description
      data-slot="sheet-description"
      className={cn("text-body-sm text-g-600", className)}
      {...props}
    />
  )
}
