import { Spinner } from "@bluechip/ui/components/spinner"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { Halftone } from "@bluechip/ui/motion/halftone"
import type { ReactNode } from "react"
import type { Landing } from "../hooks/useLanding.ts"

const STATUS: Readonly<Record<Exclude<Landing, "landed">, { readonly label: string; readonly tone: string }>> = {
  sending: {
    label: "Locking on Base…",
    tone: "bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]"
  },
  failed: {
    label: "Not locked",
    tone: "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]"
  }
}

/** A lock or change of limits on its way to Base, or the one that didn't make it, with what to do next. */
export function LandingCard(
  { landing, title, children }: Readonly<{ landing: Exclude<Landing, "landed">; title: string; children: ReactNode }>
) {
  const status = STATUS[landing]

  return (
    <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-lg bg-white shadow-e3">
      <div className="relative h-[230px] border-b border-g-100 bg-[linear-gradient(180deg,#fbfdf6,#fff)] max-sm:h-[180px]">
        <Halftone scene="garden" className="absolute inset-0 size-full" />
      </div>
      <div className="grid justify-items-center gap-2.5 px-6 pt-5 pb-6 text-center">
        <output
          className={cn(
            "inline-flex items-center gap-2 rounded-full py-1 pr-[11px] pl-[9px] text-[12.5px] font-semibold",
            status.tone
          )}
        >
          {landing === "sending" ? <Spinner size={14} /> : <Icon name="error" size={14} />}
          {status.label}
        </output>
        <h3 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
        {children}
      </div>
    </div>
  )
}
