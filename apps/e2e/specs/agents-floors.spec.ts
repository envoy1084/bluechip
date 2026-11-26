import { expect, test } from "../fixtures/test.ts"
import { neverRules, openFineTuning, openRule, startAgent } from "../utils/agents.ts"

test.describe("rules step: stop-loss floor", () => {
  test("a floor set for its stock is the price it never sells above", async ({ page, user: _user }) => {
    await startAgent(page, "Stop-loss guard")
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await openFineTuning(page)
    await page.getByRole("switch", { name: "Stop-loss floor" }).click()
    await openRule(page, "Stop-loss floor")

    await page.getByRole("textbox", { name: "Apple" }).fill("180")

    await expect(neverRules(page)).toContainText([/^Sell Apple above \$180/])
  })

  test("a floor left empty says each stock needs one", async ({ page, user: _user }) => {
    await startAgent(page, "Stop-loss guard")
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await openFineTuning(page)

    await page.getByRole("switch", { name: "Stop-loss floor" }).click()

    await expect(page.getByText("Give every stock a floor.").first()).toBeVisible()
  })
})
