import { HoldingDetail } from "@bluechip/ui/bluechip/holding-detail"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const APPLE = { symbol: "AAPL", name: "Apple", shares: 2, price: 200, dayChangePercent: 1, weight: 23 } as const

describe("HoldingDetail", () => {
  it("says what it returned against what you paid", async () => {
    const screen = await render(<HoldingDetail {...APPLE} cost={320} />)
    await expect.element(screen.getByText("on $320.00 paid")).toBeVisible()
  })

  it("has no return without a cost", async () => {
    const screen = await render(<HoldingDetail {...APPLE} />)
    await expect.element(screen.getByText("Return")).not.toBeInTheDocument()
  })

  it("says its share of your money against the max", async () => {
    const screen = await render(<HoldingDetail {...APPLE} cap={30} />)
    await expect.element(screen.getByText("23% of your money, 30% at most")).toBeVisible()
  })

  it("lists the agents that trade it", async () => {
    const screen = await render(<HoldingDetail {...APPLE} agents={[{ id: "a1", name: "Nimbus" }]} />)
    await expect.element(screen.getByRole("listitem")).toHaveTextContent("Nimbus")
  })
})
