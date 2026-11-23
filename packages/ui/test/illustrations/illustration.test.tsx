import { Illustration, ILLUSTRATION_NAMES, ILLUSTRATIONS } from "@bluechip/ui/illustrations/illustration"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("Illustration", () => {
  it("has all 23 objects", () => {
    expect(ILLUSTRATION_NAMES).toHaveLength(23)
  })

  for (const name of ILLUSTRATION_NAMES) {
    it(`renders ${name} as a labelled canvas in both styles`, async () => {
      const { label } = ILLUSTRATIONS[name]
      const pixel = await render(<Illustration name={name} size={48} />)
      const canvas = pixel.getByRole("img", { name: label })
      await expect.element(canvas).toBeVisible()
      // Pixel art paints at a whole-number scale with something on it.
      const element = canvas.element() as HTMLCanvasElement
      const data = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data
      expect(data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true)
      await pixel.unmount()

      const halftone = await render(
        <Illustration name={name} variant="halftone" size={160} label={`${label} halftone`} />
      )
      await expect.element(halftone.getByRole("img", { name: `${label} halftone` })).toBeVisible()
      await halftone.unmount()
    })
  }
})
