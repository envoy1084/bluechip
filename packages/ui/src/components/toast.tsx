import { Toast } from "@base-ui/react/toast"
import type { ReactNode } from "react"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button } from "./button.tsx"
import { Spinner } from "./spinner.tsx"

export type ToastType = "default" | "success" | "error" | "warning" | "info" | "loading"

export interface ToastOptions {
  readonly description?: ReactNode
  /** A button in the toast, such as Undo. Pressing it runs `onClick` and dismisses the toast. */
  readonly action?: { readonly label: string; readonly onClick: () => void }
  /** Milliseconds before it dismisses itself; `0` keeps it. Loading toasts stay until updated. */
  readonly duration?: number
  /** Reuse an id to replace a toast in place. */
  readonly id?: string
}

export interface ToastUpdate extends Omit<ToastOptions, "id"> {
  readonly title?: ReactNode
  readonly type?: ToastType
}

const DEFAULT_DURATION = 4500

// One manager for the whole app, so `toast()` works from anywhere, even outside React.
const manager = Toast.createToastManager()

/**
 * What Base UI's toast manager gets for a toast: errors jump the queue, loading toasts stay until updated, others
 * leave after `DEFAULT_DURATION` unless `duration` says otherwise. An update without a `type` keeps the toast's.
 */
export const toastManagerOptions = ({ title, type, description, action, duration }: ToastUpdate) => ({
  ...(title !== undefined && { title }),
  ...(description !== undefined && { description }),
  ...(type !== undefined && {
    type,
    priority: type === "error" ? "high" as const : "low" as const,
    timeout: duration ?? (type === "loading" ? 0 : DEFAULT_DURATION)
  }),
  ...(type === undefined && duration !== undefined && { timeout: duration }),
  ...(action !== undefined && {
    actionProps: { children: action.label, onClick: action.onClick }
  })
})

const show = (title: ReactNode, options: ToastOptions & { readonly type?: ToastType } = {}): string =>
  manager.add({
    ...toastManagerOptions({ ...options, title, type: options.type ?? "default" }),
    ...(options.id !== undefined && { id: options.id })
  })

/** A loading toast that turns into success or error when the promise settles. */
function promiseToast<A>(
  promise: Promise<A>,
  messages: {
    readonly loading: ReactNode
    readonly success: ReactNode | ((value: A) => ReactNode)
    readonly error: ReactNode | ((error: unknown) => ReactNode)
    readonly description?: ReactNode
  }
): Promise<A> {
  const id = show(messages.loading, { description: messages.description, type: "loading" })
  const settle = (type: "success" | "error", title: ReactNode) =>
    manager.update(id, toastManagerOptions({ type, title, description: null }))
  promise.then(
    (value) => settle("success", typeof messages.success === "function" ? messages.success(value) : messages.success),
    (error: unknown) => settle("error", typeof messages.error === "function" ? messages.error(error) : messages.error)
  )
  return promise
}

/**
 * Shows a toast. Brief confirmation after an action; stacks in the corner, expands on hover and pauses while read.
 * Returns the toast's id for `toast.update` and `toast.dismiss`. Needs one `<Toaster />` mounted in the app.
 */
export const toast = Object.assign(show, {
  success: (title: ReactNode, options?: ToastOptions) => show(title, { ...options, type: "success" }),
  error: (title: ReactNode, options?: ToastOptions) => show(title, { ...options, type: "error" }),
  warning: (title: ReactNode, options?: ToastOptions) => show(title, { ...options, type: "warning" }),
  info: (title: ReactNode, options?: ToastOptions) => show(title, { ...options, type: "info" }),
  loading: (title: ReactNode, options?: ToastOptions) => show(title, { ...options, type: "loading" }),
  update: (id: string, update: ToastUpdate) => manager.update(id, toastManagerOptions(update)),
  /** Dismisses one toast, or every toast without an id. */
  dismiss: (id?: string) => manager.close(id),
  promise: promiseToast
})

