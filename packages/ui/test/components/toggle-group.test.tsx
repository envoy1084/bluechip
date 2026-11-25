import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const RANGES = ["1D", "1W", "1M"]

describe("ToggleGroup", () => {
  it("pressing an option reports the pressed values as an array", async () => {
    const values: Array<ReadonlyArray<unknown>> = []
    const screen = await render(
      <ToggleGroup aria-label="Time range" defaultValue={["1M"]} onValueChange={(next) => values.push(next)}>
        {RANGES.map((range) => <ToggleGroupItem key={range} value={range}>{range}</ToggleGroupItem>)}
      </ToggleGroup>
    )
    await userEvent.click(screen.getByRole("button", { name: "1W" }))
    expect(values).toEqual([["1W"]])
  })

  it("an item takes the group's variant", async () => {
    const screen = await render(
      <ToggleGroup aria-label="Time range" variant="outline">
        <ToggleGroupItem value="1D">1D</ToggleGroupItem>
      </ToggleGroup>
    )
    await expect.element(screen.getByRole("button", { name: "1D" })).toHaveAttribute("data-variant", "outline")
  })

  it("an item's own variant wins over the group's", async () => {
    const screen = await render(
      <ToggleGroup aria-label="Time range" variant="outline">
        <ToggleGroupItem value="1D" variant="default">1D</ToggleGroupItem>
      </ToggleGroup>
    )
    await expect.element(screen.getByRole("button", { name: "1D" })).toHaveAttribute("data-variant", "default")
  })
})
