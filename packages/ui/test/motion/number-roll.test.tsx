import { formatMoney, formatTokenAmount } from "@bluechip/ui/lib/format"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const flowOf = (container: HTMLElement) => container.querySelector("number-flow-react")

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

  it("rolls the formatted value's digits, with the formatter's sign and symbol around them", async () => {
    const screen = await render(<NumberRoll value={-1240.5} format={formatMoney} />)
    const flow = flowOf(screen.container)
    expect(flow?.getAttribute("aria-hidden")).toBe("true")
    // The roll draws the same text the formatter wrote: "−$" before, the digits with grouping and two decimals.
    await expect.poll(() => flow?.shadowRoot?.textContent?.includes("−$")).toBe(true)
    await screen.rerender(<NumberRoll value={0.275604} format={(v) => formatTokenAmount(v, "NVDAc")} />)
    await expect.element(screen.getByText("0.275604 NVDAc", { exact: true })).toBeInTheDocument()
  })

  it("shows text without digits as it is", async () => {
    const screen = await render(<NumberRoll value={Number.NaN} format={() => "No price yet"} />)
    expect(flowOf(screen.container)).toBeNull()
    await expect.element(screen.getByText("No price yet", { exact: true }).first()).toBeInTheDocument()
  })
})
