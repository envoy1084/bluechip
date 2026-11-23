import { cn } from "../lib/cn.ts"

export interface SpinnerProps {
  readonly size?: number
  readonly className?: string
  /** Announced to screen readers; omit when the surrounding control already says it is busy. */
  readonly label?: string
}

/** An indeterminate loading ring in the current text color. */
export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={cn("shrink-0 animate-spin", className)}
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
