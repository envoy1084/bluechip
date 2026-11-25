import { ActivityItem } from "@bluechip/ui/bluechip/activity-item"
import { Button } from "@bluechip/ui/components/button"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("ActivityItem", () => {
  it("opens once when you press anywhere on the row", async () => {
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
  })

  it("opens once from the keyboard, through its title button", async () => {
    let opened = 0
    const screen = await render(
      <ul>
        <ActivityItem kind="trade" title="Bought $100 of Nvidia" time="9:41" onOpen={() => opened++} />
      </ul>
    )
    screen.getByRole("button", { name: "Bought $100 of Nvidia" }).element().focus()
    await userEvent.keyboard("{Enter}")
    expect(opened).toBe(1)
  })

  it("doesn't open when you press one of its actions", async () => {
    let opened = 0
    let reviewed = 0
    const screen = await render(
      <ul>
        <ActivityItem
          kind="approval"
          title="Tech picker wants to buy $600 of Nvidia"
          time="9:41"
          onOpen={() => opened++}
          actions={<Button onClick={() => reviewed++}>Review and approve</Button>}
        />
      </ul>
    )
    await userEvent.click(screen.getByRole("button", { name: "Review and approve" }))
    expect(reviewed).toBe(1)
    expect(opened).toBe(0)
  })

  it("has no button without onOpen", async () => {
    const screen = await render(
      <ul>
        <ActivityItem kind="deposit" title="Added $500 of cash" time="Yesterday" />
      </ul>
    )
    await expect.element(screen.getByText("Added $500 of cash")).toBeVisible()
    await expect.element(screen.getByRole("button")).not.toBeInTheDocument()
  })
})
