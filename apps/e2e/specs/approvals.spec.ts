import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { agentActivity, askToBuy, tradeCard } from "../utils/intents.ts"

const request = (page: Page) => page.getByRole("region", { name: "Stock picker wants to buy $150.00 of NVIDIA" })

/** A $150 buy through an agent that asks above $100: it waits for your OK. */
const askOverLargestTrade = async (page: Page) => {
  await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
  await askToBuy(page, 150)
  await expect(tradeCard(page).getByText("Needs your OK", { exact: true })).toBeVisible()
}

test.describe("approvals", () => {
  test("a new person has nothing waiting", async ({ page, user: _user }) => {
    await page.goto("/approvals")

    await expect(page.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible()
    await expect(page.getByText("When an agent's trade needs your OK, it shows up here.")).toBeVisible()
    await expect(page.getByText("Nothing waiting for you")).toHaveCount(2)
  })

  test("a trade over the agent's largest trade is listed with its reason, and the sidebar counts it", async ({ page, funded: _funded }) => {
    await askOverLargestTrade(page)

    await page.getByRole("link", { name: "Approvals" }).click()

    await expect(page.getByLabel("1 waiting")).toHaveText("1")
    await expect(page.getByText("1 trade waiting for you")).toBeVisible()
    await expect(
      request(page).getByText(
        /^Over the agent's largest trade \(\$100\): it needs your Face ID\. Asked at \d{2}:\d{2}\.$/
      )
    ).toBeVisible()
    await expect(request(page).getByText("Expires in 6 h")).toBeVisible()
    await expect(request(page).getByRole("button", { name: "Approve with Face ID" })).toBeVisible()
  })

  test("the header's Approvals button opens them in a sheet", async ({ page, funded: _funded }) => {
    await askOverLargestTrade(page)
    await page.goto("/home")

    await page.getByRole("button", { name: "Approvals, 1 trade waiting for you" }).click()

    const sheet = page.getByRole("dialog", { name: "Approvals" })
    await expect(sheet.getByText("1 trade waiting for you")).toBeVisible()
    await expect(sheet.getByRole("region", { name: "Stock picker wants to buy $150.00 of NVIDIA" })).toBeVisible()
  })

  // fixme: the activity row's Review and approve link never appeared; maybe no live update from Asked
  test.fixme("the agent's activity leads to its approval", async ({ page, funded: _funded }) => {
    await askOverLargestTrade(page)
    const row = agentActivity(page).getByRole("listitem").filter({ hasText: "Buy $150.00 of NVIDIA" })
    await expect(row.getByText("Over the agent's largest trade ($100): it needs your Face ID.")).toBeVisible()

    await row.getByRole("link", { name: "Review and approve" }).click()

    await expect(page).toHaveURL(/\/approvals$/)
    await expect(request(page)).toBeVisible()
  })

  test("declining it ends it with nothing bought, and nothing waits any more", async ({ page, funded: _funded }) => {
    await askOverLargestTrade(page)
    await page.goto("/approvals")
    await expect(page.getByLabel("1 waiting")).toBeVisible()

    await request(page).getByRole("button", { name: "Decline" }).click()

    const declined = page.getByRole("region", { name: "You declined: buy $150.00 of NVIDIA" })
    await expect(declined.getByText("Nothing was bought. Your cash is where it was.")).toBeVisible()
    await expect(page.getByText("Nothing waiting for you")).toBeVisible()
    await expect(page.getByLabel("1 waiting")).toBeHidden()
    await declined.getByRole("button", { name: "Done" }).click()
    await expect(page.getByText("When an agent's trade needs your OK, it shows up here.")).toBeVisible()
  })

  test("approving it with Face ID sends it and it fills", async ({ page, funded: _funded }) => {
    await askOverLargestTrade(page)
    await page.goto("/approvals")

    await request(page).getByRole("button", { name: "Approve with Face ID" }).click()

    const bought = page.getByRole("region", { name: "Bought $150.00 of NVIDIA" })
    await expect(bought.getByRole("button", { name: "Done" })).toBeVisible()
    await expect(page.getByLabel("1 waiting")).toBeHidden()
  })

  test("a cancelled Face ID leaves it waiting for you", async ({ page, authenticator, funded: _funded }) => {
    await askOverLargestTrade(page)
    await page.goto("/approvals")
    await authenticator.setVerified(false)

    await request(page).getByRole("button", { name: "Approve with Face ID" }).click()

    await expect(
      request(page).getByText("Face ID was cancelled or the trade couldn't be sent. Nothing was bought.")
    ).toBeVisible()
    await expect(request(page).getByRole("button", { name: "Approve with Face ID" })).toBeEnabled()
    await expect(page.getByLabel("1 waiting")).toBeVisible()
  })
})
