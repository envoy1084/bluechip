import {
  DataTable,
  type DataTableColumn,
  dataTablePage,
  type DataTableProps,
  dataTableRowCount
} from "@bluechip/ui/components/data-table"
import { assert, describe, expect, it } from "@effect/vitest"
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

const stockColumn: DataTableColumn<Trade> = {
  id: "stock",
  header: "Stock",
  cell: (trade) => trade.stock,
  sortValue: (trade) => trade.stock
}
const amountColumn: DataTableColumn<Trade> = {
  id: "amount",
  header: "Amount",
  cell: (trade) => `$${trade.amount}`,
  sortValue: (trade) => trade.amount,
  numeric: true
}
const idColumn: DataTableColumn<Trade> = { id: "id", header: "Trade", cell: (trade) => trade.id }

const Trades = (props: Partial<DataTableProps<Trade>>) => (
  <DataTable
    caption="Agent trades"
    columns={[stockColumn, amountColumn]}
    rows={trades}
    getRowId={(trade) => trade.id}
    selectable
    rowLabel={(trade) => `Select trade ${trade.id}`}
    {...props}
  />
)

// Components are unstyled in tests, so an empty checkbox has no box to click: press it from the keyboard.
const press = async (checkbox: Locator) => {
  checkbox.element().focus()
  await expect.element(checkbox).toHaveFocus()
  await userEvent.keyboard(" ")
}

const column = (index: number) =>
  [...page.getByRole("table").element().querySelectorAll("tbody tr")].map((row) =>
    row.querySelectorAll("td")[index]?.textContent
  )

describe("dataTablePage", () => {
  it("no rows: still one page", () => {
    assert.deepStrictEqual(dataTablePage(0, 0, 10), { pageIndex: 0, pageCount: 1 })
  })

  it("rows filling the pages exactly", () => {
    assert.deepStrictEqual(dataTablePage(0, 4, 2), { pageIndex: 0, pageCount: 2 })
  })

  it("one row past a full page starts another", () => {
    assert.deepStrictEqual(dataTablePage(0, 5, 2), { pageIndex: 0, pageCount: 3 })
  })

  it("the requested page when it exists", () => {
    assert.deepStrictEqual(dataTablePage(2, 5, 2), { pageIndex: 2, pageCount: 3 })
  })

  it("the last page when the requested one no longer exists", () => {
    assert.deepStrictEqual(dataTablePage(2, 3, 2), { pageIndex: 1, pageCount: 2 })
  })
})

describe("dataTableRowCount", () => {
  it("selectable, several rows", () => {
    assert.strictEqual(dataTableRowCount(1, 3), "1 of 3 rows selected")
  })

  it("selectable, one row", () => {
    assert.strictEqual(dataTableRowCount(0, 1), "0 of 1 row selected")
  })

  it("not selectable, several rows", () => {
    assert.strictEqual(dataTableRowCount(undefined, 3), "3 rows")
  })

  it("not selectable, one row", () => {
    assert.strictEqual(dataTableRowCount(undefined, 1), "1 row")
  })

  it("not selectable, no rows", () => {
    assert.strictEqual(dataTableRowCount(undefined, 0), "0 rows")
  })
})

