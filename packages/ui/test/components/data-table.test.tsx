import { DataTable, type DataTableColumn } from "@bluechip/ui/components/data-table"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { type Locator, page, userEvent } from "vitest/browser"

interface Trade {
  readonly id: string
  readonly stock: string
  readonly amount: number
}

const trades: ReadonlyArray<Trade> = [
  { id: "2860", stock: "NVDA", amount: 146 },
  { id: "2859", stock: "AAPL", amount: 40 },
  { id: "2858", stock: "TSLA", amount: 252 }
]

const columns: ReadonlyArray<DataTableColumn<Trade>> = [
  { id: "stock", header: "Stock", cell: (trade) => trade.stock, sortValue: (trade) => trade.stock },
  {
    id: "amount",
    header: "Amount",
    cell: (trade) => `$${trade.amount}`,
    sortValue: (trade) => trade.amount,
    numeric: true
  }
]

const Trades = (
  { rows = trades, pageSize = 10, onSelectionChange }: {
    readonly rows?: ReadonlyArray<Trade>
    readonly pageSize?: number
    readonly onSelectionChange?: (selection: ReadonlySet<string>) => void
  }
) => (
  <DataTable
    caption="Agent trades"
    columns={columns}
    rows={rows}
    getRowId={(trade) => trade.id}
    pageSize={pageSize}
    selectable
    rowLabel={(trade) => `Select trade ${trade.id}`}
    {...(onSelectionChange ? { onSelectionChange } : {})}
    empty={<p>No trades match.</p>}
  />
)

// Components are unstyled in tests, so an empty checkbox has no box to click: press it from the keyboard.
const press = async (checkbox: Locator) => {
  checkbox.element().focus()
  await expect.element(checkbox).toHaveFocus()
  await userEvent.keyboard(" ")
}

const column = (table: HTMLElement, index: number) =>
  [...table.querySelectorAll("tbody tr")].map((row) => row.querySelectorAll("td")[index]?.textContent)

describe("DataTable", () => {
  it("sorts by a column, then reverses on a second press", async () => {
    const screen = await render(<Trades />)
    const table = screen.getByRole("table").element() as HTMLElement
    await expect.element(screen.getByRole("columnheader", { name: "Stock" })).toHaveAttribute("aria-sort", "none")
    await userEvent.click(screen.getByRole("button", { name: "Stock" }))
    expect(column(table, 1)).toEqual(["AAPL", "NVDA", "TSLA"])
    await expect.element(screen.getByRole("columnheader", { name: "Stock" })).toHaveAttribute("aria-sort", "ascending")
    await userEvent.click(screen.getByRole("button", { name: "Stock" }))
    expect(column(table, 1)).toEqual(["TSLA", "NVDA", "AAPL"])
    await expect.element(screen.getByRole("columnheader", { name: "Stock" })).toHaveAttribute("aria-sort", "descending")
    // Numbers sort ascending first too.
    await userEvent.click(screen.getByRole("button", { name: "Amount" }))
    expect(column(table, 2)).toEqual(["$40", "$146", "$252"])
  })

  it("selects every row on the page, and shows a dash when only some are", async () => {
    const selections: Array<ReadonlyArray<string>> = []
    const screen = await render(<Trades pageSize={2} onSelectionChange={(ids) => selections.push([...ids].sort())} />)
    const all = screen.getByRole("checkbox", { name: "Select all on this page" })
    await press(all)
    await expect.element(screen.getByRole("checkbox", { name: "Select trade 2860" })).toBeChecked()
    await expect.element(screen.getByRole("checkbox", { name: "Select trade 2859" })).toBeChecked()
    await expect.element(screen.getByText("2 of 3 rows selected")).toBeVisible()
    await press(screen.getByRole("checkbox", { name: "Select trade 2859" }))
    await expect.element(all).toHaveAttribute("aria-checked", "mixed")
    expect(selections).toEqual([["2859", "2860"], ["2860"]])
  })

  it("pages through the rows and keeps the selection across pages", async () => {
    const screen = await render(<Trades pageSize={2} />)
    await expect.element(screen.getByText("Page 1 of 2")).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    await press(screen.getByRole("checkbox", { name: "Select trade 2860" }))
    await userEvent.click(screen.getByRole("button", { name: "Next page" }))
    await expect.element(screen.getByText("Page 2 of 2")).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
    await expect.element(screen.getByRole("checkbox", { name: "Select trade 2858" })).not.toBeChecked()
    await expect.element(screen.getByRole("checkbox", { name: "Select all on this page" })).not.toBeChecked()
    await expect.element(screen.getByText("1 of 3 rows selected")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }))
    await expect.element(screen.getByRole("checkbox", { name: "Select trade 2860" })).toBeChecked()
  })

  it("stays on the last page that exists when the rows shrink", async () => {
    const screen = await render(<Trades pageSize={2} />)
    await userEvent.click(screen.getByRole("button", { name: "Next page" }))
    await expect.element(screen.getByText("Page 2 of 2")).toBeVisible()
    await screen.rerender(<Trades pageSize={2} rows={trades.slice(0, 1)} />)
    await expect.element(screen.getByText("Page 1 of 1")).toBeVisible()
    await expect.element(screen.getByText("NVDA")).toBeVisible()
  })

  it("hides and shows columns from the Columns menu", async () => {
    const screen = await render(<Trades />)
    await userEvent.click(screen.getByRole("button", { name: "Columns" }))
    const amount = page.getByRole("menuitemcheckbox", { name: "Amount" })
    await expect.element(amount).toHaveAttribute("aria-checked", "true")
    await userEvent.click(amount)
    await expect.element(screen.getByRole("columnheader", { name: "Amount" })).not.toBeInTheDocument()
    await expect.element(screen.getByText("$146")).not.toBeInTheDocument()
    // The last visible column can't be hidden: the table would have nothing to show.
    await expect.element(page.getByRole("menuitemcheckbox", { name: "Stock" })).toHaveAttribute("aria-disabled", "true")
    await userEvent.click(amount)
    await expect.element(screen.getByRole("columnheader", { name: "Amount" })).toBeVisible()
  })

  it("shows the empty state when there are no rows", async () => {
    const screen = await render(<Trades rows={[]} />)
    await expect.element(screen.getByText("No trades match.")).toBeVisible()
    await expect.element(screen.getByRole("checkbox", { name: "Select all on this page" })).toBeDisabled()
    await expect.element(screen.getByText("Page 1 of 1")).toBeVisible()
  })
})
