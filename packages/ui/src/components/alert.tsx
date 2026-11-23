import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

export const alertVariants = cva(
  "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 rounded-lg px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] [&>svg]:row-span-2 [&>svg]:mt-px",
  {
    variants: {
      variant: {
        info: "bg-white shadow-e1 [&>svg]:text-blue",
        success:
          "bg-[linear-gradient(180deg,#fff,var(--color-gain-wash))] shadow-[inset_0_0_0_1px_var(--color-gain-line)] [&>svg]:text-gain",
        warning:
          "bg-[linear-gradient(180deg,#fff,var(--color-warn-wash))] shadow-[inset_0_0_0_1px_var(--color-warn-line)] [&>svg]:text-warn",
        destructive:
          "bg-[linear-gradient(180deg,#fff,var(--color-loss-wash))] shadow-[inset_0_0_0_1px_var(--color-loss-line),0_4px_12px_-6px_rgba(217,58,28,.2)] [&>svg]:text-loss [&_[data-slot=alert-title]]:text-loss"
      }
    },
    defaultVariants: { variant: "info" }
  }
)

const alertIcon: Record<NonNullable<VariantProps<typeof alertVariants>["variant"]>, IconName> = {
  info: "info",
  success: "check-circle",
  warning: "warning",
  destructive: "stop-sign"
}

export interface AlertProps extends ComponentProps<"div">, VariantProps<typeof alertVariants> {
  /** Replaces the variant's icon. */
  readonly icon?: IconName
}

/**
 * A message in the page that stays until it's resolved: say what happened and what to do next. Destructive alerts
 * interrupt screen readers (`role="alert"`); the others wait (`role="status"`).
 */
export function Alert({ variant, icon, className, children, ...props }: AlertProps) {
  const resolved = variant ?? "info"
  return (
    <div
      data-slot="alert"
      data-variant={resolved}
      role={resolved === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon name={icon ?? alertIcon[resolved]} size={18} />
      {children}
    </div>
  )
}

export function AlertTitle({ className, ...props }: ComponentProps<"strong">) {
  return (
    <strong
      data-slot="alert-title"
      className={cn("col-start-2 block text-body-sm font-semibold tracking-[-0.01em]", className)}
      {...props}
    />
  )
}

export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="alert-description" className={cn("col-start-2 text-[13.5px] text-g-600", className)} {...props} />
  )
}

/** Actions on the right of the alert (under the text on phones). */
export function AlertAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "col-start-2 mt-2 flex items-center gap-1.5 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:self-center",
        className
      )}
      {...props}
    />
  )
}
