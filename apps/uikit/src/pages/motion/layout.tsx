import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { type ReactNode, type RefObject, useEffect, useState } from "react"
import type { Entry } from "./entries.ts"

/** True once the element has scrolled into view. */
export function useSeen(ref: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      setSeen(true)
      observer.disconnect()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return seen
}
export function Group({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="grid gap-3.5">
      <h3 className="text-body font-semibold text-g-700">{title}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,440px),1fr))] gap-4">{children}</div>
    </div>
  )
}

export function Card(
  { entry, stage, onReplay }: { readonly entry: Entry; readonly stage: ReactNode; readonly onReplay?: () => void }
) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg bg-white shadow-e2">
      <div className="relative grid h-[280px] place-items-center overflow-hidden border-b border-g-100 bg-white">
        {stage}
        {onReplay && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-3 right-3 z-[6]"
            aria-label={`Replay ${entry.name}`}
            onClick={onReplay}
          >
            <Icon name="refresh" size={14} />Replay
          </Button>
        )}
      </div>
      <div className="grid gap-2 px-5 pt-4 pb-5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-caption font-semibold text-blue tabular-nums">{String(entry.n).padStart(2, "0")}</span>
          <h4 className="text-body-lg font-semibold tracking-[-0.02em]">{entry.name}</h4>
        </div>
        <p className="text-body-sm text-g-600">{entry.used}</p>
        <dl className="mt-1.5 grid border-t border-g-100">
          {([["Duration", entry.duration], ["Easing", entry.easing], ["Reduced motion", entry.reduced]] as const).map((
            [term, value]
          ) => (
            <div
              key={term}
              className="grid grid-cols-[116px_1fr] gap-3 border-b border-g-100 py-[7px] text-label last:border-0 last:pb-0"
            >
              <dt className="font-medium text-g-500">{term}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  )
}
