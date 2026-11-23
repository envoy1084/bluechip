import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("ToggleGroup", () => {
  it("keeps one option pressed in a single group", async () => {
    let value: ReadonlyArray<unknown> = []
    const screen = await render(
      <ToggleGroup aria-label="Time range" defaultValue={["1M"]} onValueChange={(next) => (value = next)}>
        {["1D", "1W", "1M"].map((range) => <ToggleGroupItem key={range} value={range}>{range}</ToggleGroupItem>)}
      </ToggleGroup>
    )
    await userEvent.click(screen.getByRole("button", { name: "1W" }))
    expect(value).toEqual(["1W"])
    await expect.element(screen.getByRole("button", { name: "1W" })).toHaveAttribute("aria-pressed", "true")
    await expect.element(screen.getByRole("button", { name: "1M" })).toHaveAttribute("aria-pressed", "false")
  })

  it("presses several options in a multiple group, moving with the arrow keys", async () => {
    let value: ReadonlyArray<unknown> = []
    const screen = await render(
      <ToggleGroup multiple aria-label="Days" defaultValue={["Mon"]} onValueChange={(next) => (value = next)}>
        {["Mon", "Tue", "Wed"].map((day) => <ToggleGroupItem key={day} value={day}>{day}</ToggleGroupItem>)}
      </ToggleGroup>
    )
    await userEvent.click(screen.getByRole("button", { name: "Mon" }))
    await userEvent.keyboard("{ArrowRight}{ArrowRight}")
    await expect.element(screen.getByRole("button", { name: "Wed" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await userEvent.click(screen.getByRole("button", { name: "Mon" }))
    await userEvent.click(screen.getByRole("button", { name: "Tue" }))
    expect([...value].sort()).toEqual(["Mon", "Tue", "Wed"])
  })
})
