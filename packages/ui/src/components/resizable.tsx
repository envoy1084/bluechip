import {
  type ComponentProps,
  createContext,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from "react"
import { cn } from "../lib/cn.ts"

interface ResizableContextValue {
  readonly direction: "horizontal" | "vertical"
  readonly size: number
  readonly minSize: number
  readonly maxSize: number
  readonly setSize: (size: number) => void
  readonly groupRef: RefObject<HTMLDivElement | null>
}

const ResizableContext = createContext<ResizableContextValue | null>(null)

const useResizable = (): ResizableContextValue => {
  const context = useContext(ResizableContext)
  if (!context) throw new Error("ResizableHandle must be used inside a ResizablePanelGroup.")
  return context
}

const KEYBOARD_STEP = 5

export interface ResizablePanelGroupProps extends Omit<ComponentProps<"div">, "dir"> {
  readonly direction?: "horizontal" | "vertical"
  /** The first panel's starting size, in percent of the group. */
  readonly defaultSize?: number
  readonly minSize?: number
  readonly maxSize?: number
  readonly onSizeChange?: (size: number) => void
}

/**
 * Two panels split by a handle you drag, or move with the arrow keys (5% a press, Home and End for the limits).
 * The first `ResizablePanel` takes the size; the second fills the rest.
 */
export function ResizablePanelGroup(
  {
    direction = "horizontal",
    defaultSize = 50,
    minSize = 20,
    maxSize = 80,
    onSizeChange,
    className,
    style,
    ...props
  }: ResizablePanelGroupProps
) {
  const groupRef = useRef<HTMLDivElement>(null)
  const [size, setSizeState] = useState(defaultSize)
  const setSize = useCallback((next: number) => {
    const clamped = Math.round(Math.min(maxSize, Math.max(minSize, next)))
    setSizeState(clamped)
    onSizeChange?.(clamped)
  }, [minSize, maxSize, onSizeChange])
  const context = useMemo(
    () => ({ direction, size, minSize, maxSize, setSize, groupRef }),
    [direction, size, minSize, maxSize, setSize]
  )
  return (
    <ResizableContext value={context}>
      <div
        ref={groupRef}
        data-slot="resizable-panel-group"
        data-direction={direction}
        style={{ "--resizable-size": `${size}%`, ...style } as CSSProperties}
        className={cn(
          "flex min-h-0 data-[direction=vertical]:flex-col",
          "[&>[data-slot=resizable-panel]:first-child]:shrink-0 [&>[data-slot=resizable-panel]:first-child]:grow-0 [&>[data-slot=resizable-panel]:first-child]:basis-(--resizable-size)",
          className
        )}
        {...props}
      />
    </ResizableContext>
  )
}

export function ResizablePanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="resizable-panel"
      className={cn("min-h-0 min-w-0 flex-1 overflow-hidden", className)}
      {...props}
    />
  )
}

export interface ResizableHandleProps extends ComponentProps<"div"> {
  /** Shows the grip in the middle of the line. */
  readonly withHandle?: boolean
}

export function ResizableHandle({ withHandle = true, className, ...props }: ResizableHandleProps) {
  const { direction, size, minSize, maxSize, setSize, groupRef } = useResizable()
  const [dragging, setDragging] = useState(false)
  const horizontal = direction === "horizontal"

  const resizeTo = (event: PointerEvent<HTMLDivElement>) => {
    const rect = groupRef.current?.getBoundingClientRect()
    if (!rect) return
    setSize(
      horizontal ? ((event.clientX - rect.left) / rect.width) * 100 : ((event.clientY - rect.top) / rect.height) * 100
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = {
      [horizontal ? "ArrowLeft" : "ArrowUp"]: -KEYBOARD_STEP,
      [horizontal ? "ArrowRight" : "ArrowDown"]: KEYBOARD_STEP
    }[event.key]
    if (step !== undefined) setSize(size + step)
    else if (event.key === "Home") setSize(minSize)
    else if (event.key === "End") setSize(maxSize)
    else return
    event.preventDefault()
  }

  return (
    <div
      data-slot="resizable-handle"
      // A focusable window splitter (WAI-ARIA separator with a value) holds the grip, which an <hr> cannot.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuenow={size}
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      data-dragging={dragging || undefined}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={(event) => dragging && resizeTo(event)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={onKeyDown}
      className={cn(
        "group/handle relative grid flex-none touch-none place-items-center bg-g-100 outline-none transition-colors duration-fast ease-brand",
        "hover:bg-blue focus-visible:bg-blue data-dragging:bg-blue",
        "before:absolute before:-inset-1.5 before:content-['']",
        horizontal ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
        className
      )}
      {...props}
    >
      {withHandle && (
        <i
          className={cn(
            "relative z-1 rounded-[4px] bg-white shadow-[0_0_0_1px_var(--color-g-200),0_1px_2px_rgba(10,11,13,.08)] group-focus-visible/handle:shadow-[0_0_0_2px_var(--color-blue)]",
            horizontal ? "h-[26px] w-2" : "h-2 w-[26px]"
          )}
        />
      )}
    </div>
  )
}
