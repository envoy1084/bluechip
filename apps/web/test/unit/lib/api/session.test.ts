import { assert, describe, it } from "@effect/vitest"
import { sessionAfter } from "../../../../src/lib/api/session.ts"

describe("sessionAfter", () => {
  it.each([
    {
      name: "the account shown: the session is live",
      live: false,
      status: 200,
      url: "https://api.bluechip.markets/api/account",
      expected: { live: true, ended: false }
    },
    {
      name: "a 401 from a signed-in page while live: it ended, once",
      live: true,
      status: 401,
      url: "https://api.bluechip.markets/api/portfolio",
      expected: { live: false, ended: true }
    },
    {
      name: "the next 401 after it ended changes nothing",
      live: false,
      status: 401,
      url: "https://api.bluechip.markets/api/agents",
      expected: { live: false, ended: false }
    },
    {
      name: "a path on the page's own origin, under Vite's proxy",
      live: true,
      status: 401,
      url: "/api/events",
      expected: { live: false, ended: true }
    },
    {
      name: "the account's own 401: not live, and its answer already says so",
      live: true,
      status: 401,
      url: "https://api.bluechip.markets/api/account",
      expected: { live: false, ended: false }
    },
    {
      name: "the account failing otherwise keeps the session as it was",
      live: true,
      status: 503,
      url: "https://api.bluechip.markets/api/account",
      expected: { live: true, ended: false }
    },
    {
      name: "a sign-in that failed isn't a session ending",
      live: true,
      status: 401,
      url: "https://api.bluechip.markets/api/auth/login/verify",
      expected: { live: true, ended: false }
    },
    {
      name: "a recovery's 401 isn't a session ending",
      live: true,
      status: 401,
      url: "https://api.bluechip.markets/api/recovery",
      expected: { live: true, ended: false }
    },
    {
      name: "a server error isn't a session ending",
      live: true,
      status: 500,
      url: "https://api.bluechip.markets/api/portfolio",
      expected: { live: true, ended: false }
    },
    {
      name: "a 403 isn't a session ending",
      live: true,
      status: 403,
      url: "https://api.bluechip.markets/api/portfolio",
      expected: { live: true, ended: false }
    }
  ])("$name", ({ live, status, url, expected }) => {
    assert.deepStrictEqual(sessionAfter(live, status, url), expected)
  })
})
