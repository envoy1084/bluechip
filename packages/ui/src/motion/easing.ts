/* Easing curves for canvas motion, the same ones the kit's scenes and pixel moments use. Each takes progress and
   clamps it to 0..1 first, so callers can pass raw `(t - delay) / duration`. */

export const TAU = Math.PI * 2

export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value))

/** Smoothstep: eases in and out. */
export const smooth = (progress: number): number => {
  const v = clamp(progress)
  return v * v * (3 - 2 * v)
}

export const outCubic = (progress: number): number => 1 - Math.pow(1 - clamp(progress), 3)

/** Ease out with an overshoot of strength `k` before settling. */
export const outBack = (progress: number, k = 1.6): number => {
  const v = clamp(progress) - 1
  return 1 + v * v * ((k + 1) * v + k)
}

/** A damped spring from 0 to 1: overshoots once and settles. Unclamped above, 0 before it starts. */
export const spring = (progress: number, stiffness = 6, frequency = 9): number =>
  progress <= 0 ? 0 : 1 - Math.exp(-stiffness * progress) * Math.cos(frequency * progress)
