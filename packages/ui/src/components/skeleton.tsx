import type { ComponentProps } from "react"
import { Skeleton as MeasuredSkeleton, type SkeletonProps as MeasuredSkeletonProps } from "skullet/react"
import { cn } from "../lib/cn.ts"

/** A plain block for a shape no content can stand in for. */
export type SkeletonBlockProps = ComponentProps<"span">

/**
 * One block of loading shimmer, sized by its classes. Only for shapes the measured `Skeleton` can't draw from
 * content; set `aria-busy` on the region that is loading. The shimmer stops under reduced motion.
 */
export function SkeletonBlock({ className, ...props }: SkeletonBlockProps) {
  return (
    <span
      data-slot="skeleton-block"
      aria-hidden
      className={cn(
        "block h-3.5 animate-shimmer rounded-xs bg-[linear-gradient(90deg,var(--color-g-100)_0%,#f7f8fa_40%,var(--color-g-100)_80%)] bg-size-[300%_100%] motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export type SkeletonProps<T = unknown> = MeasuredSkeletonProps<T> | (SkeletonBlockProps & { readonly children?: never })

function isBlock<T>(props: SkeletonProps<T>): props is SkeletonBlockProps & { readonly children?: never } {
  return props.children === undefined
}

/**
 * A loading state measured from the real content (skullet): wrap what you'd render, and while it loads every line
 * of text becomes a bar and every image, control and chip a block, in exactly the space the content will take.
 *
 * - `<Skeleton data={holding} sample={SAMPLE}>{(holding) => <HoldingRow {...holding} />}</Skeleton>` loads while
 *   `data` is empty and draws the first skeleton from `sample`.
 * - `<Skeleton loading={pending}><Card /></Skeleton>` toggles it over plain children.
 *
 * The region is `aria-busy` while loading and reads `label` to screen readers. Colors, radius and shimmer come from
 * `styles/skeleton.css`. Without children it draws a `SkeletonBlock`, as it did before.
 */
export function Skeleton<T>(props: SkeletonProps<T>) {
  if (isBlock(props)) return <SkeletonBlock {...props} />
  return <MeasuredSkeleton {...props} />
}
