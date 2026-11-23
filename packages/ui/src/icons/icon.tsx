import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../lib/cn.ts"
import { type IconName, icons } from "./names.ts"

export type { IconName }

export interface IconProps {
  readonly name: IconName
  /** Pixel size: 16 in dense UI, 20 by default, 24 for emphasis. */
  readonly size?: 16 | 20 | 24 | number
  readonly strokeWidth?: number
  readonly className?: string
  /** Accessible label. Without one the icon is decorative and hidden from screen readers. */
  readonly label?: string
}

/** A Hugeicons glyph by bluechip's icon name. Color follows the text color. */
export function Icon({ name, size = 20, strokeWidth = 1.5, className, label }: IconProps) {
  return (
    <HugeiconsIcon
      icon={icons[name]}
      size={size}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  )
}
