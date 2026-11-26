import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { marketStatusAtom } from "../../../atoms/market.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { greeting, marketLine, todayLabel } from "../model/greeting.ts"

/** The day, a greeting by name, and where the US market stands, in a sentence once it's known. */
export function Headline({ displayName, now }: Readonly<{ displayName: string | null; now: Date }>) {
  const status = useAtomValue(marketStatusAtom)
  const zone = localTimeZone()

  return (
    <div className="grid gap-1">
      <span className="text-label-sm font-medium text-g-500">{todayLabel(now, zone)}</span>
      <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.035em] text-balance">
        {greeting(now, displayName, zone)}
      </h2>
      {AsyncResult.isSuccess(status) ?
        <p className="text-body-sm text-pretty text-g-600">{marketLine(status.value, now, zone)}</p> :
        null}
    </div>
  )
}
