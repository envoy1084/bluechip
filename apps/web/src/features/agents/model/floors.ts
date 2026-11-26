// Stop-loss floors as the floors editor changes them: one per stock the agent trades, in its order.
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Floor } from "@bluechip/domain/policies/StopLossFloor"

/** The floors with `symbol`'s set to `price` (`null` clears it), in the order of the stocks it trades. */
export const withFloor = (
  floors: ReadonlyArray<Floor>,
  symbols: ReadonlyArray<StockSymbol>,
  symbol: StockSymbol,
  price: Floor["price"] | null
): ReadonlyArray<Floor> =>
  symbols.flatMap((each): ReadonlyArray<Floor> => {
    const next = each === symbol ? price : floors.find((floor) => floor.symbol === each)?.price ?? null
    return next === null ? [] : [{ symbol: each, price: next }]
  })
