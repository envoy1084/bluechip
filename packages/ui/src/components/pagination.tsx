import { useRender } from "@base-ui/react/use-render"
import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button, type ButtonProps } from "./button.tsx"

/**
 * The pages to show for `page` of `total`: the first, the last, and `siblings` either side of the current one, with
 * `"ellipsis"` where pages are skipped. `paginationRange(3, 12)` is `[1, 2, 3, 4, "ellipsis", 12]`.
 */
export function paginationRange(page: number, total: number, siblings = 1): Array<number | "ellipsis"> {
  const shown = new Set([1, total])
  for (let n = page - siblings; n <= page + siblings; n++) {
    if (n >= 1 && n <= total) shown.add(n)
  }
  const sorted = [...shown].sort((a, b) => a - b)
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1]! > 1 ? ["ellipsis" as const, n] : [n]))
}

/** Moves through long lists a page at a time. */
export function Pagination({ className, "aria-label": label = "Pages", ...props }: ComponentProps<"nav">) {
  return <nav data-slot="pagination" aria-label={label} className={cn("flex", className)} {...props} />
}

export function PaginationContent({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="pagination-content" className={cn("flex flex-wrap items-center gap-1", className)} {...props} />
}

export function PaginationItem(props: ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

export interface PaginationLinkProps extends useRender.ComponentProps<"button"> {
  /** Marks the current page, for screen readers too (`aria-current="page"`). */
  readonly isActive?: boolean
}

/** A page number. Renders a `<button>`; pass `render` for a link. */
export function PaginationLink({ className, render, isActive = false, ...props }: PaginationLinkProps) {
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      type: "button",
      ...props,
      "aria-current": isActive ? "page" : undefined,
      "data-slot": "pagination-link",
      className: cn(
        "inline-grid h-[34px] min-w-[34px] cursor-pointer place-items-center rounded-sm px-2 text-[13.5px] font-[550] text-g-600 tabular-nums",
        "hover:bg-g-100 hover:text-ink focus-visible:outline-offset-1",
        "aria-[current=page]:text-ink aria-[current=page]:surface-secondary",
        className
      )
    }
  })
}

const edgeLabelClassName = "max-[480px]:sr-only"

export function PaginationPrevious({ children = "Previous", className, ...props }: ButtonProps) {
  return (
    <Button variant="ghost" size="sm" className={cn("max-[480px]:w-8 max-[480px]:px-0", className)} {...props}>
      <Icon name="chevron-left" size={16} />
      <span className={edgeLabelClassName}>{children}</span>
    </Button>
  )
}

export function PaginationNext({ children = "Next", className, ...props }: ButtonProps) {
  return (
    <Button variant="ghost" size="sm" className={cn("max-[480px]:w-8 max-[480px]:px-0", className)} {...props}>
      <span className={edgeLabelClassName}>{children}</span>
      <Icon name="chevron-right" size={16} />
    </Button>
  )
}

export function PaginationEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="pagination-ellipsis"
      aria-hidden="true"
      className={cn("grid w-7 place-items-center text-g-400", className)}
      {...props}
    >
      <Icon name="more" size={16} />
    </span>
  )
}
