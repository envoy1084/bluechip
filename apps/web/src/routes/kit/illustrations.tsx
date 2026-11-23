import {
  Illustration,
  ILLUSTRATION_NAMES,
  type IllustrationName,
  ILLUSTRATIONS
} from "@bluechip/ui/illustrations/illustration"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/kit/illustrations")({ component: KitIllustrations })

const SIZES: ReadonlyArray<readonly [number, string]> = [
  [24, "Inline with text, list rows, toasts"],
  [48, "Banners, small empty states, menu items"],
  [96, "Empty states, cards, the gallery tile"],
  [160, "Onboarding steps, sheets, success screens"],
  [240, "Heroes, the splash screen, social images"]
]
const RAMP: ReadonlyArray<IllustrationName> = ["rising-chip", "butterfly", "lock"]
const STRIP: ReadonlyArray<IllustrationName> = ["butterfly", "garden", "passkey", "scales", "moon", "paper-plane"]

function Heading(
  { kicker, title, intro }: { readonly kicker: string; readonly title: string; readonly intro?: string }
) {
  return (
    <div className="grid gap-2">
      <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">{kicker}</span>
      <h2 className="text-title-1 font-semibold">{title}</h2>
      {intro && <p className="max-w-[64ch] text-body text-g-600">{intro}</p>}
    </div>
  )
}

