// People, made through the front door: the welcome screens with the page's passkey, then the API the app itself calls.
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { expect, type Page } from "@playwright/test"
import { urls } from "../stack/Stack.ts"

export interface User {
  readonly id: string
  /** The account's address on Base. */
  readonly address: `0x${string}`
  /** Adds $1,000 of test USDC and ETH for gas (`POST /api/dev/fund`, Settings' test money button). */
  readonly fund: (page: Page) => Promise<void>
  /**
   * Runs the agents' expiry cron for this person as if the server's clock read `at` (`POST /e2e/expire` on the suite's
   * server): an agent whose session ended by then is expired.
   */
  readonly expireAgents: (page: Page, at: Date) => Promise<void>
}

/** Headers the web app sends with every API call: its contract version and its origin. */
export const apiHeaders = { [contractVersionHeader]: String(ContractVersion), origin: urls.web }

/** Signs up a new person with the page's passkey, answers eligibility and lands on home. */
export const signUp = async (page: Page): Promise<User> => {
  await page.goto("/welcome")
  await page.getByRole("button", { name: "Create account with Face ID" }).click()
  await expect(page.getByRole("heading", { name: "Your account is ready" })).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByRole("heading", { name: "Are you a US citizen or resident?" })).toBeVisible()
  // The answer is read from the account first; Continue saves it only once the form shows it.
  await expect(page.getByText("You can use bluechip.")).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByRole("heading", { name: "Add cash", level: 1 })).toBeVisible()
  await page.getByRole("button", { name: "Go to home" }).click()
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()

  const me = await (await page.request.get("/api/account", { headers: apiHeaders })).json() as {
    readonly user: { readonly id: string }
    readonly account: { readonly address: `0x${string}` }
  }

  return {
    id: me.user.id,
    address: me.account.address,
    expireAgents: async (on, at) => {
      const response = await on.request.post(`${urls.server}/e2e/expire`, {
        data: { userId: me.user.id, at: at.toISOString() }
      })
      expect(response.status(), "POST /e2e/expire").toBe(204)
    },
    fund: async (on) => {
      const response = await on.request.post("/api/dev/fund", { headers: apiHeaders, data: {} })
      expect(response.status(), "POST /api/dev/fund").toBe(204)
    }
  }
}
