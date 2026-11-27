import { LogoMark } from "@bluechip/ui/bluechip/logo"
import { cn } from "@bluechip/ui/lib/cn"
import { Capture } from "./frame.tsx"

const BLUE_TILE =
  "bg-[radial-gradient(120%_120%_at_30%_15%,var(--color-blue-hi)_0%,var(--color-blue)_48%,var(--color-blue-deep)_100%)]"

/**
 * The rising chip in white on a blue tile. `bleed` fills the square (iOS and maskable icons, which the platform
 * shapes); otherwise it is a rounded tile on a transparent square. `mark` is the chip's share of the side.
 */
function AppIcon(
  { capture, size, bleed, mark }: Readonly<{ capture: string; size: number; bleed: boolean; mark: number }>
) {
  return (
    <Capture capture={capture} width={size} height={size} className="grid place-items-center bg-transparent">
      <span
        className={cn("grid size-full place-items-center", BLUE_TILE)}
        style={bleed ? undefined : {
          width: size * 0.86,
          height: size * 0.86,
          borderRadius: size * 0.2,
          boxShadow: `inset 0 ${size / 96}px 0 rgba(255,255,255,.25)`
        }}
      >
        <LogoMark size={Math.round(size * mark)} className="text-white" />
      </span>
    </Capture>
  )
}

/** The favicon's sizes for `favicon.ico`: the blue chip alone, on a transparent square. */
function FaviconPng({ size }: Readonly<{ size: number }>) {
  return (
    <Capture capture={`favicon-${size}`} width={size} height={size} className="grid place-items-center bg-transparent">
      <LogoMark size={size} />
    </Capture>
  )
}

/** Every icon the web app links: the manifest's, Apple's touch icon and the favicon's sizes. */
export function AppIcons() {
  return (
    <div className="flex flex-wrap items-end gap-6">
      <AppIcon capture="icon-512" size={512} bleed={false} mark={0.5} />
      <AppIcon capture="icon-maskable-512" size={512} bleed mark={0.46} />
      <AppIcon capture="icon-192" size={192} bleed={false} mark={0.5} />
      <AppIcon capture="apple-touch-icon" size={180} bleed mark={0.56} />
      {[48, 32, 16].map((size) => <FaviconPng key={size} size={size} />)}
    </div>
  )
}
