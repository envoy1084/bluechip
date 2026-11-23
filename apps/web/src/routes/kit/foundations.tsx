import { Button } from "@bluechip/ui/components/button"
import { Input } from "@bluechip/ui/components/input"
import { cn } from "@bluechip/ui/lib/cn"
import { createFileRoute } from "@tanstack/react-router"
import { type ReactNode, useId } from "react"

export const Route = createFileRoute("/kit/foundations")({ component: KitFoundations })

/* ---------- Tokens, as they are named in theme.css ---------- */

interface Swatch {
  readonly token: string
  readonly hex: string
  /** The utility that paints it, spelled out so Tailwind emits the token. */
  readonly className: string
  readonly note?: string
}

const BRAND: ReadonlyArray<Swatch> = [
  { token: "blue", hex: "#2a5bff", className: "bg-blue", note: "Base Blue: primary actions, links" },
  { token: "blue-hi", hex: "#4c76ff", className: "bg-blue-hi", note: "Top of the primary gradient" },
  { token: "blue-lo", hex: "#1f48e6", className: "bg-blue-lo" },
  { token: "blue-deep", hex: "#1a3bc2", className: "bg-blue-deep" },
  { token: "blue-200", hex: "#C9D3FF", className: "bg-blue-200" },
  { token: "blue-100", hex: "#E6EAFF", className: "bg-blue-100" },
  { token: "blue-50", hex: "#F3F5FF", className: "bg-blue-50", note: "Selected rows, tinted tiles" },
  { token: "cerulean", hex: "#3C8AFF", className: "bg-cerulean" },
  { token: "yellow", hex: "#FFD12F", className: "bg-yellow" },
  { token: "yellow-soft", hex: "#FFF4C7", className: "bg-yellow-soft" },
  { token: "green", hex: "#66C800", className: "bg-green" },
  { token: "lime", hex: "#B6F569", className: "bg-lime" },
  { token: "red", hex: "#FC401F", className: "bg-red" },
  { token: "pink", hex: "#FEA8CD", className: "bg-pink" },
  { token: "tan", hex: "#B8A581", className: "bg-tan" },
  { token: "lilac", hex: "#CD99FD", className: "bg-lilac" }
]

const NEUTRALS: ReadonlyArray<Swatch> = [
  { token: "white", hex: "#FFFFFF", className: "bg-white", note: "Cards and fields" },
  { token: "canvas", hex: "#FBFBFC", className: "bg-canvas", note: "Page background" },
  { token: "sunken", hex: "#F4F5F7", className: "bg-sunken", note: "Wells, recessed areas" },
  { token: "g-50", hex: "#F8F9FA", className: "bg-g-50" },
  { token: "g-100", hex: "#EEF0F3", className: "bg-g-100", note: "Hairlines inside cards" },
  { token: "g-200", hex: "#DEE1E7", className: "bg-g-200" },
  { token: "g-300", hex: "#B1B7C3", className: "bg-g-300" },
  { token: "g-400", hex: "#8A909C", className: "bg-g-400", note: "Placeholders, disabled text" },
  { token: "g-500", hex: "#676E7B", className: "bg-g-500", note: "Descriptions" },
  { token: "g-600", hex: "#5B616E", className: "bg-g-600", note: "Body copy" },
  { token: "g-700", hex: "#444852", className: "bg-g-700" },
  { token: "g-800", hex: "#32353D", className: "bg-g-800" },
  { token: "ink", hex: "#0A0B0D", className: "bg-ink", note: "Headings and values" }
]

const SEMANTIC: ReadonlyArray<
  { readonly name: string; readonly use: string; readonly swatches: ReadonlyArray<Swatch> }
> = [
  {
    name: "Gain",
    use: "Up moves, done, within limits",
    swatches: [
      { token: "gain", hex: "#0B8043", className: "bg-gain" },
      { token: "gain-wash", hex: "#EFFAF3", className: "bg-gain-wash" },
      { token: "gain-line", hex: "#C9ECD7", className: "bg-gain-line" }
    ]
  },
  {
    name: "Loss",
    use: "Down moves, stopped by a limit, destructive",
    swatches: [
      { token: "loss", hex: "#CC3519", className: "bg-loss" },
      { token: "loss-wash", hex: "#FFF3EF", className: "bg-loss-wash" },
      { token: "loss-line", hex: "#FFD3C7", className: "bg-loss-line" }
    ]
  },
  {
    name: "Warn",
    use: "Close to a limit, paused",
    swatches: [
      { token: "warn", hex: "#8A5F00", className: "bg-warn" },
      { token: "warn-wash", hex: "#FFF8E1", className: "bg-warn-wash" },
      { token: "warn-line", hex: "#F3E2A6", className: "bg-warn-line" }
    ]
  },
  {
    name: "Info",
    use: "Waiting for you, neutral notes",
    swatches: [
      { token: "info", hex: "#2a5bff", className: "bg-info" },
      { token: "info-wash", hex: "#F3F5FF", className: "bg-info-wash" },
      { token: "info-line", hex: "#D4DBFF", className: "bg-info-line" }
    ]
  }
]

