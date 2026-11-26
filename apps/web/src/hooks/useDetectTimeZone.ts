import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect } from "react"
import { meAtom, setTimeZoneAtom } from "../atoms/account.ts"
import { accountReactivityKey } from "../lib/api/client.ts"
import { localTimeZone } from "../lib/localTime.ts"

/**
 * On the first visit, saves this browser's time zone as the user's, so quiet hours and the digest's morning are in
 * their time from the start. Once one is saved, only Settings changes it.
 */
export function useDetectTimeZone() {
  const me = useAtomValue(meAtom)
  const setTimeZone = useAtomSet(setTimeZoneAtom, { mode: "promise" })
  const unset = AsyncResult.isSuccess(me) && me.value.user.timeZone === null

  useEffect(() => {
    if (!unset) return
    // A browser's zone the server doesn't know stays unset (UTC): nothing to tell the user here.
    setTimeZone({ payload: { timeZone: localTimeZone() }, reactivityKeys: [accountReactivityKey] }).catch(() =>
      undefined
    )
  }, [unset, setTimeZone])
}
