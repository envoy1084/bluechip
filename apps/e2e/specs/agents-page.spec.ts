import { addAuthenticator } from "../fixtures/authenticator.ts"
import { expect, test } from "../fixtures/test.ts"
import { signUp } from "../fixtures/users.ts"
import { canRules, createAgent, createDraft, dayFromNow, neverRules, statePill } from "../utils/agents.ts"

test.describe("agents list", () => {
  test("with no agents it says so and offers a new one", async ({ page, user: _user }) => {
    await page.goto("/agents")

    await expect(page.getByRole("heading", { name: "No agents yet" })).toBeVisible()
    await expect(
      page.getByText("Start one from a template. You set its limits and lock them with Face ID before it can trade.")
    ).toBeVisible()
    await expect(page.getByRole("main").getByRole("link", { name: "New agent" })).toHaveCount(2)
  })

  test("the empty state's New agent opens the template step", async ({ page, user: _user }) => {
    await page.goto("/agents")

    await page.getByRole("main").getByRole("link", { name: "New agent" }).last().click()

    await expect(page.getByRole("heading", { name: "What should your agent do?" })).toBeVisible()
  })

  test("the header's New agent opens the template step", async ({ page, user: _user }) => {
    await page.goto("/agents")

    await page.getByRole("main").getByRole("link", { name: "New agent" }).first().click()

    await expect(page).toHaveURL(/\/agents\/new$/)
  })

  test("a live agent's summary shows its name, state, what it does, today's use and lock", async ({ page, funded: _ }) => {
    await createAgent(page, { template: "Weekly buyer", name: "Tuesday buys" })

    await page.goto("/agents")

    const card = page.getByRole("link", { name: /^Tuesday buys / })
    await expect(card).toContainText("Tuesday buysActive")
    await expect(card).toContainText(/Buys \w+/)
    await expect(card.getByRole("meter", { name: "Spent today" })).toBeVisible()
    await expect.poll(() => card.ariaSnapshot()).toContain("$250 left today")
    await expect(card).toContainText("Trades today0 of 1")
    await expect(card).toContainText(`Locked until${dayFromNow(90)}`)
    await expect(card).toContainText("No trades yet.")
  })

  test("a draft's card says it isn't locked yet", async ({ page, authenticator, funded: _ }) => {
    await createDraft(page, authenticator, { name: "Half made" })

    await page.goto("/agents")

    await expect(page.getByRole("link", { name: /^Half made / })).toHaveText(
      /^Half made\s*Stock picker\s*Not locked yet\s*Not locked yet$/
    )
  })

  test("a card opens its agent", async ({ page, funded: _funded }) => {
    const { id } = await createAgent(page, { name: "Card opener" })
    await page.goto("/agents")

    await page.getByRole("link", { name: /^Card opener / }).click()

    await expect(page).toHaveURL(new RegExp(`/agents/${id}$`))
  })
})

test.describe("sidebar: your agents", () => {
  test("it lists each agent and opens its page", async ({ page, funded: _funded }) => {
    const first = await createAgent(page, { name: "First one" })
    await createAgent(page, { name: "Second one", stocks: ["AAPL Apple"] })

    const sidebar = page.getByRole("complementary", { name: "App navigation" })
    await expect(sidebar.getByRole("link", { name: "First one" })).toBeVisible()
    await expect(sidebar.getByRole("link", { name: "Second one" })).toBeVisible()
    await sidebar.getByRole("link", { name: "First one" }).click()

    await expect(page).toHaveURL(new RegExp(`/agents/${first.id}$`))
  })

  test("its New agent opens the template step", async ({ page, user: _user }) => {
    await page.getByRole("complementary", { name: "App navigation" }).getByRole("link", { name: "New agent" }).click()

    await expect(page.getByRole("heading", { name: "What should your agent do?" })).toBeVisible()
  })
})