function KitIllustrations() {
  return (
    <div className="mx-auto grid max-w-6xl gap-14 px-4 py-12 md:px-10">
      <section className="grid gap-8">
        <div className="grid gap-3">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Illustrations</span>
          <h1 className="text-display-3 font-semibold">Small objects, drawn two ways.</h1>
          <p className="max-w-[64ch] text-body-lg text-g-600">
            Twenty-three objects for the moments that need more than an icon: an empty list, a first deposit, a trade
            your limits stopped. Each one is a single drawing that renders as crisp pixel art in the interface and as
            Base-style line halftone when it is large.
          </p>
        </div>
        <div className="grid overflow-hidden rounded-2xl bg-white shadow-e3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="grid min-h-[360px] place-items-center border-b border-[rgba(10,11,13,.06)] bg-[radial-gradient(120%_90%_at_30%_20%,#ffffff_0%,var(--color-blue-50)_70%,#eceffd_100%)] py-6 md:border-r md:border-b-0">
            <Illustration
              name="rising-chip"
              variant="halftone"
              size={340}
              cell={7}
              animate
              label="The rising chip in line halftone, with a gold glint running up its price line"
              className="w-[min(340px,86%)]!"
            />
          </div>
          <div className="grid content-center gap-7 p-5 md:p-8">
            <div className="grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
              <span className="inline-grid place-items-center justify-self-start rounded-xl bg-sunken p-2 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]">
                <Illustration name="rising-chip" size={160} />
              </span>
              <div>
                <span className="text-caption-sm font-semibold tracking-[.06em] text-g-500 uppercase">
                  Same drawing
                </span>
                <p className="mt-1.5 text-body-sm text-g-600">
                  The 20 × 20 pixel version and the halftone beside it come from one set of shapes, so the two styles
                  can never drift apart.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2" aria-label="A few objects from the set">
              {STRIP.map((name) => (
                <span
                  key={name}
                  className="grid aspect-square place-items-center rounded-md bg-[linear-gradient(180deg,#fff,var(--color-g-50))] shadow-e1"
                >
                  <Illustration name={name} size={48} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <Heading
          kicker="Gallery"
          title="The full set."
          intro="Pixel at 96 px, halftone at 184 px, the name to pass to <Illustration name>, and where each one appears in the product."
        />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,318px),1fr))] gap-4">
          {ILLUSTRATION_NAMES.map((name) => {
            const object = ILLUSTRATIONS[name]
            return (
              <article
                key={name}
                className="grid grid-rows-[auto_1fr] overflow-hidden rounded-lg bg-white shadow-e2 transition-[box-shadow,transform] duration-base ease-brand hover:-translate-y-px hover:shadow-e3"
              >
                <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2 border-b border-[rgba(10,11,13,.06)] bg-[linear-gradient(180deg,var(--color-g-50),#fff)] py-3 pr-3 pl-[18px]">
                  <span className="grid size-24 place-items-center rounded-lg bg-white shadow-e1">
                    <Illustration name={name} size={96} />
                  </span>
                  <span className="grid min-w-0 place-items-center">
                    <Illustration name={name} variant="halftone" size={184} label={`${object.label}, halftone`} />
                  </span>
                </div>
                <div className="grid content-start gap-1.5 px-[18px] pt-3.5 pb-4">
                  <div className="flex items-center justify-between gap-2.5">
                    <h3 className="text-body font-semibold tracking-[-0.015em]">{object.label}</h3>
                    <code className="rounded-xs bg-g-100 px-1.5 py-0.5 font-mono text-[11.5px] text-g-600">{name}</code>
                  </div>
                  <p className="text-label leading-[1.45] text-g-600">{object.usedFor}</p>
                  <div className="mt-1 flex gap-[3px]" aria-label="Halftone palette">
                    {object.palette.map((color) => (
                      <i
                        key={color}
                        title={color}
                        className="h-1.5 w-4 rounded-[3px] shadow-[inset_0_0_0_1px_rgba(10,11,13,.08)]"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6">
        <Heading
          kicker="Sizes"
          title="Five sizes, nothing in between."
          intro="Pick the size from the slot, not from the space left over. Pixel art keeps its grid at every step; the halftone keeps roughly thirty lines across, so it gets finer as it grows."
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {SIZES.map(([size, use]) => (
            <div key={size} className="grid gap-0.5 rounded-md bg-white px-3.5 py-3 shadow-e1">
              <b className="text-body tabular-nums">
                {size}
                <span className="font-medium text-g-400">px</span>
              </b>
              <span className="text-label-sm text-g-500">{use}</span>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg bg-white p-1 shadow-e2">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="text-caption font-semibold text-g-500">
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Object</span>
                </th>
                {SIZES.map(([size]) => <th key={size} scope="col" className="px-4 py-2.5">{size} px</th>)}
              </tr>
            </thead>
            <tbody>
              {RAMP.map((name) => (
                <tr key={name} className="border-t border-[rgba(10,11,13,.06)]">
                  <th scope="row" className="px-4 py-4 text-left text-body-sm font-semibold whitespace-nowrap">
                    {ILLUSTRATIONS[name].label}
                    <span className="block text-caption font-medium text-g-500">pixel</span>
                  </th>
                  {SIZES.map(([size]) => (
                    <td key={size} className="px-4 py-4 text-center align-bottom">
                      <Illustration name={name} size={size} className="inline-block" />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-[rgba(10,11,13,.06)] bg-[linear-gradient(180deg,var(--color-g-50),#fff)]">
                <th scope="row" className="px-4 py-4 text-left text-body-sm font-semibold whitespace-nowrap">
                  Rising chip
                  <span className="block text-caption font-medium text-g-500">halftone</span>
                </th>
                <td colSpan={2} className="px-4 py-4 text-center text-label text-g-500">Use pixel below 96</td>
                {[96, 160, 240].map((size) => (
                  <td key={size} className="px-4 py-4 text-center align-middle">
                    <Illustration
                      name="rising-chip"
                      variant="halftone"
                      size={size}
                      animate={false}
                      className="inline-block"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6">
        <Heading
          kicker="Style"
          title="Pixel when small, halftone when large."
          intro="Never put both styles in one composition. Under reduced motion every halftone renders as a still frame."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid justify-items-start gap-2 rounded-lg bg-white p-6 shadow-e2">
            <Illustration name="butterfly" size={96} />
            <span className="text-caption-sm font-semibold tracking-[.06em] text-g-500 uppercase">Pixel</span>
            <p className="text-label text-g-600">
              24 to 96 px. Inside the product: empty states, rows, toasts, banners. Always still.
            </p>
          </div>
          <div className="grid justify-items-start gap-2 rounded-lg bg-white p-6 shadow-e2">
            <Illustration name="butterfly" variant="halftone" size={160} animate />
            <span className="text-caption-sm font-semibold tracking-[.06em] text-g-500 uppercase">Halftone</span>
            <p className="text-label text-g-600">
              160 px and up. Heroes, onboarding, success, social. Still by default; may drift gently when it is the only
              motion on screen.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
