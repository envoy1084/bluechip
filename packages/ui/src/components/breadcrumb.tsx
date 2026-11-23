import { useRender } from "@base-ui/react/use-render"
import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

/** Where you are and how you got there. */
export function Breadcrumb({ "aria-label": label = "Breadcrumb", ...props }: ComponentProps<"nav">) {
  return <nav data-slot="breadcrumb" aria-label={label} {...props} />
}

export function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn("flex flex-wrap items-center gap-1.5 text-body-sm", className)}
      {...props}
    />
  )
}

export function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return <li data-slot="breadcrumb-item" className={cn("inline-flex items-center", className)} {...props} />
}

/** A step back. Renders an `<a>`; pass `render` to use the router's link. */
export function BreadcrumbLink({ className, render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    render,
    props: {
      ...props,
      "data-slot": "breadcrumb-link",
      className: cn(
        "inline-flex items-center rounded-[5px] text-g-500 no-underline transition-colors duration-fast ease-brand hover:text-ink",
        className
      )
    }
  })
}

export function BreadcrumbPage({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("font-[550] text-ink", className)}
      {...props}
    />
  )
}

export function BreadcrumbSeparator({ className, children, ...props }: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("grid text-g-300", className)}
      {...props}
    >
      {children ?? <Icon name="chevron-right" size={14} />}
    </li>
  )
}

/** Stands in for steps folded away when space is tight; usually the trigger of a menu that lists them. */
export function BreadcrumbEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span data-slot="breadcrumb-ellipsis" className={cn("grid place-items-center", className)} {...props}>
      <Icon name="more" size={16} />
    </span>
  )
}
