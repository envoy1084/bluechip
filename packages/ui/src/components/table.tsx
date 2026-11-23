import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

/** Rows of numbers you compare. The wrapper scrolls sideways on narrow screens. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="overflow-x-auto rounded-lg bg-white shadow-e1">
      <table
        data-slot="table"
        className={cn("w-full min-w-[560px] border-collapse text-body-sm", className)}
        {...props}
      />
    </div>
  )
}

export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("px-4 pt-3.5 pb-2.5 text-left text-label font-semibold text-g-600", className)}
      {...props}
    />
  )
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />
}

export function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-g-50 font-semibold [&_td]:border-b-0 [&_th]:border-b-0", className)}
      {...props}
    />
  )
}

/** A row. Set `data-selected` (and `aria-selected`) on chosen rows to tint them. */
export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "transition-colors duration-fast ease-brand [tbody>&]:hover:bg-g-50 data-selected:bg-blue-50 [tbody>&]:data-selected:hover:bg-blue-100/70",
        className
      )}
      {...props}
    />
  )
}

export interface TableCellProps {
  /** Right-aligned, tabular figures: for every number column. */
  readonly numeric?: boolean
}

const cellBase = "border-b border-g-100 px-4 py-[11px] text-left whitespace-nowrap"
const numericCell = "text-right tabular-nums"

export function TableHead({ numeric = false, className, ...props }: ComponentProps<"th"> & TableCellProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        cellBase,
        "[thead_&]:border-t [thead_&]:border-t-g-100 [thead_&]:bg-g-50 [thead_&]:text-caption [thead_&]:font-semibold [thead_&]:text-g-500",
        numeric && numericCell,
        className
      )}
      {...props}
    />
  )
}

export function TableCell({ numeric = false, className, ...props }: ComponentProps<"td"> & TableCellProps) {
  return <td data-slot="table-cell" className={cn(cellBase, numeric && numericCell, className)} {...props} />
}
