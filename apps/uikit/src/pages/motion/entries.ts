import type { HalftoneSceneName } from "@bluechip/ui/motion/halftone"

export interface Entry {
  readonly n: number
  readonly name: string
  readonly used: string
  readonly duration: string
  readonly easing: string
  readonly reduced: string
}

export interface SceneEntry extends Entry {
  readonly scene: HalftoneSceneName
  readonly cell: number
  readonly replay?: boolean
}

export const SCENES: ReadonlyArray<SceneEntry> = [
  {
    n: 1,
    name: "Rising chip",
    scene: "logo",
    cell: 9,
    used: "Landing hero, home empty state",
    duration: "4.4 s loop, glint every 5.3 s",
    easing: "Sine",
    reduced: "Still chip, tilted, glint resting on the line"
  },
  {
    n: 2,
    name: "Chip spin",
    scene: "coin",
    cell: 8,
    used: "Trade in progress, waiting for a fill",
    duration: "5 s spin, 10.5 s orbit",
    easing: "Linear (constant spin)",
    reduced: "Still chip with three chips frozen on the orbit"
  },
  {
    n: 3,
    name: "Butterflies",
    scene: "butterflies",
    cell: 6,
    used: "Creating an agent, agents empty state",
    duration: "Endless, 3 beats a second",
    easing: "Fast downstroke, slow recovery, glides",
    reduced: "Butterflies at rest, wings open"
  },
  {
    n: 4,
    name: "Market settling",
    scene: "market",
    cell: 8,
    used: "Rebalancing, portfolio loading",
    duration: "6 s per rebalance, 60 ms stagger",
    easing: "Damped spring",
    reduced: "Bars at their settled heights"
  },
  {
    n: 5,
    name: "Garden bloom",
    scene: "garden",
    cell: 7,
    used: "“Limits locked” after Face ID",
    duration: "3.6 s bloom, then a slow sway",
    easing: "Ease out stems, spring petals",
    reduced: "The garden in full bloom",
    replay: true
  },
  {
    n: 6,
    name: "Warp",
    scene: "warp",
    cell: 8,
    used: "Sending a trade or a withdrawal",
    duration: "Endless, surge every 5 s",
    easing: "Perspective (1/z)",
    reduced: "Streaks frozen mid-flight"
  },
  {
    n: 7,
    name: "Clouds",
    scene: "clouds",
    cell: 8,
    used: "Market closed, weekends, holidays",
    duration: "35 – 80 s drift",
    easing: "Linear",
    reduced: "Still sky with the moon"
  },
  {
    n: 11,
    name: "Blocked",
    scene: "blocked",
    cell: 8,
    used: "“Your limit stopped this trade.”",
    duration: "4.4 s: 1.15 s roll, hit, 3 s settle",
    easing: "Ease in, then damped bounce",
    reduced: "The moment of impact, flash on the fence",
    replay: true
  }
]

export const PIXEL: Readonly<Record<"grid" | "seal" | "assemble" | "confetti", Entry>> = {
  grid: {
    n: 8,
    name: "Reactive grid",
    used: "Onboarding and page backgrounds",
    duration: "Endless; ripple 1.4 s",
    easing: "Spring (k .08, damping .74)",
    reduced: "A still noise field, no cursor response"
  },
  seal: {
    n: 9,
    name: "Pixel seal",
    used: "Face ID approval sheet",
    duration: "2.2 s: land 1 s, check .4 s, shine",
    easing: "Ease out back, stagger outside in",
    reduced: "The finished seal with its check"
  },
  assemble: {
    n: 10,
    name: "Avatar reveal",
    used: "A new agent's butterfly appears",
    duration: "2.4 s: land 1.1 s, two wing beats",
    easing: "Ease out back, stagger from the body",
    reduced: "The finished butterfly"
  },
  confetti: {
    n: 12,
    name: "Chip confetti",
    used: "First deposit arrived, first trade filled. Once per account.",
    duration: "2.3 s",
    easing: "Drag and gravity",
    reduced: "None. The message carries it."
  }
}

export const INTERFACE: Readonly<Record<"roll" | "scramble", Entry>> = {
  roll: {
    n: 13,
    name: "Number roll and flash",
    used: "Balances, prices, agent spend counters (NumberFlow)",
    duration: "640 ms roll, 900 ms flash",
    easing: "--ease-brand",
    reduced: "Digits swap instantly; color still shows the direction"
  },
  scramble: {
    n: 14,
    name: "Text scramble",
    used: "Landing headings, empty states. One heading per screen.",
    duration: "800 ms",
    easing: "Linear, left to right",
    reduced: "Text appears at once"
  }
}

export const FEEL: Readonly<Record<"morph" | "skeleton" | "haptics" | "moment", Entry>> = {
  morph: {
    n: 15,
    name: "Text morph",
    used: "Labels that change in place: Approve → Filled, Copy → Copied (torph)",
    duration: "320 ms",
    easing: "--ease-brand",
    reduced: "The new label at once"
  },
  skeleton: {
    n: 16,
    name: "Measured skeleton",
    used: "Every loading state: drawn from the real content, so nothing moves when it lands (skullet)",
    duration: "4 s shimmer; reveal in sequence",
    easing: "Cosine sweep",
    reduced: "Still bars, content at once"
  },
  haptics: {
    n: 17,
    name: "Haptics",
    used: "Face ID done, trade filled, limit said no, settings flipped (web-haptics)",
    duration: "15 – 160 ms patterns",
    easing: "—",
    reduced: "Unchanged. Desktop has none; the ring here shows each one"
  },
  moment: {
    n: 18,
    name: "Moment sweep",
    used: "Limits locked, trade filled, cash arrived. Nothing else (glimm)",
    duration: "1.6 s band, gone by mid-card",
    easing: "Smooth, curved band",
    reduced: "No band; the change shows at once. Same without WebGL"
  }
}

export const AGENTS = ["Weekly buyer", "Rebalancer", "Stop-loss guard", "Stock picker"]
export const LINES = ["Your limit stopped this trade.", "Let your agents trade for you.", "Limits locked with Face ID."]
export const STEPS = [1.8, -0.9, 2.6, -1.4, 0.7]
export const usd = { style: "currency", currency: "USD" } as const

export const REDUCED: ReadonlyArray<readonly [string, string]> = [
  ["Halftone scenes (1–7, 11)", "One composed still frame, chosen per scene. No pointer response."],
  ["Seal, avatar reveal (9, 10)", "The finished picture, drawn at once."],
  ["Reactive grid (8)", "A still noise field. No springs, no ripples."],
  ["Confetti (12)", "Not drawn. The toast or heading says it."],
  ["Number roll, flash (13)", "Digits change in place; the up or down color stays on the text."],
  ["Text scramble (14)", "The text is there from the start."],
  ["Text morph (15)", "The new label replaces the old one at once."],
  ["Measured skeleton (16)", "Bars hold still; content replaces them without a fade."],
  ["Moment sweep (18)", "No band. The change is made at once, as without WebGL."]
]
