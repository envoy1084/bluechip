import { PortfolioChart, type PortfolioRange } from "@bluechip/ui/bluechip/portfolio-chart"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const WEEK: PortfolioRange = {
  id: "1W",
  description: "Past week",
  points: [
    { value: 11800, label: "Wed 18 Nov" },
    { value: 12000, label: "Thu 19 Nov" },
    { value: 12269.39, label: "Fri 20 Nov" }
  ]
}

const MONTH: PortfolioRange = {
  id: "1M",
  description: "Past month",
  points: [{ value: 11545.5, label: "Mon 26 Oct" }, { value: 12269.39, label: "Tue 24 Nov" }]
}

const RANGES = [WEEK, MONTH]

const changeOf = (container: HTMLElement) => container.querySelector("[data-slot=price-change]")?.textContent

// Focuses the plot for the keyboard. The pointer may still rest where an earlier test left it, so it moves off first.
const focusPlot = async (screen: Awaited<ReturnType<typeof render>>) => {
  const plot = screen.getByRole("img", { name: "Portfolio value" })
  await expect.element(plot).toBeVisible()
  await userEvent.unhover(plot)
  plot.element().focus()
  return plot
}

describe("PortfolioChart", () => {
  describe("ranges", () => {
    it("starts on the last range without a default", async () => {
      const screen = await render(<PortfolioChart ranges={RANGES} />)
      await expect.element(screen.getByRole("tab", { name: "1M" })).toHaveAttribute("aria-selected", "true")
      await expect.element(screen.getByText("Past month")).toBeVisible()
    })

    it("switches ranges with the tabs", async () => {
      const screen = await render(<PortfolioChart ranges={RANGES} defaultRange="1M" />)
      await userEvent.click(screen.getByRole("tab", { name: "1W" }))
      await expect.element(screen.getByText("Past week")).toBeVisible()
      await expect.element(screen.getByText("Wed 18 Nov")).toBeVisible()
    })
  })

  describe("headline", () => {
    it("shows the latest value and its change since the range's first", async () => {
      const screen = await render(<PortfolioChart ranges={RANGES} defaultRange="1W" />)
      await expect.element(screen.getByText("$12,269.39", { exact: true })).toBeInTheDocument()
      expect(changeOf(screen.container)).toBe("+$469.39 (+3.98%)")
    })

    it("a range's own change, when it has one, instead of the change since its first point", async () => {
      const screen = await render(
        <PortfolioChart
          ranges={[{
            ...WEEK,
            change: { amount: 10, percent: 0.5 },
            changeNote: "Change in value, including deposits"
          }]}
        />
      )
      await expect.element(screen.getByText("Change in value, including deposits")).toBeVisible()
      expect(changeOf(screen.container)).toBe("+$10.00 (+0.50%)")
    })

    it("an axis tick reads the point's shorter label", async () => {
      const screen = await render(
        <PortfolioChart
          ranges={[{ ...MONTH, points: MONTH.points.map((point) => ({ ...point, tick: point.label.slice(4) })) }]}
        />
      )
      await expect.element(screen.getByText("26 Oct", { exact: true })).toBeVisible()
    })

    it("shows no percent change for a range that starts at $0", async () => {
      const screen = await render(
        <PortfolioChart
          ranges={[{
            id: "All",
            description: "All time",
            points: [{ value: 0, label: "Mon" }, { value: 100, label: "Tue" }]
          }]}
        />
      )
      await expect.element(screen.getByText("All time")).toBeVisible()
      expect(changeOf(screen.container)).toBe("+$100.00 (0.00%)")
    })
  })

  describe("reading points", () => {
    it("reads the first point when the chart takes focus", async () => {
      const screen = await render(<PortfolioChart ranges={RANGES} defaultRange="1W" />)
      await focusPlot(screen)
      await expect.element(screen.getByRole("status")).toHaveTextContent("$11,800.00Wed 18 Nov")
    })

    it("reads the next point on →", async () => {
      const screen = await render(<PortfolioChart ranges={RANGES} defaultRange="1W" />)
      await focusPlot(screen)
      await userEvent.keyboard("{ArrowRight}")
      await expect.element(screen.getByRole("status")).toHaveTextContent("$12,000.00Thu 19 Nov")
    })

    it("compares the point read with the range's first in the headline", async () => {
      const screen = await render(<PortfolioChart ranges={RANGES} defaultRange="1W" />)
      await focusPlot(screen)
      await userEvent.keyboard("{ArrowRight}")
      await expect.element(screen.getByText("Past week")).not.toBeInTheDocument()
      expect(changeOf(screen.container)).toBe("+$200.00 (+1.69%)")
    })

    it("brings the range back to the headline when the chart loses focus", async () => {
      const screen = await render(<PortfolioChart ranges={RANGES} defaultRange="1W" />)
      const plot = await focusPlot(screen)
      await expect.element(screen.getByText("Past week")).not.toBeInTheDocument()
      plot.element().blur()
      await expect.element(screen.getByText("Past week")).toBeVisible()
    })

    it("reads the point under the pointer", async () => {
      const screen = await render(
        <div style={{ width: 640 }}>
          <PortfolioChart ranges={RANGES} defaultRange="1W" />
        </div>
      )
      const plot = screen.getByRole("img", { name: "Portfolio value" })
      await expect.element(plot).toBeVisible()
      const { width } = plot.element().getBoundingClientRect()
      await userEvent.hover(plot, { position: { x: width - 14, y: 60 } })
      await expect.element(screen.getByRole("status")).toHaveTextContent("$12,269.39Fri 20 Nov")
    })
  })

  it("invites a first deposit when there is nothing to plot", async () => {
    const screen = await render(
      <PortfolioChart ranges={[{ id: "All", description: "All time", points: [{ value: 0, label: "Today" }] }]} />
    )
    await expect.element(screen.getByText("Your chart starts with your first deposit")).toBeVisible()
  })

  it("says the chart is starting when there is one point of money so far", async () => {
    const screen = await render(
      <PortfolioChart ranges={[{ id: "All", description: "All time", points: [{ value: 1000, label: "Today" }] }]} />
    )
    await expect.element(screen.getByText("Your chart starts building today")).toBeVisible()
  })

  it("shows a placeholder while loading", async () => {
    const screen = await render(<PortfolioChart ranges={RANGES} loading />)
    await expect.element(screen.getByRole("img", { name: "Portfolio value" })).not.toBeInTheDocument()
    await expect.element(screen.getByText("Past month")).not.toBeInTheDocument()
  })

  describe("profit", () => {
    const PROFIT: PortfolioRange = {
      id: "All",
      description: "Since your first trade",
      points: [{ value: 0, label: "Mon 23 Nov" }, { value: -12.5, label: "Tue 24 Nov" }]
    }

    it("heads with the signed amount and no percent", async () => {
      const screen = await render(<PortfolioChart ranges={[PROFIT]} title="Profit and loss" measure="profit" />)
      await expect.element(screen.getByText("Since your first trade")).toBeVisible()
      await expect.element(screen.getByRole("img", { name: "Profit and loss" })).toBeVisible()
      expect(changeOf(screen.container)).toBeUndefined()
    })

    it("splits the line at zero: blue above, loss red below", async () => {
      const screen = await render(
        <PortfolioChart
          ranges={[{
            id: "All",
            description: "Since your first trade",
            points: [{ value: 0, label: "Mon" }, { value: -10, label: "Tue" }, { value: 30, label: "Wed" }]
          }]}
          title="Profit and loss"
          measure="profit"
        />
      )
      await expect.element(screen.getByRole("img", { name: "Profit and loss" })).toBeVisible()
      const stops = [...screen.container.querySelectorAll("[data-ts-key^='gradient:portfolio-profit-line:stop']")]
      expect(stops.map((stop) => [stop.getAttribute("offset"), stop.getAttribute("stop-color")])).toEqual([
        ["0%", "#2a5bff"],
        ["75%", "#2a5bff"],
        ["75%", "#cc3519"],
        ["100%", "#cc3519"]
      ])
    })

    it("invites a first trade when there is nothing to plot", async () => {
      const screen = await render(
        <PortfolioChart
          ranges={[{ id: "All", description: "", points: [{ value: 0, label: "Today" }] }]}
          measure="profit"
        />
      )
      await expect.element(screen.getByText("Your results start with your first trade")).toBeVisible()
    })
  })
})
