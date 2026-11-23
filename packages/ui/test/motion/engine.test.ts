import { darkness, inkLevel, mount, type Palette, type Scene } from "@bluechip/ui/motion/halftone"
import { describe, expect, it } from "@effect/vitest"

const PALETTE: Palette = ["#ff0000", "#00ff00", "#2a5bff", "#000000"]

const nextFrames = (count: number) =>
  new Promise<void>((resolve) => {
    let left = count
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement("canvas")
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  document.body.appendChild(canvas)
  return canvas
}

/** A scene that fills the frame with one grey and counts its frames, resolving `drawn` on the first. */
const countingScene = (grey: string) => {
  let resolve = () => {}
  const state = { frames: 0, drawn: new Promise<void>((r) => (resolve = r)) }
  const scene: Scene = {
    palette: PALETTE,
    cell: 10,
    draw(c, _t, W, H) {
      state.frames++
      c.fillStyle = grey
      c.fillRect(0, 0, W, H)
      resolve()
    }
  }
  return { scene, state }
}

const pixelAt = (canvas: HTMLCanvasElement, x: number, y: number) => {
  const scale = canvas.width / canvas.clientWidth
  const [r, g, b] = canvas.getContext("2d")!.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data
  return `rgb(${r},${g},${b})`
}

describe("halftone engine", () => {
  it("maps darkness to one of four stroke levels", () => {
    expect(darkness(255, 255, 255)).toBe(0)
    expect(darkness(0, 0, 0)).toBe(1)
    expect([0, 0.29, 0.3, 0.54, 0.55, 0.79, 0.8, 1].map(inkLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })

  it("draws each cell in the palette ink of its level", async () => {
    for (const [grey, expected] of [["#000000", "rgb(0,0,0)"], ["#808080", "rgb(0,255,0)"]] as const) {
      const canvas = canvasOf(40, 40)
      const { scene, state } = countingScene(grey)
      const handle = mount(canvas, scene, { still: true })
      await state.drawn
      // The centre of the first cell is always inside its capsule.
      expect(pixelAt(canvas, 5, 5)).toBe(expected)
      handle.stop()
      canvas.remove()
    }
  })

  it("renders exactly one frame when still, as under reduced motion", async () => {
    const canvas = canvasOf(80, 60)
    const { scene, state } = countingScene("#404040")
    const handle = mount(canvas, scene, { still: true })
    await state.drawn
    await nextFrames(6)
    expect(state.frames).toBe(1)
    // Regression: the first resize notification must not clear the still frame.
    expect(pixelAt(canvas, 5, 5)).toBe("rgb(42,91,255)")
    handle.stop()
    canvas.remove()
  })

  it("keeps drawing while animated, and stop() halts it", async () => {
    const canvas = canvasOf(80, 60)
    const { scene, state } = countingScene("#404040")
    const handle = mount(canvas, scene)
    await state.drawn
    await nextFrames(3)
    expect(state.frames).toBeGreaterThan(1)
    handle.stop()
    const frames = state.frames
    await nextFrames(6)
    expect(state.frames).toBe(frames)
    canvas.remove()
  })
})
