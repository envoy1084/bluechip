/* The warp field: blue streaks and ticker chips rushing out of a vanishing point, as if the page jumped to light
   speed. It launches fast, eases to a cruise, steers toward the pointer and surges on a press or on demand. */
import { tickerColors } from "../../lib/tickers.ts"
import { clamp, outCubic, smooth } from "../easing.ts"
import { seededRandom } from "../random.ts"
import { prefersReducedMotion } from "../reduced-motion.ts"
import { fitCanvas } from "./canvas.ts"

export interface WarpFieldOptions {
  /** Market symbols that fly past as ticker chips. Empty for streaks only. */
  readonly symbols?: ReadonlyArray<string>
  /** Streaks per 10,000 square CSS pixels, at most 520 in all. Defaults to 6. */
  readonly density?: number
  /** Seconds the launch takes to ease into the cruise. Defaults to 2.4. */
  readonly launch?: number
  readonly seed?: number
  /** The element whose pointer steers the field. Defaults to the canvas's parent. */
  readonly host?: HTMLElement
}

export interface WarpFieldHandle {
  /** A burst of speed that fades over about a second. */
  readonly surge: () => void
  readonly stop: () => void
}

interface Star {
  x: number
  y: number
  z: number
  /** Index into `INKS`. */
  readonly ink: number
}

interface Chip {
  angle: number
  radius: number
  z: number
  sprite: number
}

/** Streak inks, mostly brand blue with a little cerulean and lilac, as `r,g,b`. */
const INKS = ["42,91,255", "42,91,255", "60,138,255", "76,118,255", "205,153,253", "26,59,194"] as const

/** Depth units travelled per second at cruise. */
const CRUISE = 0.16
/** How many times the cruise speed the field starts at. */
const LAUNCH_BOOST = 16
const SURGE_BOOST = 5
const SURGE_SECONDS = 1.1
const NEAR = 0.035
const CHIP_HEIGHT = 20
/** Chips are drawn from sprites this many times their largest on-screen size, so they stay crisp. */
const SPRITE_SCALE = 3

/** A ticker chip painted once: the symbol in Doto on its company's gradient. */
const paintSprite = (symbol: string, dpr: number): HTMLCanvasElement => {
  const sprite = document.createElement("canvas")
  const ctx = sprite.getContext("2d")
  const h = CHIP_HEIGHT * SPRITE_SCALE * dpr
  const font = `800 ${Math.round(h * 0.62)}px Doto, ui-monospace, monospace`
  if (!ctx) return sprite
  ctx.font = font
  const w = Math.ceil(ctx.measureText(symbol).width + h * 0.9)
  sprite.width = w
  sprite.height = h
  const colors = tickerColors(symbol)
  const fill = ctx.createLinearGradient(0, 0, 0, h)
  fill.addColorStop(0, colors.top)
  fill.addColorStop(1, colors.bottom)
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, h * 0.3)
  ctx.fill()
  ctx.font = font
  ctx.fillStyle = colors.text
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(symbol, w / 2, h * 0.54)
  return sprite
}

