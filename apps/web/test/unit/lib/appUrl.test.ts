import { assert, describe, it } from "@effect/vitest"
import { appHrefOf, appRedirectOf, isLandingPath } from "../../../src/lib/appUrl.ts"

const app = "https://paper.bluechip.markets"

describe("appHrefOf", () => {
  it("the app on this site: the path itself", () => {
    assert.strictEqual(appHrefOf(null, "/welcome"), "/welcome")
  })

  it("the landing alone: the path on the app's site", () => {
    assert.strictEqual(appHrefOf(app, "/welcome"), "https://paper.bluechip.markets/welcome")
  })
})

describe("isLandingPath", () => {
  it.each(
    [
      { pathname: "/", expected: true },
      { pathname: "/help", expected: true },
      { pathname: "/help/recovery", expected: true },
      { pathname: "/legal/terms", expected: true },
      { pathname: "/home", expected: false },
      { pathname: "/agents/agent_01jdxk4m2v8y9q5t3n7r6w0zab", expected: false },
      { pathname: "/welcome", expected: false },
      { pathname: "/welcome/deposit", expected: false },
      { pathname: "/recover", expected: false },
      { pathname: "/signin", expected: false },
      { pathname: "/settings/security", expected: false },
      { pathname: "/dev/chain", expected: false },
      { pathname: "/helpful", expected: false },
      { pathname: "/legal", expected: false }
    ] as const
  )("$pathname: $expected", ({ pathname, expected }) => {
    assert.strictEqual(isLandingPath(pathname), expected)
  })
})

describe("appRedirectOf", () => {
  it("a page of the app goes to the app's site with its query and hash", () => {
    assert.strictEqual(
      appRedirectOf(app, { pathname: "/agents/new", search: "?template=steady", hash: "#limits" }),
      "https://paper.bluechip.markets/agents/new?template=steady#limits"
    )
  })

  it("a page of the landing stays", () => {
    assert.strictEqual(appRedirectOf(app, { pathname: "/help/recovery", search: "", hash: "#cancel" }), null)
  })

  it("the app on this site: nothing goes anywhere", () => {
    assert.strictEqual(appRedirectOf(null, { pathname: "/home", search: "", hash: "" }), null)
  })
})
