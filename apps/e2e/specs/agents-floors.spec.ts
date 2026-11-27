import { expect, test } from "../fixtures/test.ts"
import { neverRules, openRule, startAgent } from "../utils/agents.ts"

test.describe("rules step: stop-loss floor", () => {
  test("a Stop-loss guard starts with its floor on", async ({ page, user: _user }) => {
    await startAgent(page, "Stop-loss guard")

    await expect(page.getByRole("switch", { name: "Stop-loss floor" })).toBeChecked()
  })

  test("a floor set for its stock is the price it never sells above", async ({ page, user: _user }) => {
    await startAgent(page, "Stop-loss guard")
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await openRule(page, "Stop-loss floor")

    await page.getByRole("textbox", { name: "Apple floor" }).fill("180")

    await expect(neverRules(page)).toHaveText([
      "Never trade more than 1% away from Chainlink's price",
      "Never sell Apple above $180",
      "Never lose more than 1% of your money to prices in a week"
    ])
  })

  test("a floor left empty says each stock needs one, once you try to review", async ({ page, user: _user }) => {
    await startAgent(page, "Stop-loss guard")
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await expect(page.getByText("Give every stock a floor.")).toHaveCount(0)

    await page.getByRole("button", { name: "Review" }).click()

    await expect(page.getByText("Give every stock a floor.").first()).toBeVisible()
  })
})
