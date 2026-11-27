import { Console, Effect, FileSystem, Path } from "effect"
import { Command } from "effect/cli"
import { chromium } from "playwright"
import { createServer } from "vite"

import { ToolFailed } from "../errors.ts"

/** A PNG image at its square size, for an icon file. */
interface IconImage {
  readonly size: number
  readonly png: Uint8Array
}

/**
 * An `.ico` holding `images` as PNGs (every browser since Vista's reads them): a 6-byte header, a 16-byte entry per
 * image (a size of 256 is written as 0), then the images in order.
 */
export const icoFromPngs = (images: ReadonlyArray<IconImage>): Uint8Array => {
  const headerSize = 6 + 16 * images.length
  const ico = new Uint8Array(headerSize + images.reduce((total, image) => total + image.png.length, 0))
  const view = new DataView(ico.buffer)
  view.setUint16(2, 1, true)
  view.setUint16(4, images.length, true)

  let offset = headerSize
  images.forEach((image, index) => {
    const entry = 6 + 16 * index
    view.setUint8(entry, image.size >= 256 ? 0 : image.size)
    view.setUint8(entry + 1, image.size >= 256 ? 0 : image.size)
    view.setUint16(entry + 4, 1, true)
    view.setUint16(entry + 6, 32, true)
    view.setUint32(entry + 8, image.png.length, true)
    view.setUint32(entry + 12, offset, true)
    ico.set(image.png, offset)
    offset += image.png.length
  })
  return ico
}

const FAVICON = /^favicon-(\d+)$/

const failed = (tool: string) => (cause: unknown) => ToolFailed.make({ tool, output: String(cause) })

/**
 * Captures every `data-capture` element of the kit's Social images page (`apps/uikit`, served here by Vite) into
 * `apps/web/public/<capture>.png`, in Chromium with reduced motion so every halftone is its still frame; the
 * `favicon-<size>` captures become one `favicon.ico`.
 */
export const renderSocialImages = Effect.fn("og.renderSocialImages")(function*(root: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const out = path.join(root, "apps/web/public")

  const server = yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => (await createServer({ root: path.join(root, "apps/uikit"), logLevel: "error" })).listen(),
      catch: failed("vite")
    }),
    (server) => Effect.promise(() => server.close())
  )
  const url = server.resolvedUrls?.local[0]
  if (url === undefined) return yield* failed("vite")("no local URL")

  const browser = yield* Effect.acquireRelease(
    Effect.tryPromise({ try: () => chromium.launch(), catch: failed("chromium") }),
    (browser) => Effect.promise(() => browser.close())
  )
  const captures = yield* Effect.tryPromise({
    try: async () => {
      const page = await browser.newPage({
        viewport: { width: 1800, height: 1000 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce"
      })
      await page.goto(new URL("social", url).href, { waitUntil: "networkidle" })
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      // Only the capture shows: transparent icons must not pick up the page behind them.
      await page.addStyleTag({
        content: "html, body { background: transparent !important; } body { visibility: hidden; }"
      })
      const elements = await page.locator("[data-capture]").all()
      const shots: Array<{ readonly name: string; readonly png: Uint8Array }> = []
      for (const element of elements) {
        const name = await element.getAttribute("data-capture")
        if (name === null) continue
        // Pinned to the viewport's corner, whole pixels, so nothing around it bleeds into the edges; put back after.
        const style = await element.evaluate((node: HTMLElement) => {
          const before = node.style.cssText
          Object.assign(node.style, {
            position: "fixed",
            top: "0",
            left: "0",
            zIndex: "2147483647",
            visibility: "visible"
          })
          return before
        })
        // Halftones draw their still frame on the next animation frame once in view.
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        shots.push({ name, png: await element.screenshot({ omitBackground: true, animations: "disabled" }) })
        await element.evaluate((node: HTMLElement, before: string) => {
          node.style.cssText = before
        }, style)
      }
      return shots
    },
    catch: failed("playwright")
  })

  const favicons: Array<IconImage> = []
  for (const { name, png } of captures) {
    const favicon = FAVICON.exec(name)
    if (favicon !== null) {
      favicons.push({ size: Number(favicon[1]), png })
      continue
    }
    const file = path.join(out, `${name}.png`)
    yield* fs.makeDirectory(path.dirname(file), { recursive: true })
    yield* fs.writeFile(file, png)
    yield* Console.log(`og: ${path.relative(root, file)}`)
  }
  favicons.sort((a, b) => a.size - b.size)
  yield* fs.writeFile(path.join(out, "favicon.ico"), icoFromPngs(favicons))
  yield* Console.log(`og: apps/web/public/favicon.ico (${favicons.map((icon) => icon.size).join(", ")})`)
}, Effect.scoped)

export const og = Command.make("og").pipe(
  Command.withDescription("Render the web app's link previews and icons from the kit's Social images page"),
  Command.withHandler(() => renderSocialImages(process.cwd()))
)
