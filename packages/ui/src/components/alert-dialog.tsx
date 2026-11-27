import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog"
import type { ComponentProps } from "react"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button, type ButtonProps } from "./button.tsx"
import { overlayBackdropClassName, useHeldWhileClosing, useModalOpen } from "./dialog.tsx"

/**
 * Confirms something that can't be undone. Outside clicks don't close it, and focus starts on the first button,
 * so put the safe choice (`AlertDialogCancel`) first.
 */
export function AlertDialog({ children, defaultOpen, onOpenChange, open, ...props }: BaseAlertDialog.Root.Props) {
  const modal = useModalOpen({ defaultOpen, onOpenChange, open })
  return modal.provider(
    <BaseAlertDialog.Root open={modal.open} onOpenChange={modal.onOpenChange} {...props}>
      {children}
    </BaseAlertDialog.Root>
  )
}

export function AlertDialogTrigger(props: BaseAlertDialog.Trigger.Props) {
  return <BaseAlertDialog.Trigger data-slot="alert-dialog-trigger" {...props} />
}

export function AlertDialogContent({ className, children, ...props }: BaseAlertDialog.Popup.Props) {
  const shown = useHeldWhileClosing(children)
  return (
    <BaseAlertDialog.Portal>
      <BaseAlertDialog.Backdrop data-slot="alert-dialog-backdrop" className={overlayBackdropClassName} />
      <BaseAlertDialog.Viewport
        data-slot="alert-dialog-viewport"
        className="fixed inset-0 z-50 grid place-items-center p-4"
      >
        <BaseAlertDialog.Popup
          data-slot="alert-dialog-content"
          className={cn(
            "relative grid max-h-full w-full max-w-[400px] gap-[18px] overflow-y-auto rounded-xl bg-white p-6 shadow-e4 outline-none",
            "transition-[opacity,scale,translate] duration-slow ease-brand",
            "data-starting-style:translate-y-2 data-starting-style:scale-96 data-starting-style:opacity-0",
            "data-ending-style:translate-y-1 data-ending-style:scale-97 data-ending-style:opacity-0 data-ending-style:duration-fast data-ending-style:ease-brand-in",
            className
          )}
          {...props}
        >
          {shown}
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Viewport>
    </BaseAlertDialog.Portal>
  )
}

/** The tinted icon tile above the title. */
export function AlertDialogIcon({ name, className }: { readonly name: IconName; readonly className?: string }) {
  return (
    <div
      data-slot="alert-dialog-icon"
      className={cn(
        "grid size-10 place-items-center rounded-[12px] bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]",
        className
      )}
    >
      <Icon name={name} />
    </div>
  )
}

export function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("grid gap-1.5", className)} {...props} />
}

export function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-wrap justify-end gap-2 max-[480px]:*:flex-1", className)}
      {...props}
    />
  )
}

export function AlertDialogTitle({ className, ...props }: BaseAlertDialog.Title.Props) {
  return (
    <BaseAlertDialog.Title
      data-slot="alert-dialog-title"
      className={cn("text-title-3 font-semibold", className)}
      {...props}
    />
  )
}

export function AlertDialogDescription({ className, ...props }: BaseAlertDialog.Description.Props) {
  return (
    <BaseAlertDialog.Description
      data-slot="alert-dialog-description"
      className={cn("text-body-sm text-g-600", className)}
      {...props}
    />
  )
}

/** The confirming action. It closes the dialog after `onClick` runs. */
export function AlertDialogAction({ variant = "destructive", ...props }: ButtonProps) {
  return (
    <BaseAlertDialog.Close
      data-slot="alert-dialog-action"
      render={<Button variant={variant} {...props} />}
    />
  )
}

/** The safe choice. Place it first so it receives initial focus. */
export function AlertDialogCancel({ variant = "secondary", ...props }: ButtonProps) {
  return (
    <BaseAlertDialog.Close
      data-slot="alert-dialog-cancel"
      render={<Button variant={variant} {...props} />}
    />
  )
}
