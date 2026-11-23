import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { Button, type ButtonProps } from "./button.tsx"

interface CarouselContextValue {
  readonly viewportRef: RefObject<HTMLDivElement | null>
  /** The first fully visible slide. */
  readonly index: number
  /** How many positions the carousel can scroll to (slides minus those visible at once, plus one). */
  readonly positions: number
  readonly scrollTo: (index: number) => void
}

const CarouselContext = createContext<CarouselContextValue | null>(null)

const useCarousel = (): CarouselContextValue => {
  const context = useContext(CarouselContext)
  if (!context) throw new Error("Carousel parts must be used inside a Carousel.")
  return context
}

const slidesOf = (viewport: HTMLElement) => [...viewport.children] as Array<HTMLElement>

/**
 * A row of cards you page through with arrows, dots, the arrow keys or a swipe. Native scroll snapping does the
 * moving, so touch and trackpad scrolling feel like the platform.
 */
export function Carousel({ className, children, onKeyDown, ...props }: ComponentProps<"section">) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [positions, setPositions] = useState(1)

  const measure = useCallback(() => {
    const viewport = viewportRef.current
    const slides = viewport ? slidesOf(viewport) : []
    const first = slides[0]
    if (!viewport || !first) return
    const perView = Math.max(1, Math.round(viewport.clientWidth / first.offsetWidth))
    const last = Math.max(0, slides.length - perView)
    const atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1
    const nearest = slides.reduce(
      (best, slide, i) =>
        Math.abs(slide.offsetLeft - first.offsetLeft - viewport.scrollLeft) <
            Math.abs(slides[best]!.offsetLeft - first.offsetLeft - viewport.scrollLeft) ?
          i :
          best,
      0
    )
    setPositions(last + 1)
    setIndex(atEnd ? last : Math.min(nearest, last))
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    viewport.addEventListener("scroll", measure, { passive: true })
    return () => {
      observer.disconnect()
      viewport.removeEventListener("scroll", measure)
    }
  }, [measure])

  const scrollTo = useCallback((target: number) => {
    const viewport = viewportRef.current
    const slides = viewport ? slidesOf(viewport) : []
    const slide = slides[Math.max(0, Math.min(target, slides.length - 1))]
    if (!viewport || !slide || !slides[0]) return
    viewport.scrollTo({ left: slide.offsetLeft - slides[0].offsetLeft })
  }, [])

  const context = useMemo(() => ({ viewportRef, index, positions, scrollTo }), [index, positions, scrollTo])

  const onArrowKey = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event)
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    if ((event.target as HTMLElement).closest("input, textarea, [role=slider]")) return
    event.preventDefault()
    scrollTo(index + (event.key === "ArrowRight" ? 1 : -1))
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

/** The scrolling row. Children are `CarouselItem`s. */
export function CarouselContent({ className, ...props }: ComponentProps<"div">) {
  const { viewportRef } = useCarousel()
  return (
    <div
      ref={viewportRef}
      data-slot="carousel-content"
      className={cn(
        "-m-1.5 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain p-1.5 [scrollbar-width:none] motion-safe:scroll-smooth",
        className
      )}
      {...props}
    />
  )
}

/** One slide: a full row on phones, half from 600 px, a third from 1100 px. */
export function CarouselItem({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="carousel-item"
      // APG carousel slides are groups with the "slide" role description.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full snap-start min-[600px]:basis-[calc((100%-16px)/2)] min-[1100px]:basis-[calc((100%-32px)/3)]",
        className
      )}
      {...props}
    />
  )
}

export function CarouselPrevious(props: ButtonProps) {
  const { index, scrollTo } = useCarousel()
  return (
    <Button
      data-slot="carousel-previous"
      variant="secondary"
      size="icon-sm"
      aria-label="Previous"
      disabled={index === 0}
      onClick={() => scrollTo(index - 1)}
      {...props}
    >
      <Icon name="arrow-left" size={16} />
    </Button>
  )
}

export function CarouselNext(props: ButtonProps) {
  const { index, positions, scrollTo } = useCarousel()
  return (
    <Button
      data-slot="carousel-next"
      variant="secondary"
      size="icon-sm"
      aria-label="Next"
      disabled={index >= positions - 1}
      onClick={() => scrollTo(index + 1)}
      {...props}
    >
      <Icon name="arrow-right" size={16} />
    </Button>
  )
}

/** One dot per position; the current one stretches into a blue pill. */
export function CarouselDots({ className, ...props }: ComponentProps<"div">) {
  const { index, positions, scrollTo } = useCarousel()
  return (
    <div
      data-slot="carousel-dots"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="group"
      aria-label="Choose slide"
      className={cn("flex gap-1.5", className)}
      {...props}
    >
      {Array.from({ length: positions }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Go to slide ${i + 1}`}
          aria-current={i === index || undefined}
          onClick={() => scrollTo(i)}
          className={cn(
            "h-2 w-2 cursor-pointer rounded-full bg-g-200 transition-[width,background-color] duration-base ease-brand hover:bg-g-300",
            "aria-current:w-[22px] aria-current:bg-blue"
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
