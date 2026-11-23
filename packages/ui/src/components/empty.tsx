import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export const emptyVariants = cva("grid justify-items-center rounded-lg text-center", {
  variants: {
    variant: {
      default: "bg-white shadow-e1",
      outline: "border-[1.5px] border-dashed border-g-200 bg-transparent",
      // Inside another surface, like an empty table body.
      plain: "bg-transparent"
    },
    size: {
      sm:
        "gap-1.5 px-[18px] py-[22px] [&_[data-slot=empty-title]]:text-[14.5px] [&_[data-slot=empty-description]]:text-label",
      md: "gap-2.5 px-6 py-10"
    }
  },
  defaultVariants: { variant: "default", size: "md" }
})

export interface EmptyProps extends ComponentProps<"div">, VariantProps<typeof emptyVariants> {}

/** What goes here, why it's empty, and the one thing to do next. */
export function Empty({ variant, size, className, ...props }: EmptyProps) {
  return (
    <div
      data-slot="empty"
      data-size={size ?? "md"}
      className={cn(emptyVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export const emptyMediaVariants = cva("grid place-items-center", {
  variants: {
    variant: {
      icon:
        "mb-1 size-[52px] rounded-2xl bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] text-blue shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_var(--color-info-line),0_6px_16px_-6px_rgba(42, 91, 255,.25)] in-data-[size=sm]:mb-0.5 in-data-[size=sm]:size-[38px] in-data-[size=sm]:rounded-[11px]",
      default: "text-g-300"
    }
  },
  defaultVariants: { variant: "icon" }
})

export interface EmptyMediaProps extends ComponentProps<"div">, VariantProps<typeof emptyMediaVariants> {}

/** The icon above the title: a blue tile (`icon`) or a plain grey glyph (`default`). */
export function EmptyMedia({ variant, className, ...props }: EmptyMediaProps) {
  return <div data-slot="empty-media" className={cn(emptyMediaVariants({ variant }), className)} {...props} />
}

export function EmptyTitle({ className, children, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="empty-title"
      className={cn("text-body-lg font-semibold tracking-[-0.015em]", className)}
      {...props}
    >
      {children}
    </h3>
  )
}

export function EmptyDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("max-w-[42ch] text-[13.5px] text-g-600", className)}
      {...props}
    />
  )
}

/** The next step: usually one primary button and a quiet one. */
export function EmptyContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("mt-1.5 flex flex-wrap justify-center gap-2.5", className)}
      {...props}
    />
  )
}
