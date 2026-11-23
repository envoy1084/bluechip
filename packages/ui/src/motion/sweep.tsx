import {
  type GlimmDefaults,
  GlimmProvider,
  GlimmScope,
  type GlimmScopeHandle,
  type GlimmScopeProps,
  type Palette,
  type ScopePlayOptions
} from "glimm/react"
import { type CSSProperties, type ReactNode, type Ref, useMemo, useRef } from "react"

/**
 * The bluechip band: brand blue through cerulean to a touch of lilac. glimm's cosine-palette vectors, fitted with
 * its `accentChain(["#1f48e6", "#2a5bff", "#3c8aff", "#cd99fd", "#4c76ff"])` and rounded, so the page doesn't load
 * glimm's core entry just to compute them.
 */
export const SWEEP_PALETTE: Palette = {
  a: [0.291, 0.366, 0.955],
  b: [0.281, 0.197, 0.057],
  c: [0.5, 0.5, 0.5],
  d: [0.565, 0.649, 0.676]
}

export interface SweepProviderProps extends GlimmDefaults {
  readonly children: ReactNode
}

/**
 * Viewport sweeps (glimm) in bluechip's colors, for `useGlimm().sweep(navigate)` inside. Eases out like
 * `--ease-brand` (`easeOutExpo` is the same curve). Under reduced motion, or without WebGL, the change happens at
 * once.
 */
export function SweepProvider({ children, ...defaults }: SweepProviderProps) {
  return (
    <GlimmProvider palette={SWEEP_PALETTE} easing="easeOutExpo" sweepMs={1100} peakAlpha={0.9} {...defaults}>
      {children}
    </GlimmProvider>
  )
}

export interface MomentScopeProps extends Omit<GlimmScopeProps, "children"> {
  /** Usually none: the scope is an overlay. Children only for `pageEffect`, where the content itself leans in. */
  readonly children?: ReactNode
  /** From `useMoment()`. */
  readonly ref?: Ref<GlimmScopeHandle>
}

const OVERLAY: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 4,
  borderRadius: "inherit",
  pointerEvents: "none"
}

/**
 * Where a moment sweeps: a card whose news is worth a beat (limits locked, a trade filled, cash arrived). Put it
 * last inside the card, which must be `position: relative`; it covers the card, takes no space and never blocks a
 * press, and the band passes over the content without touching its layout or shadows. Sized for glimm's
 * "something notable in one place".
 */
export function MomentScope({ children, ref, style, ...props }: MomentScopeProps) {
  return (
    <GlimmScope
      ref={ref}
      palette={SWEEP_PALETTE}
      curve={0.22}
      span={0.64}
      fade={[0.16, 0.64]}
      pageEffect={false}
      style={{ ...OVERLAY, ...style }}
      {...props}
    >
      {children}
    </GlimmScope>
  )
}

/** How a moment plays: where it starts from, and whether nobody pressed anything for it. */
export type MomentOptions = Pick<ScopePlayOptions, "at" | "anticipate" | "onBurst" | "onLeave">

export interface Moment {
  /** Pass to the `MomentScope`. */
  readonly ref: Ref<GlimmScopeHandle>
  /**
   * Plays the sweep and runs `change` behind the band. Without a mounted scope, `change` just runs. Under reduced
   * motion or without WebGL glimm runs `change` at once with no sweep.
   */
  readonly play: (change?: () => void, options?: MomentOptions) => void
}

/** A moment to play on a `MomentScope`. */
export function useMoment(): Moment {
  const ref = useRef<GlimmScopeHandle>(null)
  return useMemo(() => ({
    ref,
    play: (change, options = {}) => {
      const scope = ref.current
      if (!scope) {
        change?.()
        return
      }
      scope.play({ ...options, ...(change === undefined ? {} : { change }) })
    }
  }), [])
}
