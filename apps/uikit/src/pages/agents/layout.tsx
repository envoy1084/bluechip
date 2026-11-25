import { cn } from "@bluechip/ui/lib/cn"
import { type ReactNode, useId } from "react"

export function Group(
  { n, title, children }: { readonly n: string; readonly title: string; readonly children: ReactNode }
) {
  return (
    <div className="pt-10">
      <div className="flex items-baseline gap-3.5 pb-2">
        <span className="text-label font-semibold text-blue">{n}</span>
        <h2 className="text-[clamp(24px,3vw,30px)] font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export function Section({ title, purpose, children }: {
  readonly title: string
  readonly purpose: string
  readonly children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-4 border-t border-ink/7 pt-9 pb-10">
      <header>
        <h3 id={id} className="text-[19px] leading-tight font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="mt-1 max-w-[64ch] text-body-sm text-g-600">{purpose}</p>
      </header>
      {children}
    </section>
  )
}

export function Demo({ label, className, children }: {
  readonly label?: string
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-wrap items-center gap-3.5 rounded-lg bg-white p-4 shadow-e1 sm:p-7",
        label && "pt-[42px] sm:pt-12",
        className
      )}
    >
      {label && <span className="absolute top-3.5 left-4 text-[11.5px] font-[550] text-g-500">{label}</span>}
      {children}
    </div>
  )
}

export function States({ children }: { readonly children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">{children}</div>
}
