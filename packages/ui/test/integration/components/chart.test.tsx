import { AreaChart, BarChart, formatChartTick, LineChart, toggleHiddenSeries } from "@bluechip/ui/components/chart"
import { assert, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const labels = ["Nov 17", "Nov 18", "Nov 19"]
const series = [
  { key: "stocks", label: "Stocks", values: [8400, 8620, 9010] },
  { key: "cash", label: "Cash", values: [2200, 2150, 2080] }
]

describe("formatChartTick", () => {
  it("under a thousand: whole dollars", () => {
    assert.strictEqual(formatChartTick(950), "$950")
  })

  it("a thousand exactly: a lowercase k", () => {
    assert.strictEqual(formatChartTick(1000), "$1k")
  })

  it("thousands: one decimal and a lowercase k", () => {
    assert.strictEqual(formatChartTick(8400), "$8.4k")
  })

  it("millions: an M", () => {
    assert.strictEqual(formatChartTick(1_250_000), "$1.3M")
  })

  it("zero", () => {
    assert.strictEqual(formatChartTick(0), "$0")
  })

  it("a loss", () => {
    assert.strictEqual(formatChartTick(-2500), "-$2.5k")
  })
})

describe("toggleHiddenSeries", () => {
  it("hides a visible series while another stays visible", () => {
    assert.deepStrictEqual(toggleHiddenSeries(new Set(), "cash", 2), new Set(["cash"]))
  })

  it("shows a hidden series again", () => {
    assert.deepStrictEqual(toggleHiddenSeries(new Set(["cash"]), "cash", 1), new Set())
  })

  it("keeps the last visible series", () => {
    assert.deepStrictEqual(toggleHiddenSeries(new Set(["cash"]), "stocks", 1), new Set(["cash"]))
  })
})

describe("Chart", () => {
  it("hovering a bar shows its label's values in the tooltip", async () => {
    const screen = await render(
      <div style={{ width: 600 }}>
        <BarChart title="Bought and sold per week" labels={labels} series={series} />
      </div>
    )
    // The middle of three bars: a 52 px axis gutter, then three equal slots across the rest.
    await userEvent.hover(screen.getByRole("img", { name: "Bought and sold per week" }), {
      position: { x: 320, y: 120 }
    })
    await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 18Stocks$8,620Cash$2,150")
  })

  describe("keyboard", () => {
    const focusPlot = async (props: Partial<Parameters<typeof AreaChart>[0]> = {}) => {
      const screen = await render(
        <div style={{ width: 600 }}>
          <AreaChart title="Portfolio, last 3 days" labels={labels} series={series} {...props} />
        </div>
      )
      const plot = screen.getByRole("img", { name: "Portfolio, last 3 days" })
      await expect.element(plot).toBeVisible()
      // The pointer may still rest where an earlier test left it; move it off the chart.
      await userEvent.unhover(plot)
      plot.element().focus()
      return screen
    }

    it("focus reads the first point", async () => {
      const screen = await focusPlot()
      await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 17Stocks$8,400Cash$2,200")
    })

    it("ArrowRight reads the next point", async () => {
      const screen = await focusPlot()
      await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 17Stocks$8,400Cash$2,200")
      await userEvent.keyboard("{ArrowRight}")
      await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 18Stocks$8,620Cash$2,150")
    })

    it("ArrowLeft on the first point stays there", async () => {
      const screen = await focusPlot()
      await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 17Stocks$8,400Cash$2,200")
      // Had ArrowLeft moved off the first point, ArrowRight would land somewhere other than the second.
      await userEvent.keyboard("{ArrowLeft}{ArrowRight}")
      await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 18Stocks$8,620Cash$2,150")
    })

    it("formatValue formats the values read out", async () => {
      const screen = await focusPlot({ formatValue: (value) => `${value} USD` })
      await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 17Stocks8400 USDCash2200 USD")
    })

    it("a series with no value for a label reads $0 there", async () => {
      const screen = await focusPlot({ series: [{ key: "stocks", label: "Stocks", values: [] }] })
      await expect.element(screen.getByRole("status")).toHaveTextContent("Nov 17Stocks$0")
    })
  })

  describe("signed series", () => {
    const profit = [{ key: "profit", label: "Profit", values: [30, -10, 0], signed: true }]
    const stopsOf = (container: HTMLElement, id: string) =>
      [...container.querySelectorAll(`[data-ts-key^='gradient:${id}:stop']`)].map((stop) => [
        stop.getAttribute("offset"),
        stop.getAttribute("stop-color")
      ])

    it("a line splits at zero into its color and loss red", async () => {
      const screen = await render(<LineChart title="Profit" labels={labels} series={profit} />)
      await expect.element(screen.getByRole("img", { name: "Profit" })).toBeVisible()
      expect(stopsOf(screen.container, "chart-signed-0-line")).toEqual([
        ["0%", "var(--color-series-1)"],
        ["75%", "var(--color-series-1)"],
        ["75%", "var(--color-loss)"],
        ["100%", "var(--color-loss)"]
      ])
    })

    it("a series that isn't signed keeps one color", async () => {
      const screen = await render(<LineChart title="Portfolio" labels={labels} series={series} />)
      await expect.element(screen.getByRole("img", { name: "Portfolio" })).toBeVisible()
      expect(screen.container.querySelector("[data-ts-key^='gradient:chart-signed']")).toBeNull()
    })
  })

  describe("legend", () => {
    it("pressing a series' button hides it", async () => {
      const screen = await render(<AreaChart title="Portfolio" labels={labels} series={series} />)
      await userEvent.click(screen.getByRole("button", { name: "Cash" }))
      await expect.element(screen.getByRole("button", { name: "Cash" })).toHaveAttribute("aria-pressed", "false")
    })

    it("pressing the last visible series' button keeps it", async () => {
      const screen = await render(<AreaChart title="Portfolio" labels={labels} series={series} />)
      await userEvent.click(screen.getByRole("button", { name: "Cash" }))
      await userEvent.click(screen.getByRole("button", { name: "Stocks" }))
      await expect.element(screen.getByRole("button", { name: "Stocks" })).toHaveAttribute("aria-pressed", "true")
    })

    it("showLegend false leaves the legend out", async () => {
      const screen = await render(<AreaChart title="Portfolio" labels={labels} series={series} showLegend={false} />)
      await expect.element(screen.getByRole("list", { name: "Series" })).not.toBeInTheDocument()
    })
  })
})
