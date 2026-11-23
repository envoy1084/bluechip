import { formatMoney } from "@bluechip/ui/lib/format"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("NumberRoll", () => {
  it("reads as the formatted value", async () => {
    const screen = await render(<NumberRoll value={12480.32} format={{ style: "currency", currency: "USD" }} />)
    await expect.element(screen.getByText("$12,480.32", { exact: true })).toBeInTheDocument()
  })

  it("follows the value with a custom formatter", async () => {
    const screen = await render(<NumberRoll value={-3} format={(v) => formatMoney(v)} />)
    await expect.element(screen.getByText("−$3.00", { exact: true })).toBeInTheDocument()
    await screen.rerender(<NumberRoll value={1240.5} format={(v) => formatMoney(v)} />)
    await expect.element(screen.getByText("$1,240.50", { exact: true })).toBeInTheDocument()
  })
})
