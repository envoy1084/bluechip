import { Logo } from "@bluechip/ui/bluechip/logo"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"

/** Open Graph's size: what every link preview crops to. */
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/**
 * One image at its real pixel size. `capture` names the file `node scripts/bin.ts og` writes it to, under
 * `apps/web/public/`.
 */
export function Capture(
  { capture, width, height, className, children }: Readonly<{
    capture: string
    width: number
    height: number
    className?: string | undefined
    children: ReactNode
  }>
) {
  return (
    <div
      data-capture={capture}
      className={cn("relative isolate shrink-0 overflow-hidden bg-white font-sans text-ink", className)}
      style={{ width, height }}
    >
      {children}
    </div>
  )
}

/** A 1200×630 link preview. */
export function OgFrame(
  { capture, className, children }: Readonly<{ capture: string; className?: string; children: ReactNode }>
) {
  return <Capture capture={capture} width={OG_WIDTH} height={OG_HEIGHT} className={className}>{children}</Capture>
}

/** The lockup at link preview size. */
export function Lockup({ size = 40 }: Readonly<{ size?: number }>) {
  return <Logo size={size} className="gap-3" />
}

/** A section's name over its headline, as the landing's section intros. */
export function Kicker({ icon, children }: Readonly<{ icon: IconName; children: ReactNode }>) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[26px] font-semibold tracking-[-0.02em] text-blue">
      <Icon name={icon} size={28} strokeWidth={2} />
      {children}
    </span>
  )
}

/** The big line of a card, the landing's display type at preview size. */
export function Headline({ className, children }: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <h2 className={cn("text-[76px] leading-[.98] font-semibold tracking-[-0.055em] text-balance", className)}>
      {children}
    </h2>
  )
}

/** The sentence under a headline. */
export function Lede({ className, children }: Readonly<{ className?: string; children: ReactNode }>) {
  return <p className={cn("text-[26px] leading-[1.38] tracking-[-0.015em] text-g-600", className)}>{children}</p>
}

/** A ticker chip at preview size: the kit's chip, scaled up as a whole. */
export function BigTicker({ symbol }: Readonly<{ symbol: string }>) {
  return <TickerChip symbol={symbol} className="rounded-[12px] px-4 pt-[11px] pb-[9px] text-[24px]" />
}
