import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group"
import type { VariantProps } from "class-variance-authority"
import { type ComponentProps, createContext, use, useMemo } from "react"
import { cn } from "../lib/cn.ts"
import { Toggle, type toggleVariants } from "./toggle.tsx"

type ToggleStyle = VariantProps<typeof toggleVariants>

const ToggleGroupContext = createContext<ToggleStyle>({})

export interface ToggleGroupProps extends ComponentProps<typeof BaseToggleGroup>, ToggleStyle {}

/**
 * Pick one option (or several with `multiple`) from a short set. Arrow keys move between options. The value is
 * always an array of the pressed items' values.
 */
export function ToggleGroup({ variant, size, className, ...props }: ToggleGroupProps) {
  const style = useMemo(() => ({ variant, size }), [variant, size])
  return (
    <ToggleGroupContext value={style}>
      <BaseToggleGroup
        data-slot="toggle-group"
        data-variant={variant ?? "default"}
        className={cn(
          "inline-flex max-w-full overflow-x-auto [scrollbar-width:none]",
          variant === "outline" ?
            "gap-1.5" :
            "gap-0.5 rounded-[11px] bg-g-100 p-[3px] shadow-[inset_0_0_0_1px_rgba(10,11,13,.04)]",
          "data-[orientation=vertical]:flex-col",
          className
        )}
        {...props}
      />
    </ToggleGroupContext>
  )
}

/** One option of a `ToggleGroup`; `value` identifies it. */
export function ToggleGroupItem({ variant, size, className, ...props }: ComponentProps<typeof Toggle>) {
  const group = use(ToggleGroupContext)
  const groupVariant = variant ?? group.variant
  return (
    <Toggle
      data-slot="toggle-group-item"
      variant={groupVariant}
      size={size ?? group.size}
      className={cn(
        groupVariant === "outline" ?
          "hover:not-data-pressed:bg-g-50" :
          "hover:not-data-pressed:bg-white/60",
        className
      )}
      {...props}
    />
  )
}
