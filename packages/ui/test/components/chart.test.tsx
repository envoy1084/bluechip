import { AreaChart, BarChart } from "@bluechip/ui/components/chart"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const labels = ["Nov 17", "Nov 18", "Nov 19"]
const series = [
  { key: "stocks", label: "Stocks", values: [8400, 8620, 9010] },
  { key: "cash", label: "Cash", values: [2200, 2150, 2080] }
]

describe("Chart", () => {
  it("shows a tooltip for the point under the pointer", async () => {
    const screen = await render(
      <div style={{ width: 600 }}>
        <BarChart title="Bought and sold per week" labels={labels} series={series} />
      </div>
    )
    // The middle of three bars: a 52 px axis gutter, then three equal slots across the rest.
    await userEvent.hover(screen.getByRole("application", { name: "Bought and sold per week" }), {
      position: { x: 320, y: 120 }
    })
    await expect.element(screen.getByText("$8,620", { exact: true })).toBeVisible()
    await expect.element(screen.getByText("$2,150", { exact: true })).toBeVisible()
  })

  it("reads points with the arrow keys and announces them", async () => {
    const screen = await render(
      <div style={{ width: 600 }}>
        <AreaChart title="Portfolio, last 3 days" labels={labels} series={series} />
      </div>
    )
    const plot = screen.getByRole("application", { name: "Portfolio, last 3 days" })
    await expect.element(plot).toBeVisible()
    // The pointer may still rest where an earlier test left it; move it off the chart.
    await userEvent.unhover(plot)
    plot.element().focus()
    // Focus opens the first point; the arrow keys walk from there.
    await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 17Stocks$8,400Cash$2,200")
    await userEvent.keyboard("{ArrowRight}")
    await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 18Stocks$8,620Cash$2,150")
    await userEvent.keyboard("{ArrowRight}{ArrowLeft}{ArrowLeft}")
    await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 17Stocks$8,400Cash$2,200")
  })

  it("hides a series from its legend button, but never the last one", async () => {
    const screen = await render(<AreaChart title="Portfolio" labels={labels} series={series} />)
    await userEvent.click(screen.getByRole("button", { name: "Cash" }))
    await expect.element(screen.getByRole("button", { name: "Cash" })).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(screen.getByRole("button", { name: "Stocks" }))
    await expect.element(screen.getByRole("button", { name: "Stocks" })).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(screen.getByRole("button", { name: "Cash" }))
    await expect.element(screen.getByRole("button", { name: "Cash" })).toHaveAttribute("aria-pressed", "true")
  })
})
