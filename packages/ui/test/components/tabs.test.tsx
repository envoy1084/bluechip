import { Tabs, TabsList, TabsPanel, TabsTab } from "@bluechip/ui/components/tabs"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

describe("Tabs", () => {
  it("selects with the arrow keys and Home, and never selects a disabled tab", async () => {
    await render(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Agent">
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="activity">Activity</TabsTab>
          <TabsTab value="limits">Limits</TabsTab>
          <TabsTab value="taxes" disabled>Taxes</TabsTab>
        </TabsList>
        <TabsPanel value="overview">Rebalancer checks your mix every Monday.</TabsPanel>
        <TabsPanel value="activity">Sold 1 share of TSLA.</TabsPanel>
        <TabsPanel value="limits">Spend per day: $250.</TabsPanel>
        <TabsPanel value="taxes">Nothing yet.</TabsPanel>
      </Tabs>
    )
    const tab = (name: string) => page.getByRole("tab", { name })
    tab("Overview").element().focus()

    await userEvent.keyboard("{ArrowRight}")
    await expect.element(tab("Activity")).toHaveFocus()
    await expect.element(tab("Activity")).toHaveAttribute("aria-selected", "true")
    await expect.element(page.getByText("Sold 1 share of TSLA.")).toBeVisible()

    await userEvent.keyboard("{ArrowRight}")
    await expect.element(tab("Limits")).toHaveAttribute("aria-selected", "true")
    await expect.element(page.getByText("Spend per day: $250.")).toBeVisible()

    // Base UI keeps disabled tabs focusable (so they're discoverable) but never selects them.
    await userEvent.keyboard("{End}")
    await expect.element(tab("Taxes")).toHaveFocus()
    await expect.element(tab("Taxes")).toHaveAttribute("aria-selected", "false")
    await expect.element(tab("Limits")).toHaveAttribute("aria-selected", "true")

    await userEvent.keyboard("{Home}")
    await expect.element(tab("Overview")).toHaveAttribute("aria-selected", "true")
  })
})
