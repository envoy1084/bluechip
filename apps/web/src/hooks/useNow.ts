import { useEffect, useState } from "react"

/** The time now, read again every `everyMs`. */
export const useNow = (everyMs: number): Date => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(tick)
  }, [everyMs])

  return now
}
