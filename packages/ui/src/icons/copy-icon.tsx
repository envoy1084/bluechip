import { cn } from "../lib/cn.ts"
import { Icon } from "./icon.tsx"

const SWAP =
  "col-start-1 row-start-1 transition-[opacity,scale,filter] duration-base ease-brand motion-reduce:transition-none"

/** The copy glyph, which blurs into a plain check while `copied` is true. Color follows the text color. */
export function CopyIcon(
  { copied, size = 14, className }: Readonly<{ copied: boolean; size?: number; className?: string }>
) {
  return (
    <span aria-hidden className={cn("grid place-items-center", className)}>
      <Icon name="copy" size={size} className={cn(SWAP, copied && "scale-50 opacity-0 blur-[3px]")} />
      <Icon name="check" size={size} className={cn(SWAP, !copied && "scale-50 opacity-0 blur-[3px]")} />
    </span>
  )
}
