import { Slider } from "@bluechip/ui/components/slider"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const usd = { style: "currency", currency: "USD", maximumFractionDigits: 0 } as const

describe("Slider", () => {
  it("steps with the arrow keys and jumps with Home and End", async () => {
    const screen = await render(
      <Slider defaultValue={250} min={0} max={1000} step={25} format={usd} thumbLabels={["Max per trade"]} />
    )
    const thumb = screen.getByRole("slider", { name: "Max per trade" })
    thumb.element().focus()
    await userEvent.keyboard("{ArrowRight}{ArrowRight}")
    await expect.element(thumb).toHaveValue("300")
    await expect.element(screen.getByText("$300", { exact: true }).first()).toBeVisible()
    await userEvent.keyboard("{ArrowLeft}")
    await expect.element(thumb).toHaveValue("275")
    await userEvent.keyboard("{End}")
    await expect.element(thumb).toHaveValue("1000")
    await userEvent.keyboard("{Home}")
    await expect.element(thumb).toHaveValue("0")
  })

  it("keeps a range's thumbs from crossing", async () => {
    const values: Array<number | ReadonlyArray<number>> = []
    const screen = await render(
      <Slider
        defaultValue={[5, 20]}
        max={50}
        thumbLabels={["Lowest cash", "Highest cash"]}
        onValueChange={(value) => values.push(value)}
      />
    )
    const low = screen.getByRole("slider", { name: "Lowest cash" })
    low.element().focus()
    await userEvent.keyboard("{End}")
    await expect.element(low).toHaveValue("20")
    expect(values.at(-1)).toEqual([20, 20])
  })
})
