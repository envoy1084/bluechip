// The panel's building blocks, shared by every section: a titled group, a labelled row, a segmented choice and a
// list of records to pick from.
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import { useSyncExternalStore } from "react"
import { type PreviewStore, previewStore } from "../store.ts"

/** The store, re-rendering the component whenever the world or a setting changes. */
export const usePreview = (): PreviewStore => {
  const store = previewStore()
  useSyncExternalStore(store.subscribe, store.version)
  return store
}

/** A titled group of controls. */
export function Group({ title, hint, children }: Readonly<{ title: string; hint?: string; children: ReactNode }>) {
  return (
    <section className="grid gap-2.5 border-b border-g-100 px-4 py-4 last:border-b-0">
      <div className="grid gap-0.5">
        <h3 className="text-[12px] font-semibold tracking-[0.04em] text-g-500 uppercase">{title}</h3>
        {hint === undefined ? null : <p className="text-[12px] leading-snug text-g-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** One labelled control in a row. */
export function Row({ label, children }: Readonly<{ label: ReactNode; children: ReactNode }>) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[12.5px] font-medium text-g-700">{label}</span>
      {children}
    </div>
  )
}

/** A choice of a few options, one pressed. */
export function Segmented<A extends string>(
  { value, options, onChange }: Readonly<{
    value: A
    options: ReadonlyArray<{ readonly value: A; readonly label: string }>
    onChange: (value: A) => void
  }>
) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[9px] bg-g-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 cursor-pointer rounded-[7px] px-2 py-1 text-[12px] font-medium whitespace-nowrap text-g-600 transition-colors",
            option.value === value ? "bg-white text-ink shadow-e1" : "hover:text-ink"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** A native select, styled small. */
export function Pick<A extends string>(
  { value, options, onChange, label }: Readonly<{
    value: A
    options: ReadonlyArray<{ readonly value: A; readonly label: string }>
    onChange: (value: A) => void
    label: string
  }>
) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as A)}
      className="h-8 w-full cursor-pointer rounded-[8px] bg-white px-2 text-[12.5px] shadow-[inset_0_0_0_1px_var(--color-g-200)]"
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

/** A small action button. */
export function Act(
  { children, onClick, tone = "default" }: Readonly<{
    children: ReactNode
    onClick: () => void
    tone?: "default" | "danger"
  }>
) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium shadow-[inset_0_0_0_1px_var(--color-g-200)] transition-colors",
        tone === "danger" ? "text-loss hover:bg-loss-wash" : "text-ink hover:bg-g-50"
      )}
    >
      {children}
    </button>
  )
}
