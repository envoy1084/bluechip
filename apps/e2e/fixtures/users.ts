// People, made through the front door: the welcome screens with the page's passkey, then the API the app itself calls.
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { expect, type Page } from "@playwright/test"
import { urls } from "../stack/Stack.ts"

export interface User {
  /** The account's address on Base. */
  readonly address: `0x${string}`
  /** Adds $1,000 of test USDC and ETH for gas (`POST /api/dev/fund`, the Add cash screen's test money button). */
  readonly fund: (page: Page) => Promise<void>
}

/** Headers the web app sends with every API call: its contract version and its origin. */
export const apiHeaders = { [contractVersionHeader]: String(ContractVersion), origin: urls.web }

/** Signs up a new person with the page's passkey, answers eligibility and lands on home. */
export const signUp = async (page: Page): Promise<User> => {
  await page.goto("/welcome")
  await page.getByRole("button", { name: "Create account with Face ID" }).click()
  await expect(page.getByRole("heading", { name: "Your account is ready" })).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByRole("heading", { name: "Where do you live?" })).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByRole("heading", { name: "Add cash", level: 1 })).toBeVisible()
  await page.getByRole("button", { name: "Skip for now" }).click()
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()

  const me = await (await page.request.get("/api/account", { headers: apiHeaders })).json() as {
    readonly account: { readonly address: `0x${string}` }
  }

  return {
    address: me.account.address,
    fund: async (on) => {
      const response = await on.request.post("/api/dev/fund", { headers: apiHeaders, data: {} })
      expect(response.status(), "POST /api/dev/fund").toBe(204)
    }
  }
}
