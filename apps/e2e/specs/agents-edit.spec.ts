import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { canRules, createAgent, createDraft, dayFromNow, openFineTuning } from "../utils/agents.ts"

/** A Stock picker of NVIDIA, live, at its rules step to change them. */
const editAgent = async (page: Page, template = "Stock picker", stocks = ["NVDA NVIDIA"]) => {
  const agent = await createAgent(page, { template, stocks, name: "Edited one" })
  await page.getByRole("button", { name: "Edit rules" }).click()
  await expect(page).toHaveURL(/\/edit$/)
  await expect(page.getByRole("heading", { name: "Its limits" })).toBeVisible()
  return agent
}

const changeRows = (page: Page) => page.getByRole("main").getByRole("list").first().getByRole("listitem")

test.describe("edit rules: the rules step", () => {
  test("it opens on the rules in force, with nothing to review yet", async ({ page, funded: _funded }) => {
    await editAgent(page)

    await expect(page.getByRole("heading", { name: "Edit rules", level: 1 })).toBeVisible()
    await expect(page.getByText("What it can and can never do")).toBeVisible()
    await expect(page.getByText(`Locked with Face ID until ${dayFromNow(90)}`)).toBeVisible()
    await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Undo changes" })).toBeHidden()
  })

  test("a change is marked on its rule and read back as the rules it would have", async ({ page, funded: _ }) => {
    await editAgent(page)

    await page.getByRole("textbox", { name: "Daily budget" }).fill("100")

    await expect(page.getByText("Stocks and direction", { exact: true }).locator("xpath=..")).toContainText("Tighter")
    await expect(page.getByText("What it could do with these rules")).toBeVisible()
    await expect(canRules(page).nth(1)).toHaveText("Spend up to $100 a day")
    await expect(page.getByRole("button", { name: "Review changes" })).toBeEnabled()
  })

  test("Undo changes puts back the rules in force", async ({ page, funded: _funded }) => {
    await editAgent(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("100")

    await page.getByRole("button", { name: "Undo changes" }).click()

    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("250")
    await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled()
  })

  test("Cancel goes back to the agent", async ({ page, funded: _funded }) => {
    const { id } = await editAgent(page)

    await page.getByRole("link", { name: "Cancel" }).click()

    await expect(page).toHaveURL(new RegExp(`/agents/${id}$`))
  })

  test("a rule that can't be locked blocks the review", async ({ page, funded: _funded }) => {
    await editAgent(page)

    await page.getByRole("textbox", { name: "Daily budget" }).fill("2010")

    await expect(page.getByText("Pick $0 to $2,000.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled()
  })
})

test.describe("edit rules: review", () => {
  test("a lower budget is tighter and only narrows what it can do", async ({ page, funded: _funded }) => {
    await editAgent(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("100")

    await page.getByRole("button", { name: "Review changes" }).click()

    await expect(page.getByText("1 tighter, 0 looser")).toBeVisible()
    await expect(changeRows(page)).toHaveText([/^Stocks and direction\s*Daily budget\s*\$250\s*\$100\s*Tighter$/])
    await expect(page.getByText(
      "Overall this only narrows what it can do. Every change is locked on Base with Face ID and applies once it lands."
    )).toBeVisible()
    await expect(canRules(page).nth(1)).toHaveText("Spend up to $100 a day")
  })

  test("another stock is looser and gives it more room", async ({ page, funded: _funded }) => {
    await editAgent(page)
    await page.getByRole("button", { name: "AAPL Apple" }).click()

    await page.getByRole("button", { name: "Review changes" }).click()

    await expect(page.getByText("0 tighter, 1 looser")).toBeVisible()
    await expect(changeRows(page)).toHaveText([/^Stocks and direction\s*Stocks\s*NVIDIA\s*Apple and NVIDIA\s*Looser$/])
    await expect(page.getByText(
      "Overall this gives Edited one more room. Every change is locked on Base with Face ID and applies once it lands."
    )).toBeVisible()
  })

  test("a rule added is new, a rule taken away is removed", async ({ page, funded: _funded }) => {
    await editAgent(page, "Stop-loss guard", ["AAPL Apple"])
    await page.getByRole("switch", { name: "Max in one stock" }).click()
    await openFineTuning(page)
    await page.getByRole("switch", { name: "Weekly slippage" }).click()

    await page.getByRole("button", { name: "Review changes" }).click()

    await expect(page.getByText("1 tighter, 1 looser")).toBeVisible()
    await expect(changeRows(page)).toHaveText([
      /^Max in one stock\s*Max in one stock\s*30%\s*New$/,
      /^Weekly slippage\s*Weekly slippage\s*1%\s*Removed$/
    ])
  })

  test("Back to rules keeps the change", async ({ page, funded: _funded }) => {
    await editAgent(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("100")
    await page.getByRole("button", { name: "Review changes" }).click()

    await page.getByRole("button", { name: "Back to rules" }).click()

    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("100")
  })

  test("the close button goes back to the rules", async ({ page, funded: _funded }) => {
    await editAgent(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("100")
    await page.getByRole("button", { name: "Review changes" }).click()

    await page.getByRole("button", { name: "Back to the rules" }).click()

    await expect(page.getByRole("heading", { name: "Its limits" })).toBeVisible()
  })
})

test.describe("edit rules: lock with Face ID", () => {
  test("the new rules land and the agent's page shows them", async ({ page, funded: _funded }) => {
    const { id } = await editAgent(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("100")
    await page.getByRole("button", { name: "Review changes" }).click()

    await page.getByRole("button", { name: "Lock new rules with Face ID" }).click()

    await expect(page).toHaveURL(new RegExp(`/agents/${id}$`))
    await expect(canRules(page).nth(1)).toHaveText("Spend up to $100 a day")
    await expect.poll(() => page.getByRole("region", { name: "Usage" }).ariaSnapshot()).toContain("$0 of $100")
  })

  test("the history gains a session that says what changed", async ({ page, funded: _funded }) => {
    await editAgent(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("100")
    await page.getByRole("button", { name: "Review changes" }).click()
    await page.getByRole("button", { name: "Lock new rules with Face ID" }).click()

    const history = page.getByRole("region", { name: "History" })
    await expect(history.locator("li")).toHaveText([
      new RegExp(
        `^Locked ${dayFromNow(0)} by you, until ${dayFromNow(90)}\\s*In force\\s*Stocks and direction tighter\\.`
      ),
      new RegExp(`^Locked ${dayFromNow(0)} by you, ended ${dayFromNow(0)}\\s*Replaced\\s*Its first rules\\.$`)
    ])
    await history.getByRole("button", { name: "What changed" }).click()
    await expect(history.getByText("Daily budget")).toBeVisible()
  })

  test("a cancelled Face ID changes nothing and says so", async ({ page, authenticator, funded: _ }) => {
    await editAgent(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("100")
    await page.getByRole("button", { name: "Review changes" }).click()
    await authenticator.setVerified(false)

    await page.getByRole("button", { name: "Lock new rules with Face ID" }).click()

    await expect(page.getByText("Face ID was cancelled or the request couldn't be sent. Nothing changed."))
      .toBeVisible()
    await expect(page.getByRole("button", { name: "Try Face ID again" })).toBeVisible()
    await page.getByRole("main").getByRole("link", { name: "Edited one" }).click()
    await expect(canRules(page).nth(1)).toHaveText("Spend up to $250 a day")
  })

  test("after a cancelled Face ID, trying again locks the change", async ({ page, authenticator, funded: _ }) => {
    const { id } = await editAgent(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("100")
    await page.getByRole("button", { name: "Review changes" }).click()
    await authenticator.setVerified(false)
    await page.getByRole("button", { name: "Lock new rules with Face ID" }).click()
    await expect(page.getByRole("button", { name: "Try Face ID again" })).toBeVisible()

    await authenticator.setVerified(true)
    await page.getByRole("button", { name: "Try Face ID again" }).click()

    await expect(page).toHaveURL(new RegExp(`/agents/${id}$`))
    await expect(canRules(page).nth(1)).toHaveText("Spend up to $100 a day")
  })
})

test.describe("edit rules: when they can't change", () => {
  test("a draft's rules can't be edited until it's locked", async ({ page, authenticator, funded: _ }) => {
    const { id } = await createDraft(page, authenticator, { name: "Unlocked one" })

    await page.goto(`/agents/${id}/edit`)

    await expect(page.getByRole("heading", { name: "It isn't locked yet" })).toBeVisible()
    await expect(
      page.getByText("A draft has no rules in force. Lock it with Face ID first, then you can change them.")
    ).toBeVisible()
    await page.getByRole("link", { name: "Back to Unlocked one" }).click()
    await expect(page).toHaveURL(new RegExp(`/agents/${id}$`))
  })

  test("an agent id that no agent has is not found", async ({ page, user: _user }) => {
    await page.goto("/agents/agent_00000000000000000000000000/edit")

    await expect(page.getByText("We don't have that agent")).toBeVisible()
    await expect(page.getByText("Check the link, or pick one from your agents.")).toBeVisible()
  })

  test("a malformed agent id is not found", async ({ page, user: _user }) => {
    await page.goto("/agents/nope/edit")

    await expect(page.getByText("We don't have that agent")).toBeVisible()
  })
})