/** Run the warp on a canvas sized by CSS. Under reduced motion it draws one still frame at cruise speed. */
export const warpField = (canvas: HTMLCanvasElement, options: WarpFieldOptions = {}): WarpFieldHandle => {
  const symbols = options.symbols ?? [], density = options.density ?? 6, launch = options.launch ?? 2.4
  const reduce = prefersReducedMotion()
  const random = seededRandom(options.seed ?? 7)
  const host = options.host ?? canvas.parentElement
  let stars: Array<Star> = [], chips: Array<Chip> = [], sprites: Array<HTMLCanvasElement> = []
  let raf = 0, visible = true, dead = false, last = 0, clock = 0, surgeAt = -1e9, aspect = 1
  // Where the vanishing point leans, eased toward `aim` (−1..1 on each axis).
  const lean = { x: 0, y: 0 }, aim = { x: 0, y: 0 }

  const spawnStar = (z: number): Star => ({
    x: (random() * 2 - 1) * 1.6 * aspect,
    y: (random() * 2 - 1) * 1.6,
    z,
    ink: Math.floor(random() * INKS.length)
  })
  // Chips fly wide of the centre, so they pass around the headline rather than through it.
  const spawnChip = (z: number, sprite: number): Chip => ({
    angle: random() * Math.PI * 2,
    radius: 0.55 + random() * 0.75,
    z,
    sprite
  })

  const paintSprites = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    sprites = symbols.map((symbol) => paintSprite(symbol, dpr))
  }

  const ensurePopulation = (width: number, height: number): void => {
    const count = Math.min(520, Math.round((width * height) / 10_000 * density))
    while (stars.length < count) stars.push(spawnStar(random()))
    if (stars.length > count) stars = stars.slice(0, count)
    const chipCount = symbols.length === 0 ? 0 : Math.min(symbols.length, width < 640 ? 6 : 11)
    while (chips.length < chipCount) chips.push(spawnChip(0.25 + random() * 0.75, chips.length % symbols.length))
    if (chips.length > chipCount) chips = chips.slice(0, chipCount)
  }

  /** Depth units per second: the launch easing into the cruise, plus any surge. */
  const speedAt = (t: number): number => {
    const launching = reduce ? 0 : 1 - outCubic(t / launch)
    const surging = Math.max(0, 1 - (t - surgeAt) / SURGE_SECONDS)
    return CRUISE * (1 + LAUNCH_BOOST * launching * launching + SURGE_BOOST * smooth(surging))
  }

  const draw = (dt: number): void => {
    const fitted = fitCanvas(canvas)
    if (!fitted || !fitted.width || !fitted.height) return
    const { ctx, width: W, height: H } = fitted
    aspect = Math.max(1, W / H)
    ensurePopulation(W, H)

    lean.x += (aim.x - lean.x) * Math.min(1, dt * 2.5)
    lean.y += (aim.y - lean.y) * Math.min(1, dt * 2.5)
    const cx = W * (0.5 + lean.x * 0.07), cy = H * (0.46 + lean.y * 0.07), focal = Math.min(W, H) * 0.42
    const speed = speedAt(clock), step = speed * dt
    // Streaks are as long as a few frames of travel, so they stretch at launch and shrink to dashes at cruise.
    const trail = Math.max(0.012, speed * (reduce ? 0.06 : 0.07))
    const reach = Math.hypot(W, H) * 0.6

    ctx.lineCap = "round"
    for (const star of stars) {
      star.z -= step
      if (star.z <= NEAR) Object.assign(star, spawnStar(1))
      const z0 = star.z, z1 = Math.min(1.05, z0 + trail)
      const x0 = cx + (star.x / z0) * focal, y0 = cy + (star.y / z0) * focal
      const x1 = cx + (star.x / z1) * focal, y1 = cy + (star.y / z1) * focal
      if (Math.hypot(x0 - cx, y0 - cy) > reach && Math.hypot(x1 - cx, y1 - cy) > reach) {
        Object.assign(star, spawnStar(1))
        continue
      }
      const near = 1 - z0
      // Fade in from the far plane and keep the centre (behind the headline) faint.
      const fromCentre = clamp(Math.hypot(x0 - cx, y0 - cy) / (Math.min(W, H) * 0.36))
      const alpha = clamp((1 - z0) * 2.4) * (0.18 + 0.82 * near) * (0.25 + 0.75 * fromCentre)
      if (alpha < 0.02) continue
      ctx.strokeStyle = `rgba(${INKS[star.ink]},${alpha.toFixed(3)})`
      ctx.lineWidth = 0.6 + near * near * 2.6
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x0, y0)
      ctx.stroke()
    }

    for (const chip of chips) {
      chip.z -= step * 0.55
      const sprite = sprites[chip.sprite]
      const scale = 0.28 / chip.z
      if (chip.z <= 0.12 || scale > 2.4) {
        Object.assign(chip, spawnChip(1, (chip.sprite + chips.length) % Math.max(1, sprites.length)))
        continue
      }
      if (!sprite || !sprite.width) continue
      const x = cx + Math.cos(chip.angle) * chip.radius * (focal / chip.z) * 0.5
      const y = cy + Math.sin(chip.angle) * chip.radius * (focal / chip.z) * 0.5
      const h = CHIP_HEIGHT * scale, w = (sprite.width / sprite.height) * h
      if (x + w < 0 || x - w > W || y + h < 0 || y - h > H) continue
      // Like the streaks, chips stay faint while they pass behind the words in the middle.
      const fromCentre = clamp(Math.hypot(x - cx, y - cy) / (Math.min(W, H) * 0.42))
      const alpha = clamp((1 - chip.z) * 3) * clamp((2.4 - scale) * 1.4) * fromCentre * fromCentre
      ctx.globalAlpha = alpha * 0.92
      ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h)
    }
    ctx.globalAlpha = 1
  }

  const frame = (now: number): void => {
    raf = 0
    if (dead || !canvas.isConnected) return
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000)
    last = now
    clock += dt
    draw(dt)
    if (visible && !document.hidden) raf = requestAnimationFrame(frame)
  }

  const start = (): void => {
    if (dead || raf || reduce) return
    last = 0
    raf = requestAnimationFrame(frame)
  }
  const pause = (): void => {
    cancelAnimationFrame(raf)
    raf = 0
  }

  const move = (event: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    aim.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
    aim.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1)
  }
  const leave = (): void => {
    aim.x = aim.y = 0
  }
  const surge = (): void => {
    if (!reduce) surgeAt = clock
  }
  const visibility = (): void => {
    if (document.hidden) pause()
    else if (visible) start()
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    if (visible) start()
    else pause()
  })
  // Resizing clears the canvas: the still frame has to be drawn again.
  const resized = new ResizeObserver(() => {
    if (reduce && !dead) draw(0)
  })
  paintSprites()
  // Doto may still be loading: repaint the chips once it has, so their symbols aren't drawn in the fallback font.
  void document.fonts?.load("800 20px Doto").then(() => {
    if (dead) return
    paintSprites()
    if (reduce) draw(0)
  }, () => undefined)

  if (reduce) {
    // One still frame: streaks spread through the depth, chips caught mid-flight.
    clock = launch
    raf = requestAnimationFrame(() => {
      raf = 0
      draw(0)
    })
    resized.observe(canvas)
  } else {
    host?.addEventListener("pointermove", move)
    host?.addEventListener("pointerleave", leave)
    host?.addEventListener("pointerdown", surge)
    document.addEventListener("visibilitychange", visibility)
    observer.observe(canvas)
  }

  return {
    surge,
    stop: () => {
      dead = true
      pause()
      observer.disconnect()
      resized.disconnect()
      host?.removeEventListener("pointermove", move)
      host?.removeEventListener("pointerleave", leave)
      host?.removeEventListener("pointerdown", surge)
      document.removeEventListener("visibilitychange", visibility)
    }
  }
}
