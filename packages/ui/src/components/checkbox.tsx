import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"
import { haptic } from "../lib/haptics.ts"

/** Turns an option on or off. Pass `indeterminate` on a parent whose children are only partly on. */
export function Checkbox({ className, onCheckedChange, ...props }: ComponentProps<typeof BaseCheckbox.Root>) {
  return (
    <BaseCheckbox.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[5px] p-0",
        "bg-[linear-gradient(180deg,#fff,#f6f7f9)] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.2),0_1px_2px_rgba(10,11,13,.05)]",
        "transition-[background,box-shadow] duration-fast ease-brand",
        "hover:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.32),0_1px_2px_rgba(10,11,13,.05)]",
        "data-checked:bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] data-checked:shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_0_0_1px_#1d47dc,0_1px_2px_rgba(20,50,160,.18)]",
        "data-indeterminate:bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] data-indeterminate:shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_0_0_1px_#1d47dc,0_1px_2px_rgba(20,50,160,.18)]",
        "aria-[invalid=true]:shadow-[0_0_0_1px_var(--color-loss),0_0_0_3px_rgba(217,58,28,.12)] data-invalid:shadow-[0_0_0_1px_var(--color-loss),0_0_0_3px_rgba(217,58,28,.12)]",
        "data-disabled:cursor-not-allowed data-disabled:opacity-45 data-disabled:grayscale",
        className
      )}
      onCheckedChange={(checked, details) => {
        haptic("select")
        onCheckedChange?.(checked, details)
      }}
      {...props}
    >
      <BaseCheckbox.Indicator
        keepMounted
        className="pointer-events-none absolute inset-0 grid place-items-center text-white opacity-0 transition-[opacity,scale] duration-base ease-spring scale-60 data-checked:scale-100 data-checked:opacity-100 data-indeterminate:scale-100 data-indeterminate:opacity-100"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="size-3.5 fill-none stroke-current stroke-[2.2] group-data-indeterminate/checkbox:hidden [stroke-linecap:round] [stroke-linejoin:round]"
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="hidden size-3.5 fill-none stroke-current stroke-[2.2] group-data-indeterminate/checkbox:block [stroke-linecap:round]"
        >
          <path d="M4 8h8" />
        </svg>
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}