describe("DataTable", () => {
  describe("sorting", () => {
    it("a sortable column starts unsorted", async () => {
      await render(<Trades />)
      await expect.element(page.getByRole("columnheader", { name: "Stock" })).toHaveAttribute("aria-sort", "none")
    })

    it("a column without sortValue has no sort button", async () => {
      await render(<Trades columns={[idColumn, stockColumn]} />)
      await expect.element(page.getByRole("button", { name: "Trade" })).not.toBeInTheDocument()
    })

    it("the first press sorts ascending", async () => {
      await render(<Trades />)
      await userEvent.click(page.getByRole("button", { name: "Stock" }))
      await expect.element(page.getByRole("columnheader", { name: "Stock" })).toHaveAttribute("aria-sort", "ascending")
      assert.deepStrictEqual(column(1), ["AAPL", "NVDA", "TSLA"])
    })

    it("a numeric column sorts ascending first too", async () => {
      await render(<Trades />)
      await userEvent.click(page.getByRole("button", { name: "Amount" }))
      await expect.element(page.getByRole("columnheader", { name: "Amount" })).toHaveAttribute(
        "aria-sort",
        "ascending"
      )
      assert.deepStrictEqual(column(2), ["$40", "$146", "$252"])
    })

    it("the second press sorts descending", async () => {
      await render(<Trades />)
      await userEvent.click(page.getByRole("button", { name: "Stock" }))
      await userEvent.click(page.getByRole("button", { name: "Stock" }))
      await expect.element(page.getByRole("columnheader", { name: "Stock" })).toHaveAttribute("aria-sort", "descending")
      assert.deepStrictEqual(column(1), ["TSLA", "NVDA", "AAPL"])
    })

    it("the third press sorts ascending again, never back to unsorted", async () => {
      await render(<Trades />)
      await userEvent.click(page.getByRole("button", { name: "Stock" }))
      await userEvent.click(page.getByRole("button", { name: "Stock" }))
      await userEvent.click(page.getByRole("button", { name: "Stock" }))
      await expect.element(page.getByRole("columnheader", { name: "Stock" })).toHaveAttribute("aria-sort", "ascending")
    })

    it("defaultSort starts sorted", async () => {
      await render(<Trades defaultSort={{ column: "amount", direction: "descending" }} />)
      await expect.element(page.getByRole("columnheader", { name: "Amount" })).toHaveAttribute(
        "aria-sort",
        "descending"
      )
      assert.deepStrictEqual(column(2), ["$252", "$146", "$40"])
    })
  })

  describe("selection", () => {
    it("not selectable: no checkboxes, and the footer counts rows", async () => {
      await render(<Trades selectable={false} />)
      await expect.element(page.getByRole("checkbox")).not.toBeInTheDocument()
      await expect.element(page.getByText("3 rows", { exact: true })).toBeVisible()
    })

    it("names each row's checkbox with rowLabel", async () => {
      await render(<Trades />)
      await expect.element(page.getByRole("checkbox", { name: "Select trade 2858" })).toBeInTheDocument()
    })

    it("without rowLabel, each row's checkbox is Select row", async () => {
      await render(
        <DataTable
          caption="Agent trades"
          columns={[stockColumn]}
          rows={trades.slice(0, 1)}
          getRowId={(t) => t.id}
          selectable
        />
      )
      await expect.element(page.getByRole("checkbox", { name: "Select row" })).toBeInTheDocument()
    })

    it("selecting a row reports the selected ids and counts it", async () => {
      const selections: Array<ReadonlyArray<string>> = []
      await render(<Trades onSelectionChange={(ids) => selections.push([...ids])} />)
      await press(page.getByRole("checkbox", { name: "Select trade 2859" }))
      await expect.element(page.getByText("1 of 3 rows selected")).toBeVisible()
      assert.deepStrictEqual(selections, [["2859"]])
    })

    it("select all selects only the rows on this page", async () => {
      await render(<Trades pageSize={2} />)
      await press(page.getByRole("checkbox", { name: "Select all on this page" }))
      await expect.element(page.getByText("2 of 3 rows selected")).toBeVisible()
    })

    it("select all shows a dash when only some rows on the page are selected", async () => {
      await render(<Trades />)
      await press(page.getByRole("checkbox", { name: "Select trade 2860" }))
      await expect.element(page.getByRole("checkbox", { name: "Select all on this page" })).toHaveAttribute(
        "aria-checked",
        "mixed"
      )
    })

    it("defaultSelection starts those rows selected", async () => {
      await render(<Trades defaultSelection={new Set(["2858"])} />)
      await expect.element(page.getByRole("checkbox", { name: "Select trade 2858" })).toBeChecked()
    })
  })

  describe("paging", () => {
    it("starts on page 1 with Previous disabled", async () => {
      await render(<Trades pageSize={2} />)
      await expect.element(page.getByText("Page 1 of 2")).toBeVisible()
      await expect.element(page.getByRole("button", { name: "Previous page" })).toBeDisabled()
    })

    it("Next goes to the next page's rows", async () => {
      await render(<Trades pageSize={2} />)
      await userEvent.click(page.getByRole("button", { name: "Next page" }))
      await expect.element(page.getByText("Page 2 of 2")).toBeVisible()
      assert.deepStrictEqual(column(1), ["TSLA"])
    })

    it("Next is disabled on the last page", async () => {
      await render(<Trades pageSize={2} />)
      await userEvent.click(page.getByRole("button", { name: "Next page" }))
      await expect.element(page.getByRole("button", { name: "Next page" })).toBeDisabled()
    })

    it("keeps the selection when paging away and back", async () => {
      await render(<Trades pageSize={2} />)
      await press(page.getByRole("checkbox", { name: "Select trade 2860" }))
      await userEvent.click(page.getByRole("button", { name: "Next page" }))
      await userEvent.click(page.getByRole("button", { name: "Previous page" }))
      await expect.element(page.getByRole("checkbox", { name: "Select trade 2860" })).toBeChecked()
    })

    it("moves to the last page that exists when the rows shrink", async () => {
      const screen = await render(<Trades pageSize={2} />)
      await userEvent.click(page.getByRole("button", { name: "Next page" }))
      await expect.element(page.getByText("Page 2 of 2")).toBeVisible()
      await screen.rerender(<Trades pageSize={2} rows={trades.slice(0, 1)} />)
      await expect.element(page.getByText("Page 1 of 1")).toBeVisible()
      assert.deepStrictEqual(column(1), ["NVDA"])
    })
  })

  describe("columns menu", () => {
    it("hides a column", async () => {
      await render(<Trades />)
      await userEvent.click(page.getByRole("button", { name: "Columns" }))
      await userEvent.click(page.getByRole("menuitemcheckbox", { name: "Amount" }))
      await expect.element(page.getByRole("columnheader", { name: "Amount" })).not.toBeInTheDocument()
    })

    it("shows a hidden column again", async () => {
      await render(<Trades defaultHiddenColumns={["amount"]} />)
      await expect.element(page.getByRole("columnheader", { name: "Amount" })).not.toBeInTheDocument()
      await userEvent.click(page.getByRole("button", { name: "Columns" }))
      await userEvent.click(page.getByRole("menuitemcheckbox", { name: "Amount" }))
      await expect.element(page.getByRole("columnheader", { name: "Amount" })).toBeVisible()
    })

    it("can't hide the last visible column", async () => {
      await render(<Trades defaultHiddenColumns={["amount"]} />)
      await userEvent.click(page.getByRole("button", { name: "Columns" }))
      await expect.element(page.getByRole("menuitemcheckbox", { name: "Stock" })).toHaveAttribute(
        "aria-disabled",
        "true"
      )
    })

    it("leaves a column with hideable false out of the menu", async () => {
      await render(<Trades columns={[{ ...stockColumn, hideable: false }, amountColumn]} />)
      await userEvent.click(page.getByRole("button", { name: "Columns" }))
      await expect.element(page.getByRole("menuitemcheckbox", { name: "Amount" })).toBeVisible()
      await expect.element(page.getByRole("menuitemcheckbox", { name: "Stock" })).not.toBeInTheDocument()
    })

    it("no hideable columns: no Columns button", async () => {
      await render(<Trades columns={[{ ...stockColumn, hideable: false }]} />)
      await expect.element(page.getByRole("button", { name: "Columns" })).not.toBeInTheDocument()
    })
  })

  describe("no rows", () => {
    it("shows the empty state it's given", async () => {
      await render(<Trades rows={[]} empty={<p>No trades match.</p>} />)
      await expect.element(page.getByText("No trades match.")).toBeVisible()
    })

    it("without an empty state, says nothing is here yet", async () => {
      await render(<Trades rows={[]} />)
      await expect.element(page.getByText("Nothing here yet.")).toBeVisible()
    })

    it("disables select all", async () => {
      await render(<Trades rows={[]} />)
      await expect.element(page.getByRole("checkbox", { name: "Select all on this page" })).toBeDisabled()
    })
  })
})
