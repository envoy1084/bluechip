import { Halftone } from "@bluechip/ui/motion/halftone"
import { createFileRoute } from "@tanstack/react-router"
import { REDUCED, SCENES } from "../pages/motion/entries.ts"
import { HapticsCard, MomentCard, MorphCard, SkeletonCard } from "../pages/motion/feel.tsx"
import { RollCard, ScrambleCard } from "../pages/motion/interface.tsx"
import { Group } from "../pages/motion/layout.tsx"
import { AssembleCard, ConfettiCard, GridCard, SceneCard, SealCard, WarpCard } from "../pages/motion/pixel.tsx"

export const Route = createFileRoute("/motion")({ component: KitMotion })

function KitMotion() {
  return (
    <div className="mx-auto grid max-w-6xl gap-14 px-4 py-12 md:px-10">
      <section className="grid gap-8">
        <div className="grid gap-3">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Motion</span>
          <h1 className="text-display-3 font-semibold">Quiet motion, one moment at a time.</h1>
          <p className="max-w-[64ch] text-body-lg text-g-600">
            bluechip moves like printed matter coming alive: line-halftone scenes, pixels that land with weight, numbers
            that roll. Calm by default, so the moments that matter, a limit holding or Face ID approving, are the ones
            you notice.
          </p>
        </div>
        <div className="relative h-[380px] overflow-hidden rounded-2xl bg-white shadow-e2">
          <Halftone scene="logo" cell={10} className="absolute inset-0 size-full" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#fff_0%,rgba(255,255,255,0)_34%,rgba(255,255,255,0)_66%,#fff_100%)]" />
          <div className="absolute bottom-4 left-4 grid max-w-[300px] gap-1.5 rounded-md bg-white/90 px-3.5 py-3 shadow-e1 backdrop-blur-sm">
            <span className="text-caption-sm font-semibold tracking-[.06em] text-g-500 uppercase">
              Rising chip · line halftone
            </span>
            <p className="text-label-sm text-g-600">
              Every cell is a vertical capsule. Four thicknesses, four inks, drawn from a greyscale scene. Move your
              pointer across it.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-2">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Library</span>
          <h2 className="text-title-1 font-semibold">Fourteen animations.</h2>
          <p className="max-w-[64ch] text-body text-g-600">
            Halftone scenes for ambient states, pixel moments for events, interface motion for data. Scenes pause when
            they leave the screen and render one still frame under reduced motion.
          </p>
        </div>
        <Group title="Halftone scenes">
          {SCENES.map((entry) => <SceneCard key={entry.n} entry={entry} />)}
        </Group>
        <Group title="Pixel moments">
          <GridCard />
          <WarpCard />
          <SealCard />
          <AssembleCard />
          <ConfettiCard />
        </Group>
        <Group title="Interface motion">
          <RollCard />
          <ScrambleCard />
        </Group>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-2">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Feel</span>
          <h2 className="text-title-1 font-semibold">Small things that say it worked.</h2>
          <p className="max-w-[64ch] text-body text-g-600">
            Numbers roll, labels morph, loading takes the shape of what's coming, phones tap back, and three moments get
            a sweep. All from maintained libraries, tuned to the brand curves.
          </p>
        </div>
        <Group title="Feedback">
          <MorphCard />
          <SkeletonCard />
          <HapticsCard />
          <MomentCard />
        </Group>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-2">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Reduced motion</span>
          <h2 className="text-title-1 font-semibold">Still, never broken.</h2>
          <p className="max-w-[64ch] text-body text-g-600">
            When someone asks their device for reduced motion, every animation keeps its meaning without the movement.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg bg-white shadow-e2">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="bg-g-50 text-left text-caption font-semibold text-g-500">
                <th className="border-b border-g-100 px-[18px] py-3">Animation</th>
                <th className="border-b border-g-100 px-[18px] py-3">With reduced motion</th>
              </tr>
            </thead>
            <tbody>
              {REDUCED.map(([name, what]) => (
                <tr key={name} className="border-b border-g-100 last:border-0">
                  <td className="px-[18px] py-3 whitespace-nowrap text-ink">{name}</td>
                  <td className="px-[18px] py-3 text-g-600">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
