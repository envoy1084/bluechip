/* Text scramble: the text resolves left to right out of random glyphs. Ported from the kit (KIT.motion.scramble).
   Writes the element's children directly, so a React parent renders the element once and lets this run. */
import { randomSeed, seededRandom } from "../random.ts"
import { prefersReducedMotion } from "../reduced-motion.ts"

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz0123456789"
/** How often the noise glyphs change, in ms. */
const NOISE_EVERY = 45

export interface ScrambleOptions {
  /** Milliseconds until the whole text has resolved. Defaults to 800. */
  readonly duration?: number
  /** Class for the not-yet-resolved glyphs. */
  readonly glyphClassName?: string
  readonly onDone?: () => void
}

export interface ScrambleHandle {
  /** Stop and show the final text. */
  readonly stop: () => void
}

/** Resolve `el`'s text to `text`. Under reduced motion the text is there at once. */
export const scramble = (el: HTMLElement, text: string, options: ScrambleOptions = {}): ScrambleHandle => {
  let raf = 0, done = false
  const finish = (): void => {
    if (done) return
    done = true
    cancelAnimationFrame(raf)
    el.textContent = text
    options.onDone?.()
  }
  if (prefersReducedMotion()) {
    finish()
    return { stop: finish }
  }
  const duration = options.duration ?? 800, chars = [...text], r = seededRandom(randomSeed())
  const resolveAt = chars.map((_, i) => (i / chars.length) * duration * 0.7 + r() * duration * 0.3)
  let t0 = 0, last = 0, noise = chars.map(() => "")
  const tick = (now: number): void => {
    if (!el.isConnected) return
    if (!t0) t0 = now
    const t = now - t0
    if (now - last > NOISE_EVERY) {
      last = now
      noise = chars.map(() => GLYPHS[Math.floor(r() * GLYPHS.length)] ?? "")
    }
    if (t >= duration) return finish()
    el.replaceChildren(...chars.map((ch, i) => {
      if (t >= (resolveAt[i] ?? 0) || ch === " ") return ch
      const glyph = document.createElement("span")
      glyph.textContent = noise[i] ?? ""
      if (options.glyphClassName) glyph.className = options.glyphClassName
      return glyph
    }))
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return { stop: finish }
}
