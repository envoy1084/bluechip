import {
  type ColumnDef,
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  functionalUpdate,
  metaHelper,
  type RowData,
  rowPaginationFeature,
  rowSelectionFeature,
  type RowSelectionState,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  type Updater,
  useTable
} from "@tanstack/react-table"
import { type ReactNode, useMemo, useState } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button } from "./button.tsx"
import { Checkbox } from "./checkbox.tsx"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "./dropdown-menu.tsx"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./table.tsx"

export interface DataTableColumn<Row> {
  readonly id: string
  readonly header: string
  readonly cell: (row: Row) => ReactNode
  /** Makes the column sortable by this value. */
  readonly sortValue?: (row: Row) => string | number
  /** Right-aligned, tabular figures. */
  readonly numeric?: boolean
  /** Set `false` to keep the column out of the "Columns" menu (it can't be hidden). */
  readonly hideable?: boolean
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
  /** Column ids hidden at first; people can show them again from the "Columns" menu. */
  readonly defaultHiddenColumns?: ReadonlyArray<string>
  /** Controls shown before the "Columns" menu, usually a filter input. */
  readonly toolbar?: ReactNode
  /** Shown in the body when there are no rows, usually an `Empty` with `variant="plain"`. */
  readonly empty?: ReactNode
  readonly className?: string
}

interface DataTableColumnMeta {
  readonly numeric: boolean
}

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic },
  rowSelectionFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: metaHelper<DataTableColumnMeta>()
})

const toRowSelection = (ids: ReadonlySet<string> | undefined): RowSelectionState =>
  Object.fromEntries([...(ids ?? [])].map((id) => [id, true] as const))

/**
 * A table you can work with: sort by a column, select rows (or a whole page), choose the columns, page through.
 * TanStack Table keeps the state; filtering stays with the caller: pass the rows that match.
 */
export function DataTable<Row extends RowData>({
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
  defaultHiddenColumns,
  toolbar,
  empty,
  className
}: DataTableProps<Row>) {
  const columnDefs = useMemo(
    () =>
      columns.map((column): ColumnDef<typeof features, Row> => ({
        id: column.id,
        header: column.header,
        accessorFn: column.sortValue ?? (() => ""),
        cell: ({ row }) => column.cell(row.original),
        enableSorting: column.sortValue !== undefined,
        enableHiding: column.hideable ?? true,
        sortFn: "basic",
        meta: { numeric: column.numeric ?? false }
      })),
    [columns]
  )

  const [rowSelection, setRowSelection] = useState(() => toRowSelection(defaultSelection))
  const [requestedPage, setPage] = useState(0)
  // The rows can shrink under the current page (a filter); stay on the last page that exists.
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageIndex = Math.min(requestedPage, pageCount - 1)

  const table = useTable({
    features,
    columns: columnDefs,
    data: rows,
    getRowId: (row) => getRowId(row),
    initialState: {
      sorting: defaultSort ? [{ id: defaultSort.column, desc: defaultSort.direction === "descending" }] : [],
      columnVisibility: Object.fromEntries((defaultHiddenColumns ?? []).map((id) => [id, false] as const))
    },
    // Ascending first, then descending: a sorted column never silently goes back to unsorted.
    sortDescFirst: false,
    enableSortingRemoval: false,
    enableRowSelection: selectable,
    autoResetPageIndex: false,
    state: { rowSelection, pagination: { pageIndex, pageSize } },
    onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
      const next = functionalUpdate(updater, rowSelection)
      setRowSelection(next)
      onSelectionChange?.(new Set(Object.keys(next)))
    },
    onPaginationChange: (updater) => setPage(functionalUpdate(updater, { pageIndex, pageSize }).pageIndex)
  })

  const pageRows = table.getRowModel().rows
  const visibleColumns = table.getVisibleLeafColumns()
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide())
  const selectedCount = table.getSelectedRowModel().rows.length

  return (
    <div data-slot="data-table" className={cn("grid gap-3", className)}>
      {(toolbar !== undefined || hideableColumns.length > 0) && (
        <div data-slot="data-table-toolbar" className="flex flex-wrap items-center gap-2.5">
          {toolbar}
          {hideableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="secondary" size="sm" className="ml-auto" />}>
                <Icon name="layers" size={16} />
                Columns
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  {hideableColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      // Hiding every column would leave an empty table with no way to read it.
                      disabled={column.getIsVisible() && visibleColumns.length === 1}
                      onCheckedChange={(checked) => column.toggleVisibility(checked)}
                      closeOnClick={false}
                    >
                      {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {selectable && (
                <TableHead scope="col" className="w-11 py-2 pr-0 [thead_&]:border-t-0">
                  <Checkbox
                    aria-label="Select all on this page"
                    disabled={pageRows.length === 0}
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={table.getIsSomePageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                  />
                </TableHead>
              )}
              {group.headers.map((header) => {
                const column = header.column
                const numeric = column.columnDef.meta?.numeric ?? false
                const sorted = column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    scope="col"
                    numeric={numeric}
                    aria-sort={column.getCanSort()
                      ? sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                      : undefined}
                    className="py-2 [thead_&]:border-t-0"
                  >
                    {column.getCanSort() ?
                      (
                        <button
                          type="button"
                          onClick={column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-1.5 inline-flex cursor-pointer items-center gap-[5px] rounded-xs px-1.5 py-1 hover:bg-g-100 hover:text-ink focus-visible:outline-offset-0",
                            numeric && "flex-row-reverse",
                            sorted ? "text-ink [&_svg]:text-blue" : "[&_svg]:text-g-300"
                          )}
                        >
                          <table.FlexRender header={header} />
                          <Icon
                            name={sorted === "asc" ? "arrow-up" : sorted === "desc" ? "arrow-down" : "sort"}
                            size={13}
                          />
                        </button>
                      ) :
                      <table.FlexRender header={header} />}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {pageRows.length === 0 ?
            (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="border-b-0 whitespace-normal"
                >
                  {empty ?? <p className="py-8 text-center text-label text-g-500">Nothing here yet.</p>}
                </TableCell>
              </TableRow>
            ) :
            pageRows.map((row) => {
              const selected = row.getIsSelected()
              return (
                <TableRow key={row.id} {...(selected ? { "data-selected": "", "aria-selected": true } : {})}>
                  {selectable && (
                    <TableCell className="w-11 pr-0">
                      <Checkbox
                        aria-label={rowLabel ? rowLabel(row.original) : "Select row"}
                        checked={selected}
                        onCheckedChange={(checked) => row.toggleSelected(checked)}
                      />
                    </TableCell>
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} numeric={cell.column.columnDef.meta?.numeric ?? false}>
                      <table.FlexRender cell={cell} />
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
          <span>Page {pageIndex + 1} of {pageCount}</span>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <Icon name="chevron-left" size={16} />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <Icon name="chevron-right" size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
