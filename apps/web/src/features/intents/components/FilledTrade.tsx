import type { TradeId } from "@bluechip/domain/Ids"
import { TradeFill } from "@bluechip/ui/bluechip/trade-receipt"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { priceDollars, shareCount, usdcDollars } from "../../../lib/amounts.ts"
import { explorerTxUrl } from "../../../lib/network.ts"
import { tradeAtom } from "../atoms/intents.ts"

/**
 * What a filled trade actually moved, from its receipt: paid or got, shares and the price they make, with the
 * transaction on Base (`withTx`). Nothing until the receipt is read, or while it hasn't filled.
 */
export function FilledTrade(
  { id, withTx = false, className }: Readonly<{ id: TradeId; withTx?: boolean; className?: string }>
) {
  const trade = useAtomValue(tradeAtom(id))
  if (!AsyncResult.isSuccess(trade) || trade.value.status !== "filled") return null
  const { price, shares, side, txHash, usdc } = trade.value

  return (
    <TradeFill
      side={side}
      total={usdcDollars(usdc)}
      shares={shareCount(shares)}
      price={priceDollars(price)}
      {...(withTx && txHash !== null ? { txUrl: explorerTxUrl(txHash) } : {})}
      {...(className === undefined ? {} : { className })}
    />
  )
}
