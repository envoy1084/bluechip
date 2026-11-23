import { type ReactNode, useState } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button } from "./button.tsx"
import { Checkbox } from "./checkbox.tsx"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./table.tsx"

export interface DataTableColumn<Row> {
  readonly id: string
  readonly header: string
  readonly cell: (row: Row) => ReactNode
  /** Makes the column sortable by this value. */
  readonly sortValue?: (row: Row) => string | number
  /** Right-aligned, tabular figures. */
  readonly numeric?: boolean
}

export interface DataTableSort {
  readonly column: string
  readonly direction: "ascending" | "descending"
}

export interface DataTableProps<Row> {
  readonly columns: ReadonlyArray<DataTableColumn<Row>>
  readonly rows: ReadonlyArray<Row>
  readonly getRowId: (row: Row) => string
  /** Names the table for screen readers (visually hidden). */
  readonly caption: string
  readonly defaultSort?: DataTableSort
  readonly pageSize?: number
  /** Adds a checkbox column. `rowLabel` names each row's checkbox ("Select trade 2858"). */
  readonly selectable?: boolean
  readonly rowLabel?: (row: Row) => string
  readonly defaultSelection?: ReadonlySet<string>
  readonly onSelectionChange?: (selection: ReadonlySet<string>) => void
  /** Shown in the body when there are no rows, usually an `Empty` with `variant="plain"`. */
  readonly empty?: ReactNode
  readonly className?: string
}

const compare = (a: string | number, b: string | number) => (a > b ? 1 : a < b ? -1 : 0)

/**
 * A table you can work with: sort by a column, select rows (or a whole page), page through. Filtering stays with
 * the caller: pass the rows that match.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  caption,
  defaultSort,
  pageSize = 10,
  selectable = false,
  rowLabel,
  defaultSelection,
  onSelectionChange,
  empty,
  className
}: DataTableProps<Row>) {
  const [sort, setSort] = useState(defaultSort)
  const [requestedPage, setPage] = useState(0)
  const [selection, setSelection] = useState<ReadonlySet<string>>(defaultSelection ?? new Set())

  const sortValue = columns.find((column) => column.id === sort?.column)?.sortValue
  const sorted = sortValue === undefined ? rows : [...rows].sort((a, b) => {
    const order = compare(sortValue(a), sortValue(b))
    return sort?.direction === "descending" ? -order : order
  })
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  // The rows can shrink under the current page (a filter); stay on the last page that exists.
  const page = Math.min(requestedPage, pageCount - 1)
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize)
  const pageIds = pageRows.map(getRowId)
  const selectedOnPage = pageIds.filter((id) => selection.has(id)).length
  const selectedCount = rows.filter((row) => selection.has(getRowId(row))).length

  const select = (next: Set<string>) => {
    setSelection(next)
    onSelectionChange?.(next)
  }
  const toggleSort = (column: string) =>
    setSort((current) => ({
      column,
      direction: current?.column === column && current.direction === "ascending" ? "descending" : "ascending"
    }))

  return (
    <div data-slot="data-table" className={cn("grid gap-3", className)}>
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead scope="col" className="w-11 py-2 pr-0 [thead_&]:border-t-0">
                <Checkbox
                  aria-label="Select all on this page"
                  disabled={pageRows.length === 0}
                  checked={pageRows.length > 0 && selectedOnPage === pageRows.length}
                  indeterminate={selectedOnPage > 0 && selectedOnPage < pageRows.length}
                  onCheckedChange={(checked) => {
                    const next = new Set(selection)
                    for (const id of pageIds) {
                      if (checked) next.add(id)
                      else next.delete(id)
                    }
                    select(next)
                  }}
                />
              </TableHead>
            )}
            {columns.map((column) => {
              const direction = sort?.column === column.id ? sort.direction : undefined
              return (
                <TableHead
                  key={column.id}
                  scope="col"
                  numeric={column.numeric ?? false}
                  aria-sort={column.sortValue ? direction ?? "none" : undefined}
                  className="py-2 [thead_&]:border-t-0"
                >
                  {column.sortValue ?
                    (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className={cn(
                          "-mx-1.5 inline-flex cursor-pointer items-center gap-[5px] rounded-xs px-1.5 py-1 hover:bg-g-100 hover:text-ink focus-visible:outline-offset-0",
                          column.numeric && "flex-row-reverse",
                          direction ? "text-ink [&_svg]:text-blue" : "[&_svg]:text-g-300"
                        )}
                      >
                        {column.header}
                        <Icon
                          name={direction === "ascending"
                            ? "arrow-up"
                            : direction === "descending"
                            ? "arrow-down"
                            : "sort"}
                          size={13}
                        />
                      </button>
                    ) :
                    column.header}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.length === 0 ?
            (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="border-b-0 whitespace-normal">
                  {empty ?? <p className="py-8 text-center text-label text-g-500">Nothing here yet.</p>}
                </TableCell>
              </TableRow>
            ) :
            pageRows.map((row) => {
              const id = getRowId(row)
              const selected = selection.has(id)
              return (
                <TableRow key={id} {...(selected ? { "data-selected": "", "aria-selected": true } : {})}>
                  {selectable && (
                    <TableCell className="w-11 pr-0">
                      <Checkbox
                        aria-label={rowLabel ? rowLabel(row) : "Select row"}
                        checked={selected}
                        onCheckedChange={(checked) => {
                          const next = new Set(selection)
                          if (checked) next.add(id)
                          else next.delete(id)
                          select(next)
                        }}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.id} numeric={column.numeric ?? false}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
        </TableBody>
      </Table>
      <div
        data-slot="data-table-footer"
        className="flex flex-wrap items-center justify-between gap-3 text-label-sm text-g-500 tabular-nums"
      >
        <span aria-live="polite">
          {selectable ?
            `${selectedCount} of ${rows.length} row${rows.length === 1 ? "" : "s"} selected` :
            `${rows.length} row${rows.length === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-2">
          <span>Page {page + 1} of {pageCount}</span>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <Icon name="chevron-left" size={16} />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(page + 1)}
          >
            <Icon name="chevron-right" size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
