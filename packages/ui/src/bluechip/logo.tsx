import { type ComponentProps, useId } from "react"
import { cn } from "../lib/cn.ts"

export interface LogoMarkProps extends Omit<ComponentProps<"svg">, "children"> {
  /** Width and height in CSS pixels. Defaults to 22. */
  readonly size?: number
}

/**
 * The rising chip: a disc with a rising line cut through it. It takes `currentColor` (Base Blue in the kit) and is
 * decorative; pair it with the wordmark or an accessible name.
 */
export function LogoMark({ size = 22, className, ...props }: LogoMarkProps) {
  const mask = useId()
  return (
    <svg
      data-slot="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className={cn("shrink-0 text-blue", className)}
      {...props}
    >
      <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <circle cx="32" cy="32" r="30" fill="#fff" />
        <polyline
          points="-2,48 22,32 32,40 66,12"
          fill="none"
          stroke="#000"
          strokeWidth="7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </mask>
      <rect width="64" height="64" fill="currentColor" mask={`url(#${mask})`} />
    </svg>
  )
}

export interface LogoProps extends ComponentProps<"span"> {
  /** Mark size in CSS pixels; the wordmark scales with it. Defaults to 22. */
  readonly size?: number
}

/** The lockup: the rising chip and the lowercase wordmark "bluechip". */
export function Logo({ size = 22, className, ...props }: LogoProps) {
  return (
    <span data-slot="logo" className={cn("inline-flex items-center gap-2 text-ink", className)} {...props}>
      <LogoMark size={size} />
      <span className="leading-none font-[650] tracking-[-0.045em]" style={{ fontSize: size * 0.82 }}>bluechip</span>
    </span>
  )
}