test.describe("agent page", () => {
  test("the header says its state, template, dates and promise", async ({ page, funded: _funded }) => {
    await createAgent(page, { template: "Stock picker", name: "Header check" })

    await expect(page.getByRole("heading", { name: "Header check", level: 2 })).toBeVisible()
    await expect(statePill(page)).toContainText("Active")
    await expect(page.getByText(/^Stock picker template, created /)).toHaveText(
      `Stock picker template, created ${dayFromNow(0)}, locked until ${dayFromNow(90)}`
    )
    await expect(page.getByText("Buys and sells a few stocks you pick.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Ask about this agent" })).toBeVisible()
  })

  test("an agent from scratch is called custom", async ({ page, funded: _funded }) => {
    await createAgent(page, { template: "Start from scratch", name: "Plain one" })

    await expect(page.getByText(/^Custom, created /)).toHaveText(
      `Custom, created ${dayFromNow(0)}, locked until ${dayFromNow(90)}`
    )
  })

  test("its rules are said in words, locked until the session ends", async ({ page, funded: _funded }) => {
    await createAgent(page, { template: "Stop-loss guard", stocks: ["AAPL Apple"] })

    await expect(page.getByRole("heading", { name: "Its rules" })).toBeVisible()
    await expect(canRules(page)).toHaveText([
      "Sell Apple",
      "Trade up to $100 at a time, and ask you before anything bigger",
      "Trade on weekends and holidays, with a tighter price limit",
      "Trade 4 times a day at most"
    ])
    await expect(neverRules(page)).toHaveText([
      "Send money out of your account",
      "Trade stocks you didn't pick",
      "Make a trade under $5",
      "Trade more than 1% away from Chainlink's price",
      "Lose more than 1% of your money to prices in a week",
      "Change its own policies"
    ])
    await expect(page.getByText(`Locked with Face ID until ${dayFromNow(90)}`)).toBeVisible()
    await expect(page.getByRole("button", { name: "Edit rules" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Renew" })).toBeVisible()
  })

  test("a Rebalancer's page shows its target mix", async ({ page, funded: _funded }) => {
    await createAgent(page, { template: "Rebalancer", stocks: ["NVDA NVIDIA", "AAPL Apple"] })

    await expect(page.getByText("Target mix", { exact: true }).locator("xpath=..")).toHaveText(
      /^Target mix\s*AAPL\s*30%\s*NVDA\s*30%\s*USDC\s*40%$/
    )
  })

  test("usage starts at nothing spent and every trade left", async ({ page, funded: _funded }) => {
    await createAgent(page, { template: "Stock picker" })

    const usage = page.getByRole("region", { name: "Usage" })
    await expect(usage.getByRole("meter", { name: "Spent today" })).toBeVisible()
    await expect.poll(() => usage.ariaSnapshot()).toContain("Spent today $0 of $250")
    await expect.poll(() => usage.ariaSnapshot()).toContain("$250 left today")
    await expect(usage).toContainText("Lost to prices this week$0")
    await expect(usage).toContainText("It stops at 1% of your money in any 7 days.")
    await expect(usage).toContainText("Trades today0 of 12")
    await expect(usage).toContainText("12 left today")
  })

  test("a sell-only agent's usage has no daily spend", async ({ page, funded: _funded }) => {
    await createAgent(page, { template: "Stop-loss guard", stocks: ["AAPL Apple"] })

    const usage = page.getByRole("region", { name: "Usage" })
    await expect(usage).toContainText("Trades today0 of 4")
    await expect(usage.getByRole("meter", { name: "Spent today" })).toBeHidden()
  })

  test("its history starts with its first rules, in force", async ({ page, funded: _funded }) => {
    await createAgent(page)

    const history = page.getByRole("region", { name: "History" }).getByRole("listitem")
    await expect(history).toHaveText([
      new RegExp(`^Locked ${dayFromNow(0)} by you, until ${dayFromNow(90)}\\s*In force\\s*Its first rules\\.$`)
    ])
  })

  test("a draft's page says it isn't locked, without usage or history", async ({ page, authenticator, funded: _ }) => {
    await createDraft(page, authenticator, { name: "Draft page" })

    await expect(page.getByText("It can't trade until you lock its rules with Face ID. Nothing has been sent to Base."))
      .toBeVisible()
    await expect(statePill(page)).toContainText("Not locked yet")
    await expect(page.getByRole("heading", { name: "The rules it will lock" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Usage" })).toBeHidden()
    await expect(page.getByRole("region", { name: "History" })).toBeHidden()
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeHidden()
  })

  test("a draft is locked from its page with Face ID", async ({ page, authenticator, funded: _ }) => {
    await createDraft(page, authenticator, { name: "Lock later" })

    await page.getByRole("button", { name: "Lock with Face ID" }).click()

    await expect(statePill(page)).toContainText("Active")
    await expect(page.getByText("Lock later isn't locked yet")).toBeHidden()
  })

  test("the breadcrumb leads back to the agents", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Crumbs" })

    await page.getByRole("main").getByRole("link", { name: "Agents" }).click()

    await expect(page).toHaveURL(/\/agents$/)
  })

  test("an agent id that no agent has is not found", async ({ page, user: _user }) => {
    await page.goto("/agents/agent_01jd8v4t5m6n7a8q9r0s1t2v3w")

    await expect(page.getByRole("heading", { name: "Agent not found", level: 1 })).toBeVisible()
    await expect(page.getByText("We can't find that agent")).toBeVisible()
    await expect(page.getByText("It may belong to another account, or the link is wrong.")).toBeVisible()
    await page.getByRole("link", { name: "See your agents" }).click()
    await expect(page).toHaveURL(/\/agents$/)
  })

  test("a malformed agent id is not found", async ({ page, user: _user }) => {
    await page.goto("/agents/not-an-agent")

    await expect(page.getByText("We can't find that agent")).toBeVisible()
  })

  test("another account's agent is not found", async ({ page, browser, funded: _funded }) => {
    const { id } = await createAgent(page)
    const other = await browser.newContext()
    const otherPage = await other.newPage()
    await addAuthenticator(otherPage)
    await signUp(otherPage)

    await otherPage.goto(`/agents/${id}`)

    await expect(otherPage.getByText("We can't find that agent")).toBeVisible()
    await other.close()
  })
})
