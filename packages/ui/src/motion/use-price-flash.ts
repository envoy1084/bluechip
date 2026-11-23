import { useEffect, useRef, useState } from "react"

export type PriceDirection = "up" | "down"

const ON: Readonly<Record<PriceDirection, string>> = {
  up: "rounded-xs bg-gain-wash text-gain shadow-[0_0_0_3px_var(--color-gain-wash)]",
  down: "rounded-xs bg-loss-wash text-loss shadow-[0_0_0_3px_var(--color-loss-wash)]"
}
// The tint is set at once, then this transition fades it back to the text's own color over 900 ms.
const FADE =
  "rounded-xs shadow-[0_0_0_3px_transparent] transition-[background-color,box-shadow,color] duration-[900ms] ease-brand"

/**
 * Classes that tint an element briefly when `value` changes: Gain wash when it rose, Loss wash when it fell. Put
 * them on the price itself. Under reduced motion the tint is dropped at once; show direction with color elsewhere.
 */
export const usePriceFlash = (value: number): string => {
  const previous = useRef(value)
  const [flash, setFlash] = useState<{ readonly direction: PriceDirection; readonly fading: boolean } | null>(null)
  useEffect(() => {
    const before = previous.current
    previous.current = value
    if (value === before) return
    const direction = value > before ? "up" : "down"
    setFlash({ direction, fading: false })
    // Two frames so the tint is painted before the fade starts.
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setFlash({ direction, fading: true }))
    })
    return () => cancelAnimationFrame(raf)
  }, [value])
  if (!flash) return ""
  return flash.fading ? FADE : ON[flash.direction]
}
