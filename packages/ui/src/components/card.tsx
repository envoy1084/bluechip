import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export const cardVariants = cva(
  "relative flex min-w-0 flex-col rounded-lg bg-white text-inherit no-underline",
  {
    variants: {
      variant: {
        default: "shadow-e2",
        flat: "shadow-e1",
        raised: "shadow-e3",
        interactive:
          "cursor-pointer shadow-e2 transition-[box-shadow,translate] duration-base ease-brand hover:-translate-y-0.5 hover:shadow-e3",
        well: "surface-well"
      },
      size: { sm: "gap-3 p-4", md: "gap-4 p-5" }
    },
    defaultVariants: { variant: "default", size: "md" }
  }
)

export interface CardProps extends useRender.ComponentProps<"div">, VariantProps<typeof cardVariants> {}

/**
 * Groups one thing's content and actions: a hairline edge and soft depth, never a heavy border. Make the whole
 * card a link with `variant="interactive"` and `render={<a href="…" />}`.
 */
export function Card({ variant, size, className, render, ...props }: CardProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "card",
      "data-variant": variant ?? "default",
      className: cn(cardVariants({ variant, size }), className),
      ...props
    }
  })
}

/** The top row: title block on the left, `CardAction` on the right. */
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-start justify-between gap-3", className)}
      {...props}
    />
  )
}

export function CardTitle({ className, children, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-[15.5px] leading-snug font-semibold tracking-[-0.015em]", className)}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-label text-g-500", className)} {...props} />
}

/** A control pinned to the header's top-right corner, like a "more" menu. */
export function CardAction({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("-mt-1 -mr-1 shrink-0", className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("grid flex-1 content-start gap-1.5", className)} {...props} />
}

/** Status and actions, under a hairline. */
export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-g-100 pt-3.5",
        className
      )}
      {...props}
    />
  )
}
