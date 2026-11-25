import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react"
import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { useReducedMotion } from "../motion/use-reduced-motion.ts"
import { Button, type ButtonProps } from "./button.tsx"

export type CarouselApi = NonNullable<UseEmblaCarouselType[1]>
type CarouselOptions = NonNullable<Parameters<typeof useEmblaCarousel>[0]>
type CarouselPlugins = NonNullable<Parameters<typeof useEmblaCarousel>[1]>

interface CarouselContextValue {
  readonly viewportRef: UseEmblaCarouselType[0]
  readonly orientation: "horizontal" | "vertical"
  /** The selected snap: the first slide in view. */
  readonly index: number
  /** One per position the carousel can rest at (fewer than slides when several are in view). */
  readonly snaps: ReadonlyArray<number>
  readonly canScrollPrev: boolean
  readonly canScrollNext: boolean
  readonly scrollTo: (index: number) => void
  readonly scrollPrev: () => void
  readonly scrollNext: () => void
}

const CarouselContext = createContext<CarouselContextValue | null>(null)

const useCarousel = (): CarouselContextValue => {
  const context = useContext(CarouselContext)
  if (!context) throw new Error("Carousel parts must be used inside a Carousel.")
  return context
}

/** Which way a key pages a carousel of this orientation: its two arrow keys move it, every other key doesn't. */
export const carouselKeyDirection = (
  orientation: "horizontal" | "vertical",
  key: string
): "previous" | "next" | undefined => {
  const [back, forward] = orientation === "horizontal" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"]
  if (key === forward) return "next"
  if (key === back) return "previous"
  return undefined
}

export interface CarouselProps extends ComponentProps<"section"> {
  /** Embla options: `align` (`"start"` by default), `loop`, `slidesToScroll`, … */
  readonly opts?: CarouselOptions
  readonly plugins?: CarouselPlugins
  readonly orientation?: "horizontal" | "vertical"
  /** Receives the Embla API once the carousel is ready, for controls outside it. */
  readonly setApi?: (api: CarouselApi) => void
}

/**
 * A row of cards you page through with arrows, dots, the arrow keys, or by dragging and swiping. Embla does the
 * moving; with reduced motion, every control jumps instead of sliding.
 */
export function Carousel(
  { opts, plugins, orientation = "horizontal", setApi, className, children, onKeyDown, ...props }: CarouselProps
) {
  const [viewportRef, api] = useEmblaCarousel(
    { align: "start", ...opts, axis: orientation === "horizontal" ? "x" : "y" },
    plugins
  )
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [snaps, setSnaps] = useState<ReadonlyArray<number>>([])
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  useEffect(() => {
    if (!api) return
    setApi?.(api)
    const sync = (carousel: CarouselApi) => {
      setIndex(carousel.selectedScrollSnap())
      setSnaps(carousel.scrollSnapList())
      setCanScrollPrev(carousel.canScrollPrev())
      setCanScrollNext(carousel.canScrollNext())
    }
    sync(api)
    api.on("select", sync).on("reInit", sync)
    return () => {
      api.off("select", sync).off("reInit", sync)
    }
  }, [api, setApi])

  // `jump` skips the slide animation.
  const scrollTo = useCallback((target: number) => api?.scrollTo(target, reduced), [api, reduced])
  const scrollPrev = useCallback(() => api?.scrollPrev(reduced), [api, reduced])
  const scrollNext = useCallback(() => api?.scrollNext(reduced), [api, reduced])

  const context = useMemo(
    () => ({ viewportRef, orientation, index, snaps, canScrollPrev, canScrollNext, scrollTo, scrollPrev, scrollNext }),
    [viewportRef, orientation, index, snaps, canScrollPrev, canScrollNext, scrollTo, scrollPrev, scrollNext]
  )

  const onArrowKey = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event)
    const direction = carouselKeyDirection(orientation, event.key)
    if (direction === undefined) return
    if ((event.target as HTMLElement).closest("input, textarea, [role=slider]")) return
    event.preventDefault()
    if (direction === "next") scrollNext()
    else scrollPrev()
  }

  return (
    <CarouselContext value={context}>
      {/* The APG carousel: a focusable region that pages with the arrow keys. */}
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <section
        data-slot="carousel"
        aria-roledescription="carousel"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onKeyDown={onArrowKey}
        className={cn("grid gap-3.5 rounded-lg outline-none focus-visible:ring-focus", className)}
        {...props}
      >
        {children}
      </section>
    </CarouselContext>
  )
}

/** The moving track. Children are `CarouselItem`s. */
export function CarouselContent({ className, ...props }: ComponentProps<"div">) {
  const { viewportRef, orientation } = useCarousel()
  return (
    // Clip like `overflow: hidden`, but leave room for the slides' shadows.
    <div ref={viewportRef} data-slot="carousel-viewport" className="overflow-clip [overflow-clip-margin:6px]">
      <div
        data-slot="carousel-content"
        className={cn("flex", orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col", className)}
        {...props}
      />
    </div>
  )
}

/** One slide: a full row on phones, half from 600 px, a third from 1100 px. */
export function CarouselItem({ className, ...props }: ComponentProps<"div">) {
  const { orientation } = useCarousel()
  return (
    <div
      data-slot="carousel-item"
      // APG carousel slides are groups with the "slide" role description.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full min-[600px]:basis-1/2 min-[1100px]:basis-1/3",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className
      )}
      {...props}
    />
  )
}

export function CarouselPrevious(props: ButtonProps) {
  const { canScrollPrev, scrollPrev } = useCarousel()
  return (
    <Button
      data-slot="carousel-previous"
      variant="secondary"
      size="icon-sm"
      aria-label="Previous"
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <Icon name="arrow-left" size={16} />
    </Button>
  )
}

export function CarouselNext(props: ButtonProps) {
  const { canScrollNext, scrollNext } = useCarousel()
  return (
    <Button
      data-slot="carousel-next"
      variant="secondary"
      size="icon-sm"
      aria-label="Next"
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <Icon name="arrow-right" size={16} />
    </Button>
  )
}

/** One dot per position; the current one stretches into a blue pill. */
export function CarouselDots({ className, ...props }: ComponentProps<"div">) {
  const { index, snaps, scrollTo } = useCarousel()
  return (
    <div
      data-slot="carousel-dots"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="group"
      aria-label="Choose slide"
      className={cn("flex gap-1.5", className)}
      {...props}
    >
      {snaps.map((snap, i) => (
        <button
          key={snap}
          type="button"
          aria-label={`Go to slide ${i + 1}`}
          aria-current={i === index || undefined}
          onClick={() => scrollTo(i)}
          className={cn(
            "h-2 w-2 cursor-pointer rounded-full bg-g-200 transition-[width,background-color] duration-base ease-brand hover:bg-g-300",
            "aria-current:w-[22px] aria-current:bg-blue motion-reduce:transition-none"
          )}
        />
      ))}
    </div>
  )
}

/** Arrows either side of the dots, centred under the slides. */
export function CarouselControls({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="carousel-controls"
      className={cn("flex items-center justify-center gap-3.5", className)}
      {...props}
    >
      <CarouselPrevious />
      <CarouselDots />
      <CarouselNext />
    </div>
  )
}
