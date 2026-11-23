/* Pixel chip confetti for a first deposit or a first filled trade. Ported from the kit (KIT.motion.confetti). */
import { smooth, TAU } from "../easing.ts"
import { randomSeed, seededRandom } from "../random.ts"
import { prefersReducedMotion } from "../reduced-motion.ts"
import { oneShot } from "./canvas.ts"

export const CONFETTI_COLORS: ReadonlyArray<string> = [
  "#0000ff",
  "#3c8aff",
  "#ffd12f",
  "#66c800",
  "#b6f569",
  "#fea8cd",
  "#cd99fd"
]
const DURATION = 2.3
const GRAVITY = 520

export interface ConfettiOptions {
  /** Origin across the container, 0..1. Defaults to 0.5. */
  readonly x?: number
  /** Origin down the container, 0..1. Defaults to 0.62. */
  readonly y?: number
  readonly count?: number
  readonly colors?: ReadonlyArray<string>
  readonly onDone?: () => void
}

export interface ConfettiHandle {
  readonly stop: () => void
}

/**
 * Burst confetti over `target`: a canvas to draw on, or any element, which gets a temporary overlay canvas (made
 * `position: relative` if it is static). Under reduced motion nothing is drawn; the message carries the moment.
 */
export const fireConfetti = (target: HTMLElement, options: ConfettiOptions = {}): ConfettiHandle => {
  if (prefersReducedMotion()) {
    options.onDone?.()
    return { stop: () => {} }
  }
  const overlay = !(target instanceof HTMLCanvasElement)
  const canvas = target instanceof HTMLCanvasElement ? target : document.createElement("canvas")
  if (overlay) {
    canvas.setAttribute("aria-hidden", "true")
    canvas.setAttribute("data-slot", "confetti")
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "5"
    })
    if (getComputedStyle(target).position === "static") target.style.position = "relative"
    target.appendChild(canvas)
  }
  const r = seededRandom(randomSeed()), colors = options.colors ?? CONFETTI_COLORS
  const parts = Array.from({ length: options.count ?? 80 }, () => {
    const a = -Math.PI / 2 + (r() - 0.5) * 1.5, speed = 420 + r() * 520
    return {
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: r() * TAU,
      vr: (r() - 0.5) * 10,
      flip: 6 + r() * 10,
      size: 5 + r() * 5,
      chip: r() < 0.3,
      color: colors[Math.floor(r() * colors.length)] ?? "#0000ff",
      life: 1.5 + r() * 0.7
    }
  })
  const remove = () => {
    if (overlay) canvas.remove()
  }
  const animation = oneShot(canvas, DURATION, (c, W, H, t) => {
    const ox = W * (options.x ?? 0.5), oy = H * (options.y ?? 0.62)
    const drag = (1 - Math.exp(-2.2 * t)) / 2.2
    const scale = Math.min(1, W / 520) * 0.4 + 0.6
    for (const q of parts) {
      if (t > q.life) continue
      const x = ox + q.vx * drag, y = oy + q.vy * drag + GRAVITY * t * t * 0.5
      c.save()
      c.globalAlpha = 1 - smooth((t - q.life + 0.45) / 0.45)
      c.translate(x, y)
      c.rotate(q.rot + q.vr * t)
      c.scale(1, Math.cos(t * q.flip))
      c.fillStyle = q.color
      const s = q.size * scale
      c.beginPath()
      if (q.chip) {
        // A tiny chip with the price line on it.
        c.arc(0, 0, s * 0.75, 0, TAU)
        c.fill()
        c.strokeStyle = "#fff"
        c.lineWidth = s * 0.22
        c.lineCap = "round"
        c.beginPath()
        c.moveTo(-s * 0.7, s * 0.3)
        c.lineTo(-s * 0.1, -s * 0.05)
        c.lineTo(s * 0.1, s * 0.1)
        c.lineTo(s * 0.7, -s * 0.45)
        c.stroke()
      } else {
        c.roundRect(-s / 2, -s / 2, s, s, s * 0.2)
        c.fill()
      }
      c.restore()
    }
  }, {
    autoplay: false,
    onDone: () => {
      remove()
      options.onDone?.()
    }
  })
  animation.play()
  return {
    stop: () => {
      animation.stop()
      remove()
    }
  }
}
