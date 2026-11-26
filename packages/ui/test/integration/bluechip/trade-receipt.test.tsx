import { TradeFill, TradeReceipt } from "@bluechip/ui/bluechip/trade-receipt"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("TradeFill", () => {
  it("a buy: what was paid, the shares bought and their price", async () => {
    const screen = await render(<TradeFill side="buy" total={50} shares={0.2631} price={190.04} />)

    await expect.element(screen.getByRole("term").first()).toHaveTextContent("Paid")
    await expect.element(screen.getByRole("definition").first()).toHaveTextContent("$50.00")
    await expect.element(screen.getByRole("definition").nth(2)).toHaveTextContent("$190.04 a share")
  })

  it("a sale says what you got and the shares sold", async () => {
    const screen = await render(<TradeFill side="sell" total={40} shares={0.5} price={80} />)

    await expect.element(screen.getByRole("term").first()).toHaveTextContent("Got")
    await expect.element(screen.getByRole("term").nth(1)).toHaveTextContent("Shares sold")
  })

  it("links its transaction on BaseScan", async () => {
    const tx = `0x${"ab".repeat(32)}`
    const screen = await render(<TradeFill side="buy" total={50} shares={1} price={50} txHash={tx} />)

    await expect.element(screen.getByRole("link", { name: "View on BaseScan" })).toHaveAttribute(
      "href",
      `https://basescan.org/tx/${tx}`
    )
  })
})

describe("TradeReceipt", () => {
  const receipt = { side: "buy", symbol: "AAPL", name: "Apple", shares: 0.5, price: 190, total: 95 } as const

  it("heads with what moved, who and when", async () => {
    const screen = await render(<TradeReceipt {...receipt} by="You" when="Today at 09:41" />)

    await expect.element(screen.getByText("Bought $95.00 of Apple")).toBeVisible()
    await expect.element(screen.getByText("You, today at 09:41")).toBeVisible()
  })

  it("without its header, where the page around it says so", async () => {
    const screen = await render(<TradeReceipt {...receipt} by="You" when="Today at 09:41" header={false} />)

    await expect.element(screen.getByText("Bought $95.00 of Apple")).not.toBeInTheDocument()
    await expect.element(screen.getByRole("region", { name: "Bought Apple" })).toBeVisible()
  })
})
