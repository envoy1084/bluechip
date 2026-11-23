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
  })

  it("moves the crosshair with the keyboard and announces each point", async () => {
    const screen = await render(<PortfolioChart ranges={RANGES} defaultRange="1W" />)
    const plot = screen.getByRole("slider", { name: "Portfolio value" })
    await expect.element(plot).toHaveAttribute("aria-valuetext", "$12,269.39, Fri 20 Nov")
    plot.element().focus()
    await userEvent.keyboard("{ArrowLeft}")
    await expect.element(plot).toHaveAttribute("aria-valuetext", "$12,000.00, Thu 19 Nov")
    await expect.element(screen.getByText("Thu 19 Nov").first()).toBeVisible()
    await userEvent.keyboard("{Home}")
    await expect.element(plot).toHaveAttribute("aria-valuetext", "$11,800.00, Wed 18 Nov")
    await userEvent.keyboard("{Escape}")
    await expect.element(screen.getByText("Past week")).toBeVisible()
  })
})