const TYPE_ICON: Partial<Record<ToastType, { readonly name: IconName; readonly className: string }>> = {
  success: { name: "check-circle", className: "text-gain" },
  error: { name: "error", className: "text-loss" },
  warning: { name: "warning", className: "text-warn" },
  info: { name: "info", className: "text-g-600" }
}

function ToastIcon({ type }: { readonly type: string | undefined }) {
  if (type === "loading") {
    return <Spinner size={18} className="mt-px text-blue" />
  }
  const icon = TYPE_ICON[type as ToastType]
  return icon ? <Icon name={icon.name} size={18} className={cn("mt-px", icon.className)} /> : null
}

function ToastList() {
  const { toasts, close } = Toast.useToastManager()
  return toasts.map((item) => (
    <Toast.Root
      key={item.id}
      toast={item}
      data-slot="toast"
      className={cn(
        "group/toast absolute right-0 bottom-0 left-0 z-[calc(1000-var(--toast-index))] origin-bottom rounded-[14px] bg-white shadow-e3 select-none",
        "[--gap:10px] [--peek:12px] [--scale:calc(max(0,1-(var(--toast-index)*0.05)))] [--shrink:calc(1-var(--scale))]",
        "[--height:var(--toast-frontmost-height,var(--toast-height))]",
        "[--offset-y:calc(var(--toast-offset-y)*-1+var(--toast-index)*var(--gap)*-1+var(--toast-swipe-movement-y))]",
        "h-(--height) data-expanded:h-(--toast-height)",
        "[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-var(--toast-index)*var(--peek)-var(--shrink)*var(--height)))_scale(var(--scale))]",
        "data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-starting-style:[transform:translateY(110%)] data-limited:opacity-0",
        "data-ending-style:opacity-0 [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(calc(var(--offset-y)+16px))]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        // In and restacking on the spring, so a new toast lands with a small settle; out on the plain ease-in.
        "[transition:transform_440ms_var(--ease-spring),opacity_200ms_var(--ease-brand),height_360ms_var(--ease-brand)]",
        "data-ending-style:[transition:transform_240ms_var(--ease-brand-in),opacity_200ms_var(--ease-brand-in)]"
      )}
    >
      <Toast.Content
        data-slot="toast-content"
        className="flex items-start gap-2.5 overflow-hidden px-3.5 py-[13px] transition-opacity duration-base ease-brand data-behind:opacity-0 data-expanded:opacity-100"
      >
        <ToastIcon type={item.type} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <Toast.Title className="text-body-sm font-semibold tracking-[-0.01em]" />
          <Toast.Description className="text-label leading-[1.45] text-g-600" />
        </div>
        {item.actionProps && (
          <Toast.Action
            data-slot="toast-action"
            className="self-center"
            onClick={() => close(item.id)}
            render={<Button variant="secondary" size="xs" />}
          />
        )}
        <Toast.Close
          aria-label="Dismiss"
          data-slot="toast-close"
          className={cn(
            "-mt-0.5 -mr-1 grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-g-400 opacity-0",
            "transition-[opacity,background-color] duration-fast ease-brand hover:bg-g-100 hover:text-ink",
            "group-hover/toast:opacity-100 focus-visible:opacity-100"
          )}
        >
          <Icon name="close" size={14} />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}

/** Where toasts appear: the bottom-right corner (full width on phones), three at a time. Mount it once. */
export function Toaster({ limit = 3 }: { readonly limit?: number }) {
  return (
    <Toast.Provider toastManager={manager} limit={limit} timeout={DEFAULT_DURATION}>
      <Toast.Portal>
        <Toast.Viewport
          data-slot="toaster"
          className="fixed right-4 bottom-4 left-4 z-[120] outline-none sm:right-5 sm:bottom-5 sm:left-auto sm:w-[360px]"
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
