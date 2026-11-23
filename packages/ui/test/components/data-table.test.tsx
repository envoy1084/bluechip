import { DataTable, type DataTableColumn } from "@bluechip/ui/components/data-table"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { type Locator, userEvent } from "vitest/browser"

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
  { rows = trades, pageSize = 10 }: { readonly rows?: ReadonlyArray<Trade>; readonly pageSize?: number }
) => (
  <DataTable
    caption="Agent trades"
    columns={columns}
    rows={rows}
    getRowId={(trade) => trade.id}
    pageSize={pageSize}
    selectable
    rowLabel={(trade) => `Select trade ${trade.id}`}
    empty={<p>No trades match.</p>}
  />
)

// Components are unstyled in tests, so an empty checkbox has no box to click: press it from the keyboard.
const press = async (checkbox: Locator) => {
  checkbox.element().focus()
  await userEvent.keyboard(" ")
}

const firstColumn = (table: HTMLElement) =>
  [...table.querySelectorAll("tbody tr")].map((row) => row.querySelectorAll("td")[1]?.textContent)

describe("DataTable", () => {
  it("sorts by a column, then reverses on a second press", async () => {
    const screen = await render(<Trades />)
    const table = screen.getByRole("table").element() as HTMLElement
    await userEvent.click(screen.getByRole("button", { name: "Stock" }))
    expect(firstColumn(table)).toEqual(["AAPL", "NVDA", "TSLA"])
    await expect.element(screen.getByRole("columnheader", { name: "Stock" })).toHaveAttribute("aria-sort", "ascending")
    await userEvent.click(screen.getByRole("button", { name: "Stock" }))
    expect(firstColumn(table)).toEqual(["TSLA", "NVDA", "AAPL"])
    await expect.element(screen.getByRole("columnheader", { name: "Stock" })).toHaveAttribute("aria-sort", "descending")
  })

  it("selects every row on the page, and shows a dash when only some are", async () => {
    const screen = await render(<Trades pageSize={2} />)
    const all = screen.getByRole("checkbox", { name: "Select all on this page" })
    await press(all)
    await expect.element(screen.getByRole("checkbox", { name: "Select trade 2860" })).toBeChecked()
    await expect.element(screen.getByRole("checkbox", { name: "Select trade 2859" })).toBeChecked()
    await expect.element(screen.getByText("2 of 3 rows selected")).toBeVisible()
    await press(screen.getByRole("checkbox", { name: "Select trade 2859" }))
    await expect.element(all).toHaveAttribute("aria-checked", "mixed")
    await userEvent.click(screen.getByRole("button", { name: "Next page" }))
    await expect.element(screen.getByText("Page 2 of 2")).toBeVisible()
    await expect.element(screen.getByRole("checkbox", { name: "Select trade 2858" })).not.toBeChecked()
  })

  it("shows the empty state when there are no rows", async () => {
    const screen = await render(<Trades rows={[]} />)
    await expect.element(screen.getByText("No trades match.")).toBeVisible()
    await expect.element(screen.getByRole("checkbox", { name: "Select all on this page" })).toBeDisabled()
  })
})
