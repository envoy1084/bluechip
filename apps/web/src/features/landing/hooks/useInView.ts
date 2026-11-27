import { type RefObject, useEffect, useState } from "react"

/**
 * Whether the element is on screen. With `once`, it stays true after the first time, for entrances that play once;
 * without, it follows the element in and out, for demos that should only run while someone can see them.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { once = true, margin = "0px 0px -12% 0px" }: { readonly once?: boolean; readonly margin?: string } = {}
): boolean {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => {
      const seen = entry?.isIntersecting ?? false
      setInView(seen)
      if (seen && once) observer.disconnect()
    }, { rootMargin: margin })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, once, margin])

  return inView
}