const SERIES: ReadonlyArray<Swatch> = [
  { token: "series-1", hex: "#2a5bff", className: "bg-series-1" },
  { token: "series-2", hex: "#3C8AFF", className: "bg-series-2" },
  { token: "series-3", hex: "#66C800", className: "bg-series-3" },
  { token: "series-4", hex: "#FFD12F", className: "bg-series-4" },
  { token: "series-5", hex: "#FEA8CD", className: "bg-series-5" },
  { token: "series-6", hex: "#CD99FD", className: "bg-series-6" },
  { token: "series-7", hex: "#B8A581", className: "bg-series-7" },
  { token: "series-8", hex: "#444852", className: "bg-series-8" },
  { token: "series-cash", hex: "#B1B7C3", className: "bg-series-cash", note: "Cash, always last" }
]

const TYPE_SCALE: ReadonlyArray<
  { readonly token: string; readonly spec: string; readonly className: string; readonly sample: string }
> = [
  { token: "display-1", spec: "64 / 1 · −4.5%", className: "text-display-1 font-semibold", sample: "$10,452.90" },
  { token: "display-2", spec: "48 / 1.04 · −4%", className: "text-display-2 font-semibold", sample: "Hire an agent." },
  { token: "display-3", spec: "40 / 1.06 · −4%", className: "text-display-3 font-semibold", sample: "Set its limits." },
  { token: "title-1", spec: "28 / 1.15 · −3%", className: "text-title-1 font-semibold", sample: "Your portfolio" },
  {
    token: "title-2",
    spec: "22 / 1.2 · −2.5%",
    className: "text-title-2 font-semibold",
    sample: "Rebalancer's limits"
  },
  { token: "title-3", spec: "18 / 1.3 · −2%", className: "text-title-3 font-semibold", sample: "Stopped by limit" },
  {
    token: "body-lg",
    spec: "16 / 1.55",
    className: "text-body-lg",
    sample: "Your agent can never go past these limits."
  },
  {
    token: "body",
    spec: "15 / 1.55",
    className: "text-body",
    sample: "Limits are checked onchain before every trade."
  },
  { token: "body-sm", spec: "14 / 1.5", className: "text-body-sm", sample: "Bought 2 NVDA for $362.84." },
  { token: "label", spec: "13 / 1.4", className: "text-label font-[550]", sample: "Spend per day" },
  { token: "label-sm", spec: "12.5 / 1.4", className: "text-label-sm text-g-500", sample: "Only you see this." },
  { token: "caption", spec: "12 / 1.4", className: "text-caption text-g-500", sample: "Updated 4 seconds ago" },
  { token: "caption-sm", spec: "11 / 1.35", className: "text-caption-sm text-g-500", sample: "Prices from Coinbase" }
]

const DEPTH = [
  { token: "hair", className: "shadow-hair", use: "A hairline edge, no lift" },
  { token: "e1", className: "shadow-e1", use: "Flat cards, tables, inputs at rest" },
  { token: "e2", className: "shadow-e2", use: "Default cards" },
  { token: "e3", className: "shadow-e3", use: "Menus, popovers, hover lift" },
  { token: "e4", className: "shadow-e4", use: "Dialogs and sheets" }
] as const

const SURFACES = [
  { token: "surface-primary", className: "surface-primary", label: "Create agent", use: "The one action that matters" },
  {
    token: "surface-secondary",
    className: "surface-secondary",
    label: "Deposit cash",
    use: "Everything else you press"
  },
  { token: "surface-danger", className: "surface-danger", label: "Remove agent", use: "Quiet destructive actions" },
  {
    token: "surface-field",
    className: "surface-field text-g-400",
    label: "Search stocks",
    use: "Inputs and chips at rest"
  },
  {
    token: "surface-well",
    className: "surface-well text-g-600",
    label: "$180 of $250",
    use: "Meters, code, grouped rows"
  }
] as const

const RADII = [
  { token: "xs", px: 6, className: "rounded-xs", use: "Badges, keys" },
  { token: "sm", px: 8, className: "rounded-sm", use: "Small buttons" },
  { token: "md", px: 10, className: "rounded-md", use: "Buttons, inputs" },
  { token: "lg", px: 14, className: "rounded-lg", use: "Cards, tables" },
  { token: "xl", px: 18, className: "rounded-xl", use: "Sheets, large tiles" },
  { token: "2xl", px: 24, className: "rounded-2xl", use: "Dialogs, hero art" }
] as const

