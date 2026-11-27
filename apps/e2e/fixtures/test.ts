// The suite's `test`: every page gets a virtual passkey authenticator, a guard against console errors and "·" in copy,
// and the stack's controls. Each test that needs a person makes a new one (`user`, `funded`).
import { expect, type Page, test as base } from "@playwright/test"
import { addAuthenticator, type Authenticator } from "./authenticator.ts"
import { Chain } from "./chain.ts"
import { Replies } from "./replies.ts"
import { signUp, type User } from "./users.ts"

// What a healthy page still logs: Chromium's note that bluechip's passkeys allow only P-256 (ES256; the account's
// onchain verifier needs it), GPU notices from headless WebGL, and the failed load Chromium logs for each 4xx answer
// (a signed-out visitor's account check, a refused trade). Server errors are caught from the responses instead.
const ignoredConsole = [
  /pubKeyCredParams is missing/,
  /GL Driver Message/,
  /GPU stall/,
  /Failed to load resource: the server responded with a status of (401|[45]\d\d)/
]

// A transparent pixel: stock logos come from Coinbase's CDN, served from here so runs need no network.
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)

interface Fixtures {
  /** The page's passkey authenticator (Face ID in the app). */
  readonly authenticator: Authenticator
  /** Console errors and warnings the page logged, and server errors it got; checked to be empty after each test. */
  readonly consoleProblems: Array<string>
  /** A new person, signed up and past eligibility, on home. No money. */
  readonly user: User
  /** A new person with $1,000 of test USDC and ETH for gas, on home. */
  readonly funded: User
  /** The recorded model's replies: record what the assistant answers before sending a message. */
  readonly replies: Replies
  /** The devnet's controls. */
  readonly chain: Chain
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await page.route(/metadata\.coinbase\.com/, (route) => route.fulfill({ contentType: "image/png", body: pixel }))
    await use(page)
  },

  consoleProblems: [async ({ page }, use) => {
    const problems: Array<string> = []
    page.on("console", (message) => {
      if (message.type() !== "error" && message.type() !== "warning") return
      if (ignoredConsole.some((pattern) => pattern.test(message.text()))) return
      problems.push(`${message.type()}: ${message.text()}`)
    })
    page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`))
    page.on("response", (response) => {
      if (response.status() >= 500) {
        problems.push(`${response.status()}: ${response.request().method()} ${response.url()}`)
      }
    })

    await use(problems)

    expect(problems, "console errors and warnings").toEqual([])
    // Copy never separates with a middle dot (AGENTS.md, Screens): checked on the page each test ends on.
    if (!page.isClosed()) await expectNoMiddleDot(page)
  }, { auto: true }],

  authenticator: [async ({ page }, use) => {
    await use(await addAuthenticator(page))
  }, { auto: true }],

  user: async ({ page, authenticator: _authenticator }, use) => {
    await use(await signUp(page))
  },

  funded: async ({ page, user }, use) => {
    await user.fund(page)
    await use(user)
  },

  replies: async ({ request }, use) => {
    await use(new Replies(request))
  },

  chain: async ({ request: _request }, use) => {
    await use(new Chain())
  }
})

/** Fails when the page's text uses "·" as a separator. */
export const expectNoMiddleDot = async (page: Page) => {
  expect(await page.locator("body").innerText(), "copy uses no middle dot").not.toContain("·")
}

export { expect }
