import type { MarketStatus } from "@bluechip/domain/market/Market"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { marketStatusAtom } from "../../../atoms/market.ts"

/** The market's session, once known. */
export const useMarketStatus = (): MarketStatus | undefined => {
  const status = useAtomValue(marketStatusAtom)
  return AsyncResult.isSuccess(status) ? status.value : undefined
}
