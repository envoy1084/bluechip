import { Button as BaseButton } from "@base-ui/react/button"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"
import { type Haptic, haptic as playHaptic } from "../lib/haptics.ts"
import { Spinner } from "./spinner.tsx"

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-sans font-[550] select-none",
    "transition-[transform,box-shadow,filter,background-color] duration-base ease-brand",
    "active:translate-y-px active:scale-[.985]",
    "disabled:pointer-events-none disabled:opacity-45 disabled:grayscale aria-busy:opacity-100 aria-busy:grayscale-0",
    "[&_svg]:shrink-0"
  ],
  {
    variants: {
      variant: {
        primary: "surface-primary hover:brightness-110",
        secondary: "surface-secondary hover:bg-[linear-gradient(180deg,#fff_0%,#f1f2f5_100%)]",
        outline: "bg-transparent text-ink shadow-[0_0_0_1px_rgba(10,11,13,.14)] hover:bg-g-50",
        ghost: "bg-transparent text-g-700 hover:bg-g-100 hover:text-ink",
        danger: "surface-danger hover:bg-[linear-gradient(180deg,#fff_0%,#ffefe9_100%)]",
        // Solid red, only for confirming an irreversible step (e.g. "Remove agent" in an alert dialog).
        destructive:
          "bg-[linear-gradient(180deg,#e2492b_0%,var(--color-loss)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_0_0_1px_#b02c13,0_1px_2px_rgba(120,20,0,.18),0_4px_10px_-4px_rgba(204,53,25,.26)] hover:brightness-110",
        link: "h-auto bg-transparent px-0 text-blue underline-offset-4 hover:underline active:scale-100"
      },
      size: {
        xs: "h-7 rounded-sm px-2.5 text-caption [&_svg]:size-3.5",
        sm: "h-[30px] rounded-sm px-[11px] text-label [&_svg]:size-4",
        md: "h-[38px] rounded-md px-4 text-body-sm [&_svg]:size-4",
        lg: "h-[46px] rounded-[12px] px-5 text-body [&_svg]:size-[18px]",
        icon: "size-[38px] rounded-md p-0 [&_svg]:size-[18px]",
        "icon-sm": "size-[30px] rounded-sm p-0 [&_svg]:size-4",
        "icon-lg": "size-[46px] rounded-[12px] p-0 [&_svg]:size-5"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
)

export interface ButtonProps extends ComponentProps<typeof BaseButton>, VariantProps<typeof buttonVariants> {
  /** Shows a spinner, keeps the width, and blocks presses. */
  readonly loading?: boolean
  /** A haptic on phones when pressed: `success` for the press that finishes something, `nudge` before a weighty one. */
  readonly haptic?: Extract<Haptic, "tap" | "success" | "nudge" | "error">
}

/** The bluechip button. `primary` is for the one action that matters on a screen. */
export function Button(
  { variant, size, loading = false, haptic, disabled, className, children, onClick, ...props }: ButtonProps
) {
  return (
    <BaseButton
      data-slot="button"
      data-variant={variant ?? "primary"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={(event) => {
        if (haptic !== undefined) playHaptic(haptic)
        onClick?.(event)
      }}
      {...props}
    >
      {loading ?
        (
          <>
            <span className="invisible inline-flex items-center gap-2">{children}</span>
            <span className="absolute inset-0 grid place-items-center">
              <Spinner />
            </span>
          </>
        ) :
        children}
    </BaseButton>
  )
}

export interface ButtonLinkProps extends useRender.ComponentProps<"a">, VariantProps<typeof buttonVariants> {}

/**
 * A link that looks like a button: pass the router's link as `render` (`render={<Link to="/stocks" />}`). It stays a
 * link to assistive technology, unlike a `Button` rendered as one, which takes the role `button`.
 */
export function ButtonLink({ variant, size, className, render, ...props }: ButtonLinkProps) {
  return useRender({
    defaultTagName: "a",
    render,
    props: {
      ...props,
      "data-slot": "button",
      "data-variant": variant ?? "primary",
      className: cn(buttonVariants({ variant, size }), className)
    }
  })
}
