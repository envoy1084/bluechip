import { darkness, inkLevel, mount, type Palette, type Scene } from "@bluechip/ui/motion/halftone"
import { assert, describe, it } from "@effect/vitest"

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

// The centre of the first cell, always inside its capsule when the cell has ink.
const firstCell = (canvas: HTMLCanvasElement) => {
  const scale = canvas.width / canvas.clientWidth
  const [r, g, b, a] = canvas.getContext("2d")!.getImageData(Math.round(5 * scale), Math.round(5 * scale), 1, 1).data
  return `rgba(${r},${g},${b},${a})`
}

describe("darkness", () => {
  it.each([
    { name: "white is 0", r: 255, g: 255, b: 255, expected: 0 },
    { name: "black is 1", r: 0, g: 0, b: 0, expected: 1 },
    { name: "red weighs 0.299 by luma", r: 255, g: 0, b: 0, expected: 0.701 },
    { name: "green weighs 0.587 by luma", r: 0, g: 255, b: 0, expected: 0.413 },
    { name: "blue weighs 0.114 by luma", r: 0, g: 0, b: 255, expected: 0.886 }
  ])("$name", ({ b, expected, g, r }) => {
    assert.closeTo(darkness(r, g, b), expected, 1e-9)
  })
})

describe("inkLevel", () => {
  it.each([
    { ink: 0, expected: 0 },
    { ink: 0.29, expected: 0 },
    { ink: 0.3, expected: 1 },
    { ink: 0.54, expected: 1 },
    { ink: 0.55, expected: 2 },
    { ink: 0.79, expected: 2 },
    { ink: 0.8, expected: 3 },
    { ink: 1, expected: 3 }
  ])("$ink is level $expected", ({ expected, ink }) => {
    assert.strictEqual(inkLevel(ink), expected)
  })
})

describe("mount", () => {
  it.each([
    { name: "a black cell in the darkest ink", grey: "#000000", expected: "rgba(0,0,0,255)" },
    { name: "a mid-grey cell in the second ink", grey: "#808080", expected: "rgba(0,255,0,255)" },
    { name: "a white cell left empty", grey: "#ffffff", expected: "rgba(0,0,0,0)" }
  ])("draws $name", async ({ expected, grey }) => {
    const canvas = canvasOf(40, 40)
    const { scene, state } = countingScene(grey)
    const handle = mount(canvas, scene, { still: true })

    await state.drawn

    assert.strictEqual(firstCell(canvas), expected)
    handle.stop()
    canvas.remove()
  })

  it("draws in the palette it is given over the scene's", async () => {
    const canvas = canvasOf(40, 40)
    const { scene, state } = countingScene("#000000")
    const handle = mount(canvas, scene, { still: true, palette: ["#000000", "#000000", "#000000", "#ff0000"] })

    await state.drawn

    assert.strictEqual(firstCell(canvas), "rgba(255,0,0,255)")
    handle.stop()
    canvas.remove()
  })

  it("draws exactly one frame when still, and keeps it", async () => {
    const canvas = canvasOf(80, 60)
    const { scene, state } = countingScene("#404040")
    const handle = mount(canvas, scene, { still: true })

    await state.drawn
    await nextFrames(6)

    // Regression: the first resize notification must not clear the still frame.
    assert.deepStrictEqual({ frames: state.frames, pixel: firstCell(canvas) }, {
      frames: 1,
      pixel: "rgba(42,91,255,255)"
    })
    handle.stop()
    canvas.remove()
  })

  it("keeps drawing while animated", async () => {
    const canvas = canvasOf(80, 60)
    const { scene, state } = countingScene("#404040")
    const handle = mount(canvas, scene)

    await state.drawn
    await nextFrames(3)

    assert.isAbove(state.frames, 1)
    handle.stop()
    canvas.remove()
  })

  it("stops drawing after stop()", async () => {
    const canvas = canvasOf(80, 60)
    const { scene, state } = countingScene("#404040")
    const handle = mount(canvas, scene)
    await state.drawn

    handle.stop()
    const frames = state.frames
    await nextFrames(6)

    assert.strictEqual(state.frames, frames)
    canvas.remove()
  })

  it("draws nothing for a scene name never registered", async () => {
    const canvas = canvasOf(40, 40)
    const handle = mount(canvas, "no-such-scene", { still: true })

    await nextFrames(2)

    assert.strictEqual(firstCell(canvas), "rgba(0,0,0,0)")
    handle.stop()
    canvas.remove()
  })
})
