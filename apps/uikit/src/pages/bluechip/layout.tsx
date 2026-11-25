import { cn } from "@bluechip/ui/lib/cn"
import { type ReactNode, useId } from "react"

/* ---------- Page scaffolding (mirrors the brand kit's #product-ui layout) ---------- */

export function Group(
  { id, title, intro, children }: {
    readonly id: string
    readonly title: string
    readonly intro: string
    readonly children: ReactNode
  }
) {
  return (
    <div id={id} className="scroll-mt-6 pt-14">
      <div className="grid max-w-[760px] gap-2.5 pb-2">
        <h2 className="text-[clamp(26px,3.2vw,34px)] leading-[1.1] font-semibold tracking-[-0.035em]">{title}</h2>
        <p className="text-[15.5px] text-g-600">{intro}</p>
      </div>
      {children}
    </div>
  )
}

export function Section(
  { id, title, purpose, notes, states, children }: {
    readonly id: string
    readonly title: string
    readonly purpose: string
    readonly notes: ReadonlyArray<string>
    readonly states?: ReadonlyArray<readonly [string, ReactNode, boolean?]>
    readonly children: ReactNode
  }
) {
  const titleId = useId()
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="grid scroll-mt-6 gap-[18px] border-t border-ink/6 py-8 first-of-type:border-t-0 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10 lg:py-10"
    >
      <div className="grid content-start gap-2.5 lg:sticky lg:top-6">
        <h3 id={titleId} className="text-title-3 font-semibold">{title}</h3>
        <p className="text-body-sm text-g-600">{purpose}</p>
        <ul className="flex flex-wrap gap-x-3.5 gap-y-1 lg:grid lg:gap-1.5">
          {notes.map((note) => (
            <li
              key={note}
              className="relative pl-3.5 text-label-sm text-g-500 before:absolute before:top-[7px] before:left-0.5 before:size-[5px] before:rounded-[1.5px] before:bg-g-300"
            >
              {note}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid min-w-0 gap-3">
        <div
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] place-items-center rounded-xl px-3.5 py-5 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)] sm:p-8"
          style={{ background: STAGE }}
        >
          {children}
        </div>
        {states && states.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-2.5">
            {states.map(([label, content, wide]) => (
              <figure
                key={label}
                className={cn(
                  "m-0 grid min-w-0 content-start gap-3 rounded-lg bg-white px-3.5 pt-3 pb-4 shadow-e1",
                  wide && "col-span-full"
                )}
              >
                <figcaption className="text-[11.5px] font-semibold text-g-500">{label}</figcaption>
                <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-2.5">{content}</div>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export const card = "w-full rounded-lg bg-white shadow-e2"
const STAGE =
  "radial-gradient(circle at 1px 1px, rgba(10,11,13,.07) 1px, transparent 1.2px) 0 0 / 16px 16px, linear-gradient(180deg, #f7f8fa, #f3f4f7)"
