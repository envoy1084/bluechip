import { Account, Me, User } from "@bluechip/domain/Account"
import { ClientOutdated, Unauthenticated } from "@bluechip/domain/Errors"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { accountView } from "../../../src/lib/accountView.ts"

const ME = new Me({
  user: new User({
    id: "user_01jd8v4t5m6n7a8q9r0s1t2v3w" as User["id"],
    displayName: null,
    eligibility: "outsideUs",
    timeZone: null,
    createdAt: DateTime.makeUnsafe("2026-11-26T12:00:00Z")
  }),
  account: new Account({ address: "0x99b6CF62CBa281F459481aA154c6695898Cc3917" as Account["address"], deployed: true })
})

const SHOWN = Option.some(AsyncResult.success<Me, unknown>(ME))

describe("accountView", () => {
  it("the account", () => {
    assert.deepStrictEqual(accountView(AsyncResult.success(ME)), { _tag: "signedIn", me: ME })
  })

  it("still loading", () => {
    assert.deepStrictEqual(accountView(AsyncResult.initial()), { _tag: "loading" })
  })

  it("an app older than the server", () => {
    assert.deepStrictEqual(accountView(AsyncResult.fail(new ClientOutdated({ serverVersion: 2 }))), {
      _tag: "outdated"
    })
  })

  it("no session yet", () => {
    assert.deepStrictEqual(accountView(AsyncResult.fail(new Unauthenticated())), { _tag: "signIn" })
  })

  it("a session that ended while the account was shown", () => {
    const result = AsyncResult.failWithPrevious<Me, unknown>(new Unauthenticated(), { previous: SHOWN })

    assert.deepStrictEqual(accountView(result), { _tag: "signInAgain" })
  })

  it("a failure before the account was ever shown", () => {
    assert.deepStrictEqual(accountView(AsyncResult.fail(new Error("Failed to fetch"))), { _tag: "problem" })
  })

  it("a failure after the account was shown, as when the server restarts", () => {
    const result = AsyncResult.failWithPrevious<Me, unknown>(new Error("Failed to fetch"), { previous: SHOWN })

    assert.deepStrictEqual(accountView(result), { _tag: "signedIn", me: ME })
  })
})
