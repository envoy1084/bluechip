import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { type ComponentProps, createContext, type ReactNode, useContext, useState } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button } from "./button.tsx"

/** The dimmed, lightly blurred layer under every modal (dialog, alert dialog, sheet). */
export const overlayBackdropClassName = cn(
  // Above sticky page headers (z-10) and anything else a page layers.
  "fixed inset-0 z-50 bg-ink/32 backdrop-blur-[2px]",
  "transition-opacity duration-base ease-brand",
  "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-fast data-ending-style:ease-brand-in"
)

const ModalOpen = createContext(false)

/**
 * Whether a modal is open, controlled or not, and provides it to its content: the root of every modal (dialog,
 * alert dialog, sheet) wraps its children in `provider`.
 */
export function useModalOpen<Details extends { readonly isCanceled: boolean }>(
  { defaultOpen, onOpenChange, open }: {
    readonly open?: boolean | undefined
    readonly defaultOpen?: boolean | undefined
    readonly onOpenChange?: ((open: boolean, details: Details) => void) | undefined
  }
) {
  const [own, setOwn] = useState(defaultOpen ?? false)
  const isOpen = open ?? own

  return {
    open: isOpen,
    onOpenChange: (next: boolean, details: Details) => {
      onOpenChange?.(next, details)
      if (!details.isCanceled) setOwn(next)
    },
    provider: (children: ReactNode) => <ModalOpen.Provider value={isOpen}>{children}</ModalOpen.Provider>
  }
}

/**
 * A modal's content as it was when it started closing. Closing usually resets what it shows (a finished step back to
 * its start, a selection to nothing) while it animates out, which would flash the old content; it keeps the last
 * open content until it's gone.
 */
export function useHeldWhileClosing(children: ReactNode): ReactNode {
  const open = useContext(ModalOpen)
  const [held, setHeld] = useState(children)

  if (open && held !== children) setHeld(children)
  return open ? children : held
}

/** A focused task on top of the page. Traps focus, closes on Esc or outside click, gives focus back. */
export function Dialog({ children, defaultOpen, onOpenChange, open, ...props }: BaseDialog.Root.Props) {
  const modal = useModalOpen({ defaultOpen, onOpenChange, open })
  return modal.provider(
    <BaseDialog.Root open={modal.open} onOpenChange={modal.onOpenChange} {...props}>{children}</BaseDialog.Root>
  )
}

export function DialogTrigger(props: BaseDialog.Trigger.Props) {
  return <BaseDialog.Trigger data-slot="dialog-trigger" {...props} />
}

export function DialogClose(props: BaseDialog.Close.Props) {
  return <BaseDialog.Close data-slot="dialog-close" {...props} />
}

export interface DialogContentProps extends BaseDialog.Popup.Props {
  /** Renders the ghost × button in the top-right corner. */
  readonly showCloseButton?: boolean
}

export function DialogContent({ className, children, showCloseButton = true, ...props }: DialogContentProps) {
  const shown = useHeldWhileClosing(children)
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop data-slot="dialog-backdrop" className={overlayBackdropClassName} />
      <BaseDialog.Viewport data-slot="dialog-viewport" className="fixed inset-0 z-50 grid place-items-center p-4">
        <BaseDialog.Popup
          data-slot="dialog-content"
          className={cn(
            "relative grid max-h-full w-full max-w-[440px] gap-[18px] overflow-y-auto rounded-xl bg-white p-6 shadow-e4 outline-none",
            "transition-[opacity,scale,translate] duration-slow ease-brand",
            "data-starting-style:translate-y-2 data-starting-style:scale-96 data-starting-style:opacity-0",
            "data-ending-style:translate-y-1 data-ending-style:scale-97 data-ending-style:opacity-0 data-ending-style:duration-fast data-ending-style:ease-brand-in",
            className
          )}
          {...props}
        >
          {shown}
          {showCloseButton && (
            <BaseDialog.Close
              data-slot="dialog-close"
              aria-label="Close"
              className="absolute top-3.5 right-3.5"
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <Icon name="close" size={16} />
            </BaseDialog.Close>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("grid gap-1.5 pr-7", className)}
      {...props}
    />
  )
}

/** The dialog's content area. `scrollable` gives long content its own scroll between hairlines. */
export function DialogBody({ className, scrollable = false, ...props }: ComponentProps<"div"> & {
  readonly scrollable?: boolean
}) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "grid gap-3.5",
        scrollable && "-mx-6 max-h-[46vh] overflow-y-auto overscroll-contain border-y border-g-100 px-6 py-4",
        className
      )}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-wrap justify-end gap-2 max-[480px]:*:flex-1", className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: BaseDialog.Title.Props) {
  return (
    <BaseDialog.Title data-slot="dialog-title" className={cn("text-title-3 font-semibold", className)} {...props} />
  )
}

export function DialogDescription({ className, ...props }: BaseDialog.Description.Props) {
  return (
    <BaseDialog.Description
      data-slot="dialog-description"
      className={cn("text-body-sm text-g-600", className)}
      {...props}
    />
  )
}
