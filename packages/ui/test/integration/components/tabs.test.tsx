import { Tabs, TabsLink, TabsList, TabsNav, TabsPanel, TabsTab } from "@bluechip/ui/components/tabs"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const AgentTabs = ({ activateOnFocus }: { readonly activateOnFocus?: boolean }) => (
  <Tabs defaultValue="overview">
    <TabsList aria-label="Agent" {...(activateOnFocus === undefined ? {} : { activateOnFocus })}>
      <TabsTab value="overview">Overview</TabsTab>
      <TabsTab value="activity">Activity</TabsTab>
    </TabsList>
    <TabsPanel value="overview">Rebalancer checks your mix every Monday.</TabsPanel>
    <TabsPanel value="activity">Sold 1 share of TSLA.</TabsPanel>
  </Tabs>
)

const focusFirstTab = async () => {
  const overview = page.getByRole("tab", { name: "Overview" })
  overview.element().focus()
  await expect.element(overview).toHaveFocus()
}

describe("Tabs", () => {
  it("an arrow key selects the tab it moves to and shows its panel", async () => {
    await render(<AgentTabs />)
    await focusFirstTab()
    await userEvent.keyboard("{ArrowRight}")
    await expect.element(page.getByText("Sold 1 share of TSLA.")).toBeVisible()
  })

  it("with activateOnFocus false, an arrow key only moves focus", async () => {
    await render(<AgentTabs activateOnFocus={false} />)
    await focusFirstTab()
    await userEvent.keyboard("{ArrowRight}")
    await expect.element(page.getByRole("tab", { name: "Activity" })).toHaveFocus()
    await expect.element(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true")
  })
})

describe("TabsNav", () => {
  it("is a navigation of links, the current one marked", async () => {
    const screen = await render(
      <TabsNav aria-label="Agent's pages">
        <TabsLink href="#overview" aria-current="page">Overview</TabsLink>
        <TabsLink href="#journal">Journal</TabsLink>
      </TabsNav>
    )

    await expect.element(screen.getByRole("navigation", { name: "Agent's pages" })).toBeInTheDocument()
    await expect.element(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page")
    await expect.element(screen.getByRole("link", { name: "Journal" })).toHaveAttribute("href", "#journal")
  })
})
