import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { fetchedPortfolioAtom } from "../../../atoms/portfolio.ts"
import { usdcDollars } from "../../../lib/amounts.ts"
import { network } from "../../../lib/wallet.ts"
import { devFundAtom } from "../atoms/funding.ts"

// While this screen is open, balances are read this often: deposits aren't watched in the background, so the
// "cash arrived" moment only plays for someone who is looking.
const CHECK_EVERY_MS = 5000

/**
 * Add cash: the account's address and QR, and (on the local fork) test money. While it's open, cash is checked every few seconds and an arrival plays the "cash arrived" moment.
 */
export function AddCashPanel({ address }: Readonly<{ address: `0x${string}` }>) {
  const portfolio = useAtomValue(fetchedPortfolioAtom)
  const refresh = useAtomRefresh(fetchedPortfolioAtom)
  const fund = useAtomSet(devFundAtom, { mode: "promise" })
  const [funding, setFunding] = useState(false)

  const cash = AsyncResult.isSuccess(portfolio) ? portfolio.value.cash : undefined
  // The cash when the screen opened: anything above it arrived while the user was looking.
  const [startingCash, setStartingCash] = useState<bigint | undefined>(undefined)
  if (startingCash === undefined && cash !== undefined) setStartingCash(cash)

  const arrived = cash !== undefined && startingCash !== undefined && cash > startingCash
    ? cash - startingCash
    : undefined

  useEffect(() => {
    if (arrived !== undefined) return
    const timer = setInterval(refresh, CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [arrived, refresh])

  return (
    <div className="grid gap-3.5">
      <DepositCard
        address={address}
        status={arrived === undefined ? "waiting" : "arrived"}
        amount={arrived === undefined ? 0 : usdcDollars(arrived)}
        celebrate={arrived !== undefined}
      />

      {network === "local" && arrived === undefined && (
        <Button
          variant="ghost"
          loading={funding}
          onClick={() => {
            setFunding(true)
            fund({}).finally(() => setFunding(false))
          }}
        >
          <Icon name="play" size={14} />Get $1,000 test money (local fork)
        </Button>
      )}
    </div>
  )
}
