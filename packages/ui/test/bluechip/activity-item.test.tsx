import { ActivityItem } from "@bluechip/ui/bluechip/activity-item"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("ActivityItem", () => {
  it("opens its details from the whole row, through its title button", async () => {
    let opened = 0
    const screen = await render(
      <ul>
        <ActivityItem kind="trade" title="Bought $100 of Nvidia" time="9:41" onOpen={() => opened++}>
          0.65 shares at $152.03
        </ActivityItem>
      </ul>
    )
    await userEvent.click(screen.getByText("0.65 shares at $152.03"))
    expect(opened).toBe(1)
    await expect.element(screen.getByRole("button", { name: "Bought $100 of Nvidia" })).toBeVisible()
  })
})
