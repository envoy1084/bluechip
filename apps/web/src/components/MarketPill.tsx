import { MarketStatus } from "@bluechip/ui/bluechip/market-status"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { marketStatusAtom } from "../atoms/market.ts"
import { marketPillProps } from "../lib/marketSession.ts"

/** Whether US stocks trade right now; nothing until the status is known, so a page never shows a wrong state. */
export function MarketPill({ className }: Readonly<{ className?: string }>) {
  const status = useAtomValue(marketStatusAtom)
  return AsyncResult.isSuccess(status)
    ? <MarketStatus className={className} {...marketPillProps(status.value)} />
    : null
}
