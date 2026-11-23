import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from "@bluechip/ui/components/combobox"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

interface Stock {
  readonly value: string
  readonly label: string
}

const stocks: ReadonlyArray<Stock> = [
  { value: "NVDA", label: "NVDA · Nvidia" },
  { value: "AAPL", label: "AAPL · Apple" },
  { value: "TSLA", label: "TSLA · Tesla" }
]

const StockPicker = ({ onValueChange }: { readonly onValueChange: (stock: Stock | null) => void }) => (
  <Combobox items={stocks} onValueChange={onValueChange}>
    <ComboboxInput aria-label="Add a stock" placeholder="Search stocks" />
    <ComboboxContent>
      <ComboboxEmpty>No stock matches.</ComboboxEmpty>
      <ComboboxList>
        {(stock: Stock) => <ComboboxItem key={stock.value} value={stock}>{stock.label}</ComboboxItem>}
      </ComboboxList>
    </ComboboxContent>
  </Combobox>
)

describe("Combobox", () => {
  it("filters as you type and picks the highlighted match with Enter", async () => {
    let chosen: Stock | null = null
    const screen = await render(<StockPicker onValueChange={(stock) => (chosen = stock)} />)
    const input = screen.getByRole("combobox", { name: "Add a stock" })
    await userEvent.type(input, "tes")
    await expect.element(screen.getByRole("option", { name: "TSLA · Tesla" })).toBeVisible()
    await expect.element(screen.getByRole("option", { name: "NVDA · Nvidia" })).not.toBeInTheDocument()
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(chosen).toEqual(stocks[2])
    await expect.element(input).toHaveValue("TSLA · Tesla")
  })

  it("says so when nothing matches", async () => {
    const screen = await render(<StockPicker onValueChange={() => {}} />)
    await userEvent.type(screen.getByRole("combobox", { name: "Add a stock" }), "bitcoin")
    await expect.element(screen.getByText("No stock matches.")).toBeVisible()
  })
})