const MOTION = [
  { token: "duration-fast", value: "120 ms", use: "Hovers, presses, color" },
  { token: "duration-base", value: "200 ms", use: "Popovers, toggles, thumbs" },
  { token: "duration-slow", value: "320 ms", use: "Sheets, progress, page parts" },
  { token: "ease-brand", value: "cubic-bezier(.2, .8, .2, 1)", use: "Everything that enters or moves" },
  { token: "ease-brand-in", value: "cubic-bezier(.4, 0, 1, 1)", use: "Exits" },
  { token: "ease-spring", value: "cubic-bezier(.34, 1.56, .64, 1)", use: "Checks and dots that pop in" }
] as const

/* ---------- Page scaffolding ---------- */

function Section(
  { title, purpose, children }: { readonly title: string; readonly purpose: string; readonly children: ReactNode }
) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-4 border-t border-ink/7 pt-9 pb-10">
      <header>
        <h2 id={id} className="text-[19px] leading-tight font-semibold tracking-[-0.02em]">{title}</h2>
        <p className="mt-1 max-w-[64ch] text-body-sm text-g-600">{purpose}</p>
      </header>
      {children}
    </section>
  )
}

const Token = ({ children }: { readonly children: ReactNode }) => (
  <code className="w-fit rounded-[5px] bg-white px-1.5 py-px font-mono text-[11.5px] text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-200)]">
    {children}
  </code>
)

