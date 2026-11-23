import { Popover as BasePopover } from "@base-ui/react/popover"
import { cn } from "../lib/cn.ts"

/** The pop-in shared by anchored panels: scales from the anchor, exits faster than it enters. */
export const popMotionClassName = cn(
  "origin-(--transform-origin) transition-[opacity,scale] duration-base ease-brand",
  "data-starting-style:scale-96 data-starting-style:opacity-0",
  "data-ending-style:scale-97 data-ending-style:opacity-0 data-ending-style:duration-fast data-ending-style:ease-brand-in"
)

/** Rich content anchored to a trigger: a short explainer or a small form. Not modal. */
export function Popover(props: BasePopover.Root.Props) {
  return <BasePopover.Root {...props} />
}

export function PopoverTrigger(props: BasePopover.Trigger.Props) {
  return <BasePopover.Trigger data-slot="popover-trigger" {...props} />
}

export function PopoverClose(props: BasePopover.Close.Props) {
  return <BasePopover.Close data-slot="popover-close" {...props} />
}

export interface PopoverContentProps
  extends BasePopover.Popup.Props, Pick<BasePopover.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset">
{}

export function PopoverContent(
  { className, side = "bottom", align = "start", sideOffset = 6, alignOffset = 0, ...props }: PopoverContentProps
) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={8}
        className="z-50"
      >
        <BasePopover.Popup
          data-slot="popover-content"
          className={cn(
            "grid w-[300px] max-w-[calc(100vw-16px)] gap-3 rounded-lg bg-white p-4 text-body-sm shadow-e3 outline-none",
            popMotionClassName,
            className
          )}
          {...props}
        />
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}

export function PopoverTitle({ className, ...props }: BasePopover.Title.Props) {
  return (
    <BasePopover.Title
      data-slot="popover-title"
      className={cn("flex items-center gap-2.5 text-[14.5px] font-semibold", className)}
      {...props}
    />
  )
}

export function PopoverDescription({ className, ...props }: BasePopover.Description.Props) {
  return (
    <BasePopover.Description
      data-slot="popover-description"
      className={cn("text-[13.5px] leading-normal text-g-600", className)}
      {...props}
    />
  )
}
