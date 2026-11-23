import { PortfolioChart, type PortfolioRange } from "@bluechip/ui/bluechip/portfolio-chart"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const RANGES: ReadonlyArray<PortfolioRange> = [
  {
    id: "1W",
    description: "Past week",
    points: [
      { value: 11800, label: "Wed 18 Nov" },
      { value: 12000, label: "Thu 19 Nov" },
      { value: 12269.39, label: "Fri 20 Nov" }
    ]
  },
  {
    id: "1M",
    description: "Past month",
    points: [{ value: 11545.5, label: "Mon 26 Oct" }, { value: 12269.39, label: "Tue 24 Nov" }]
  }
]

describe("PortfolioChart", () => {
  it("switches ranges with the tabs", async () => {
    const screen = await render(<PortfolioChart ranges={RANGES} defaultRange="1M" />)
    await expect.element(screen.getByText("Past month")).toBeVisible()
    await userEvent.click(screen.getByRole("tab", { name: "1W" }))
    await expect.element(screen.getByRole("tab", { name: "1W" })).toHaveAttribute("aria-selected", "true")
    await expect.element(screen.getByText("Past week")).toBeVisible()
    await expect.element(screen.getByText("Wed 18 Nov")).toBeVisible()
  })

  it("reads each point's value and date from the keyboard, and the headline follows", async () => {
    const screen = await render(<PortfolioChart ranges={RANGES} defaultRange="1W" />)
    const plot = screen.getByRole("application", { name: "Portfolio value" })
    await expect.element(plot).toBeVisible()
    // The pointer may still rest where an earlier test left it; move it off the chart.
    await userEvent.unhover(plot)
    plot.element().focus()
    const tooltip = screen.getByRole("status")
    await expect.element(tooltip).toHaveTextContent("$11,800.00Wed 18 Nov")
    await userEvent.keyboard("{ArrowRight}")
    await expect.element(tooltip).toHaveTextContent("$12,000.00Thu 19 Nov")
    // The headline swaps the range description for the point's date.
    await expect.element(screen.getByText("Past week")).not.toBeInTheDocument()
    plot.element().blur()
    await expect.element(screen.getByText("Past week")).toBeVisible()
  })

  it("shows the value under the pointer", async () => {
    const screen = await render(
      <div style={{ width: 640 }}>
        <PortfolioChart ranges={RANGES} defaultRange="1W" />
      </div>
    )
    const plot = screen.getByRole("application", { name: "Portfolio value" })
    await expect.element(plot).toBeVisible()
    const { width } = plot.element().getBoundingClientRect()
    await userEvent.hover(plot, { position: { x: width - 14, y: 60 } })
    await expect.element(screen.getByRole("status")).toHaveTextContent("$12,269.39Fri 20 Nov")
  })

  it("invites a first deposit when there is nothing to plot", async () => {
    const screen = await render(
      <PortfolioChart ranges={[{ id: "All", description: "All time", points: [{ value: 0, label: "Today" }] }]} />
    )
    await expect.element(screen.getByText("Your chart starts with your first deposit")).toBeVisible()
  })
})
