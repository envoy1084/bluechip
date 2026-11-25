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
  { value: "NVDA", label: "NVDA (Nvidia)" },
  { value: "AAPL", label: "AAPL (Apple)" },
  { value: "TSLA", label: "TSLA (Tesla)" }
]

const ignore = () => {}

const StockPicker = (
  { onValueChange = ignore, showTrigger }: {
    readonly onValueChange?: (stock: Stock | null) => void
    readonly showTrigger?: boolean
  }
) => (
  <Combobox items={stocks} onValueChange={onValueChange}>
    <ComboboxInput aria-label="Add a stock" {...(showTrigger === undefined ? {} : { showTrigger })} />
    <ComboboxContent>
      <ComboboxEmpty>No stock matches.</ComboboxEmpty>
      <ComboboxList>
        {(stock: Stock) => <ComboboxItem key={stock.value} value={stock}>{stock.label}</ComboboxItem>}
      </ComboboxList>
    </ComboboxContent>
  </Combobox>
)

describe("Combobox", () => {
  it("picking a match fills the input and reports the item", async () => {
    let chosen: Stock | null = null
    const screen = await render(<StockPicker onValueChange={(stock) => (chosen = stock)} />)
    const input = screen.getByRole("combobox", { name: "Add a stock" })
    await userEvent.type(input, "tes")
    await userEvent.click(screen.getByRole("option", { name: "TSLA (Tesla)" }))
    expect(chosen).toEqual({ value: "TSLA", label: "TSLA (Tesla)" })
    await expect.element(input).toHaveValue("TSLA (Tesla)")
  })

  it("says so when nothing matches", async () => {
    const screen = await render(<StockPicker />)
    await userEvent.type(screen.getByRole("combobox", { name: "Add a stock" }), "bitcoin")
    await expect.element(screen.getByText("No stock matches.")).toBeVisible()
  })

  it("Show all opens the full list", async () => {
    const screen = await render(<StockPicker />)
    await userEvent.click(screen.getByRole("button", { name: "Show all" }))
    await expect.element(screen.getByRole("option", { name: "AAPL (Apple)" })).toBeVisible()
    expect(screen.getByRole("option").elements()).toHaveLength(3)
  })

  it("showTrigger false leaves Show all out", async () => {
    const screen = await render(<StockPicker showTrigger={false} />)
    await expect.element(screen.getByRole("combobox", { name: "Add a stock" })).toBeInTheDocument()
    await expect.element(screen.getByRole("button", { name: "Show all" })).not.toBeInTheDocument()
  })
})