function SwatchGrid({ swatches }: { readonly swatches: ReadonlyArray<Swatch> }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {swatches.map((swatch) => (
        <li key={swatch.token} className="grid content-start gap-2 rounded-lg bg-white p-2 pb-3 shadow-e1">
          <span className={cn("h-16 rounded-md shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]", swatch.className)} />
          <div className="grid gap-0.5 px-1">
            <span className="text-label font-semibold">{swatch.token}</span>
            <span className="font-mono text-caption-sm text-g-500 uppercase">{swatch.hex}</span>
            {swatch.note && <span className="text-caption text-g-500">{swatch.note}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}

const Subhead = ({ children }: { readonly children: ReactNode }) => (
  <h3 className="mt-2 text-[11.5px] font-semibold tracking-[.06em] text-g-500 uppercase">{children}</h3>
)

/* ---------- Page ---------- */

function KitFoundations() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3 pb-10">
        <span className="text-label font-medium text-blue">Foundations</span>
        <h1 className="text-display-3 font-semibold">Tokens</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          The colors, type, depth, radii and motion every component is built from. Use these names in Tailwind classes
          (<Token>bg-blue</Token>, <Token>text-label</Token>, <Token>shadow-e2</Token>); there is no other palette.
        </p>
      </div>
      <ColorSection />
      <TypeSection />
      <DepthSection />
      <SurfaceSection />
      <RadiusSection />
      <FocusSection />
      <MotionSection />
    </div>
  )
}

function ColorSection() {
  return (
    <Section
      title="Color"
      purpose="Base Blue leads; neutrals carry the interface. Semantic colors pass AA on white and on their own wash."
    >
      <Subhead>Brand</Subhead>
      <SwatchGrid swatches={BRAND} />
      <Subhead>Neutrals</Subhead>
      <SwatchGrid swatches={NEUTRALS} />
      <Subhead>Semantic · text, wash, line</Subhead>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
        {SEMANTIC.map((group) => (
          <li key={group.name} className="grid gap-3 rounded-lg bg-white p-3 shadow-e1">
            <div className="flex h-16 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]">
              {group.swatches.map((swatch) => <span key={swatch.token} className={cn("flex-1", swatch.className)} />)}
            </div>
            <div className="grid gap-1">
              <span className="text-label font-semibold">{group.name}</span>
              <span className="text-caption text-g-500">{group.use}</span>
              <span className="flex flex-wrap gap-1">
                {group.swatches.map((swatch) => <Token key={swatch.token}>{swatch.token}</Token>)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <Subhead>Chart series, in order</Subhead>
      <SwatchGrid swatches={SERIES} />
    </Section>
  )
}

function TypeSection() {
  return (
    <Section
      title="Type"
      purpose="Inter for everything, Doto only for tickers. Tight headings, tabular numbers, short lines."
    >
      <div className="grid divide-y divide-g-100 rounded-lg bg-white px-5 shadow-e1">
        {TYPE_SCALE.map((step) => (
          <div key={step.token} className="grid items-baseline gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6">
            <div className="grid gap-0.5">
              <Token>text-{step.token}</Token>
              <span className="text-caption text-g-400 tabular-nums">{step.spec}</span>
            </div>
            <p className={cn("min-w-0 truncate text-ink", step.className)}>{step.sample}</p>
          </div>
        ))}
        <div className="grid items-baseline gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6">
          <Token>font-pixel</Token>
          <p className="font-pixel text-title-2 font-extrabold tracking-[.05em] text-blue">NVDA AAPL TSLA</p>
        </div>
      </div>
    </Section>
  )
}

function DepthSection() {
  return (
    <Section title="Depth" purpose="Soft, layered shadows instead of borders. Higher levels float over lower ones.">
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-5 rounded-lg bg-sunken p-6 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]">
        {DEPTH.map((level) => (
          <li
            key={level.token}
            className={cn("grid min-h-28 content-end gap-1 rounded-lg bg-white p-4", level.className)}
          >
            <Token>shadow-{level.token}</Token>
            <span className="text-caption text-g-500">{level.use}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function SurfaceSection() {
  return (
    <Section
      title="Surfaces"
      purpose="The depth language as utilities: a gradient, a lit top edge and a soft drop, shared by buttons, fields and chips."
    >
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
        {SURFACES.map((surface) => (
          <li key={surface.token} className="grid gap-3 rounded-lg bg-white p-4 shadow-e1">
            <span
              className={cn(
                "flex h-[38px] items-center justify-center rounded-md px-3 text-body-sm font-[550]",
                surface.className
              )}
            >
              {surface.label}
            </span>
            <div className="grid gap-1">
              <Token>{surface.token}</Token>
              <span className="text-caption text-g-500">{surface.use}</span>
            </div>
          </li>
        ))}
        <li className="grid gap-3 rounded-lg bg-white p-4 shadow-e1">
          <div className="relative h-[38px] overflow-hidden rounded-md bg-[linear-gradient(110deg,var(--color-blue)_0%,var(--color-cerulean)_45%,var(--color-lime)_100%)]">
            <span className="absolute inset-x-2 inset-y-1.5 flex items-center justify-center rounded-sm surface-glass text-label font-[550]">
              Portfolio
            </span>
          </div>
          <div className="grid gap-1">
            <Token>surface-glass</Token>
            <span className="text-caption text-g-500">Sticky bars, cards over art</span>
          </div>
        </li>
      </ul>
    </Section>
  )
}

function RadiusSection() {
  return (
    <Section title="Radius" purpose="Rounder as things get bigger. Nested corners step down one size.">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
        {RADII.map((radius) => (
          <li key={radius.token} className="grid justify-items-start gap-2 rounded-lg bg-white p-4 shadow-e1">
            <span className={cn("size-16 bg-blue-50 shadow-[inset_0_0_0_1.5px_var(--color-blue)]", radius.className)} />
            <Token>rounded-{radius.token}</Token>
            <span className="text-caption text-g-500 tabular-nums">{radius.px} px · {radius.use}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function FocusSection() {
  return (
    <Section
      title="Focus ring"
      purpose="Every control shows where the keyboard is. Outlines for buttons and toggles, a soft ring for fields."
    >
      <div className="flex flex-wrap items-center gap-x-10 gap-y-6 rounded-lg bg-white p-7 shadow-e1">
        <div className="grid justify-items-start gap-2.5">
          <Button variant="secondary" className="outline-2 outline-offset-2 outline-blue">Edit limits</Button>
          <Token>outline 2px · offset 2px · blue</Token>
        </div>
        <div className="grid w-60 justify-items-start gap-2.5">
          <Input
            aria-label="Focused field sample"
            defaultValue="Rebalancer"
            tabIndex={-1}
            className="shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(42, 91, 255,.12)]"
          />
          <Token>fields · 1px blue + 4px halo</Token>
        </div>
        <div className="grid justify-items-start gap-2.5">
          <span className="grid h-[38px] w-40 place-items-center rounded-md bg-white text-body-sm text-g-600 ring-focus">
            Custom control
          </span>
          <Token>ring-focus</Token>
        </div>
      </div>
    </Section>
  )
}

function MotionSection() {
  return (
    <Section title="Motion" purpose="Quick and calm. Things ease out as they arrive and speed up as they leave.">
      <dl className="grid divide-y divide-g-100 rounded-lg bg-white px-5 shadow-e1">
        {MOTION.map((token) => (
          <div
            key={token.token}
            className="grid gap-1 py-3 sm:grid-cols-[180px_220px_minmax(0,1fr)] sm:items-center sm:gap-6"
          >
            <dt>
              <Token>{token.token}</Token>
            </dt>
            <dd className="font-mono text-caption text-g-600">{token.value}</dd>
            <dd className="text-label text-g-500">{token.use}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
