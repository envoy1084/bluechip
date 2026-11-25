import { Slider } from "@bluechip/ui/components/slider"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { type Locator, userEvent } from "vitest/browser"

const usd = { style: "currency", currency: "USD", maximumFractionDigits: 0 } as const

const focus = async (thumb: Locator) => {
  thumb.element().focus()
  await expect.element(thumb).toHaveFocus()
}

describe("Slider", () => {
  describe("a single value", () => {
    it("labels its thumb", async () => {
      const screen = await render(<Slider defaultValue={250} max={1000} thumbLabels={["Max per trade"]} />)
      await expect.element(screen.getByRole("slider", { name: "Max per trade" })).toHaveValue("250")
    })

    it("reports a moved value as a number", async () => {
      const values: Array<number | ReadonlyArray<number>> = []
      const screen = await render(
        <Slider
          defaultValue={250}
          max={1000}
          step={25}
          thumbLabels={["Max per trade"]}
          onValueChange={(v) => values.push(v)}
        />
      )
      await focus(screen.getByRole("slider"))
      await userEvent.keyboard("{ArrowRight}")
      expect(values).toEqual([275])
    })

    it("shows the moved value, formatted, above its thumb", async () => {
      const screen = await render(
        <Slider defaultValue={250} max={1000} step={25} format={usd} thumbLabels={["Max per trade"]} />
      )
      await focus(screen.getByRole("slider"))
      await userEvent.keyboard("{ArrowRight}")
      await expect.element(screen.getByText("$275", { exact: true })).toBeInTheDocument()
    })

    it("a controlled value stays where its owner puts it", async () => {
      const screen = await render(<Slider value={40} thumbLabels={["Cash"]} onValueChange={() => {}} />)
      await focus(screen.getByRole("slider"))
      await userEvent.keyboard("{ArrowRight}")
      await expect.element(screen.getByRole("slider")).toHaveValue("40")
    })
  })

  describe("a range", () => {
    it("labels each thumb", async () => {
      const screen = await render(
        <Slider defaultValue={[5, 20]} max={50} thumbLabels={["Lowest cash", "Highest cash"]} />
      )
      await expect.element(screen.getByRole("slider", { name: "Highest cash" })).toHaveValue("20")
    })

    it("reports a moved value as an array of both", async () => {
      const values: Array<number | ReadonlyArray<number>> = []
      const screen = await render(
        <Slider
          defaultValue={[5, 20]}
          max={50}
          thumbLabels={["Lowest cash", "Highest cash"]}
          onValueChange={(v) => values.push(v)}
        />
      )
      await focus(screen.getByRole("slider", { name: "Lowest cash" }))
      await userEvent.keyboard("{ArrowRight}")
      expect(values).toEqual([[6, 20]])
    })
  })

  describe("scale", () => {
    it("shows the formatted min and max", async () => {
      const screen = await render(<Slider defaultValue={250} min={10} max={1000} format={usd} thumbLabels={["Max"]} />)
      await expect.element(screen.getByText("$10", { exact: true })).toBeInTheDocument()
      await expect.element(screen.getByText("$1,000", { exact: true })).toBeInTheDocument()
    })

    it("showScale false leaves it out", async () => {
      const screen = await render(
        <Slider defaultValue={250} min={10} max={1000} format={usd} showScale={false} thumbLabels={["Max"]} />
      )
      await expect.element(screen.getByText("$1,000", { exact: true })).not.toBeInTheDocument()
    })
  })

  it("showValues false leaves out the value above the thumb", async () => {
    const screen = await render(
      <Slider defaultValue={250} max={1000} format={usd} showValues={false} showScale={false} thumbLabels={["Max"]} />
    )
    await expect.element(screen.getByText("$250", { exact: true })).not.toBeInTheDocument()
  })
})
