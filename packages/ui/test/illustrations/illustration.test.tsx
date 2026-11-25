import { Illustration, ILLUSTRATION_NAMES, ILLUSTRATIONS } from "@bluechip/ui/illustrations/illustration"
import { assert, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const nextFrames = (count: number) =>
  new Promise<void>((resolve) => {
    let left = count
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })

const hasInk = (canvas: HTMLCanvasElement) =>
  canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0)

describe("Illustration", () => {
  it.each(ILLUSTRATION_NAMES.map((name) => ({ name })))(
    "paints $name as pixel art, named by its label",
    async ({ name }) => {
      const screen = await render(<Illustration name={name} size={48} />)
      const canvas = screen.getByRole("img", { name: ILLUSTRATIONS[name].label })

      await expect.element(canvas).toBeVisible()

      assert.isTrue(hasInk(canvas.element() as HTMLCanvasElement))
    }
  )

  it.each(ILLUSTRATION_NAMES.map((name) => ({ name })))("paints $name as a still halftone", async ({ name }) => {
    const screen = await render(<Illustration name={name} variant="halftone" size={160} />)
    const canvas = screen.getByRole("img", { name: ILLUSTRATIONS[name].label })
    await expect.element(canvas).toBeVisible()

    await nextFrames(2)

    assert.isTrue(hasInk(canvas.element() as HTMLCanvasElement))
  })

  it("is named by the label it is given over the object's", async () => {
    const screen = await render(<Illustration name={ILLUSTRATION_NAMES[0]!} label="A custom label" />)

    await expect.element(screen.getByRole("img", { name: "A custom label" })).toBeVisible()
  })
})
