// What the signed-in frame shows for the account's latest answer. A failure keeps the account we showed a moment ago
// unless the session itself ended: a blip (the server restarting, the network dropping) shouldn't replace the whole
// app with an error page, since the connection banner already says it.
import type { Me } from "@bluechip/domain/Account"
import { ClientOutdated, Unauthenticated } from "@bluechip/domain/Errors"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"

type AccountView =
  | { readonly _tag: "loading" }
  | { readonly _tag: "signedIn"; readonly me: Me }
  | { readonly _tag: "outdated" }
  | { readonly _tag: "signIn" }
  | { readonly _tag: "signInAgain" }
  | { readonly _tag: "problem" }

/** The account to show, or why there's none: loading, an app older than the server, no session, or a failure. */
export const accountView = (result: AsyncResult.AsyncResult<Me, unknown>): AccountView => {
  if (AsyncResult.isSuccess(result)) return { _tag: "signedIn", me: result.value }
  if (AsyncResult.isInitial(result)) return { _tag: "loading" }

  const error = AsyncResult.error(result)
  if (Option.exists(error, (cause) => cause instanceof ClientOutdated)) return { _tag: "outdated" }

  const last = AsyncResult.value(result)
  if (Option.exists(error, (cause) => cause instanceof Unauthenticated)) {
    return Option.isSome(last) ? { _tag: "signInAgain" } : { _tag: "signIn" }
  }
  return Option.isSome(last) ? { _tag: "signedIn", me: last.value } : { _tag: "problem" }
}
