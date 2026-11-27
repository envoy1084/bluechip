import { expect, test } from "../fixtures/test.ts"
import { createAgent, dayFromNow, openFineTuning, openRule, setFloors, startAgent } from "../utils/agents.ts"

test.describe("new agent: template step", () => {
  test("it offers the four templates and scratch, the Stock picker first", async ({ page, user: _user }) => {
    await page.goto("/agents/new")

    await expect(page.getByRole("heading", { name: "What should your agent do?" })).toBeVisible()
    await expect(page.getByRole("radiogroup", { name: "Agent templates" })).toMatchAriaSnapshot(`
      - radiogroup "Agent templates":
        - radio "Stock picker"
        - radio "Weekly buyer"
        - radio "Stop-loss guard"
        - radio "Rebalancer"
        - radio "Start from scratch"
    `)
    await expect(page.getByRole("radio", { name: "Stock picker" })).toBeChecked()
    await expect(page.getByRole("radio", { name: "Weekly buyer" })).toHaveAccessibleDescription(
      "Buys the stocks you pick on a schedule."
    )
  })

  test("Cancel goes back to the agents", async ({ page, user: _user }) => {
    await page.goto("/agents/new")

    await page.getByRole("link", { name: "Cancel" }).click()

    await expect(page).toHaveURL(/\/agents$/)
    await expect(page.getByText("No agents yet")).toBeVisible()
  })

  test("Back from the rules returns to the template it started from", async ({ page, user: _user }) => {
    await startAgent(page, "Weekly buyer")

    await page.getByRole("button", { name: "Back", exact: true }).click()

    await expect(page.getByRole("radio", { name: "Weekly buyer" })).toBeChecked()
  })
})

test.describe("new agent: from each template to live", () => {
  test("a Rebalancer of NVIDIA and Apple is live", async ({ page, funded: _funded }) => {
    await startAgent(page, "Rebalancer")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "Rebalancer is live" })).toBeVisible()
    await expect(page.getByText(`Locked with Face ID until ${dayFromNow(90)}. Pause it any time.`)).toBeVisible()
    await expect(page.getByRole("list", { name: "It can" }).getByRole("listitem").first()).toHaveText(
      "Trade Apple and NVIDIA, only to move you back to your target mix"
    )
  })

  test("a Stock picker of NVIDIA is live", async ({ page, funded: _funded }) => {
    await createAgent(page, { template: "Stock picker" })

    await expect(page.getByRole("heading", { name: "Stock picker", level: 2 })).toBeVisible()
    const glance = page.getByRole("region", { name: "Its rules at a glance" })
    await expect(glance).toContainText("Buys and sells")
    await expect(glance.getByRole("list", { name: "Its stocks" }).getByRole("listitem")).toHaveText(["NVDA"])
  })

  test("a Weekly buyer of Tesla is live", async ({ page, funded: _funded }) => {
    await startAgent(page, "Weekly buyer")
    await page.getByRole("button", { name: "TSLA Tesla" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "Weekly buyer is live" })).toBeVisible()
    await expect(page.getByRole("list", { name: "It can" }).getByRole("listitem").first()).toHaveText("Buy Tesla")
  })

  test("a Weekly buyer of two stocks starts both of its automations", async ({ page, funded: _funded }) => {
    await startAgent(page, "Weekly buyer")
    await page.getByRole("button", { name: "AMZN Amazon" }).click()
    await page.getByRole("button", { name: "GOOGL Alphabet" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    const saved = page.getByRole("list", { name: "Its automations" })
    await expect(saved.getByRole("link", { name: "Weekly buy of AMZN" })).toBeVisible()
    await expect(saved.getByRole("link", { name: "Weekly buy of GOOGL" })).toBeVisible()
  })

  test("a Stop-loss guard of Apple is live", async ({ page, funded: _funded }) => {
    await startAgent(page, "Stop-loss guard")
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await setFloors(page, ["AAPL Apple"])
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "Stop-loss guard is live" })).toBeVisible()
    await expect(page.getByRole("list", { name: "It can" }).getByRole("listitem").first()).toHaveText("Sell Apple")
  })

  test("an agent from scratch of Microsoft is live, called a custom agent", async ({ page, funded: _funded }) => {
    await startAgent(page, "Start from scratch")
    await page.getByRole("button", { name: "MSFT Microsoft" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Custom agent")
    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "Custom agent is live" })).toBeVisible()
    await expect(page.getByRole("list", { name: "It can" }).getByRole("listitem").first()).toHaveText(
      "Buy and sell Microsoft"
    )
  })

  test("Done: See all agents opens the list with the new agent", async ({ page, funded: _funded }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "Review" }).click()
    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()
    await expect(page.getByRole("heading", { name: "Stock picker is live" })).toBeVisible()

    await page.getByRole("link", { name: "See all agents" }).click()

    await expect(page).toHaveURL(/\/agents$/)
    await expect(page.getByRole("link", { name: /^Stock picker Active / })).toBeVisible()
  })

  test("Done: Go to opens the agent's page", async ({ page, funded: _funded }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "Review" }).click()
    await page.getByRole("textbox", { name: "Name" }).fill("Chip trader")
    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    await page.getByRole("link", { name: "Go to Chip trader" }).click()

    await expect(page).toHaveURL(/\/agents\/agent_[0-9a-z]+$/)
    await expect(page.getByRole("heading", { name: "Chip trader", level: 2 })).toBeVisible()
  })
})

test.describe("new agent: review", () => {
  test("the worst case of a Stock picker is its budget and its trade size", async ({ page, user: _ }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()

    await page.getByRole("button", { name: "Review" }).click()

    await expect(page.getByText("The worst case")).toBeVisible()
    await expect(page.getByText(/^On its worst day/)).toHaveText(
      "On its worst day, this agent could spend at most $250 on buys, up to $100 a trade, only in NVIDIA. It can never move money out of your account."
    )
  })

  test("the worst case counts its trades when they are a limit of its own", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await openFineTuning(page)
    await openRule(page, "Trades a day")
    await page.getByRole("textbox", { name: "Trades a day" }).fill("3")

    await page.getByRole("button", { name: "Review" }).click()

    await expect(page.getByText(/^On its worst day/)).toHaveText(
      "On its worst day, this agent could spend at most $250 on buys, up to $100 a trade, in at most 3 trades, only in NVIDIA. It can never move money out of your account."
    )
  })

  test("the worst case of a Stop-loss guard spends nothing", async ({ page, user: _user }) => {
    await startAgent(page, "Stop-loss guard")
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await setFloors(page, ["AAPL Apple"])

    await page.getByRole("button", { name: "Review" }).click()

    await expect(page.getByText(/^On its worst day/)).toHaveText(
      "On its worst day, this agent could sell up to $100 a trade, only in Apple. It never buys, and it can never move money out of your account."
    )
  })

  test("it runs for 90 days and asks before trades over its limit", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask you above" }).fill("60")

    await page.getByRole("button", { name: "Review" }).click()

    // The rules at a glance's three numbers come first.
    await expect(page.getByRole("term")).toHaveText([
      "A day",
      "Per trade",
      "Trades a day",
      "Runs for",
      "Asks you",
      "You can"
    ])
    await expect(page.getByRole("definition")).toHaveText([
      "$250",
      "$60",
      "No limit",
      `90 days, until ${dayFromNow(90)}`,
      "Before trades over $60",
      "Pause it any time, instantly"
    ])
  })

  test("a Rebalancer's review shows its target mix", async ({ page, user: _user }) => {
    await startAgent(page, "Rebalancer")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await openRule(page, "Target mix")
    await page.getByRole("textbox", { name: "Apple target, percent" }).fill("20")

    await page.getByRole("button", { name: "Review" }).click()

    await expect(page.getByText("Target mix", { exact: true }).locator("xpath=..")).toHaveText(
      /^Target mix\s*AAPL\s*20%\s*NVDA\s*30%\s*USDC\s*50%$/
    )
  })

  test("renaming it renames the draft and the live agent", async ({ page, funded: _funded }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("textbox", { name: "Name" }).fill("Nvidia swing")

    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()
    await expect(page.getByRole("heading", { name: "Nvidia swing is live" })).toBeVisible()
  })

  test("an empty name can't be locked", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("textbox", { name: "Name" }).fill("  ")

    await expect(page.getByText("Give it a name.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Lock these rules with Face ID" })).toBeDisabled()
  })

  test("Back to rules goes back to the rules as they were set", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("textbox", { name: "Daily budget" }).fill("400")
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("button", { name: "Back to rules" }).click()

    await expect(page.getByRole("heading", { name: "Its limits" })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("400")
    await expect(page.getByRole("button", { name: "NVDA NVIDIA" })).toHaveAttribute("aria-pressed", "true")
  })
})

test.describe("new agent: lock with Face ID", () => {
  test("a cancelled Face ID keeps it as a draft, and trying again locks it", async ({ page, authenticator, funded: _ }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "Review" }).click()
    await authenticator.setVerified(false)

    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    await expect(page.getByRole("alert")).toHaveText(
      "You cancelled Face ID. Nothing changed."
    )
    await expect(page.getByText("Face ID didn't work. Try again.")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Name" })).toBeDisabled()
    await expect(page.getByText("Saved with its draft. Edit the rules to change it.")).toBeVisible()

    await authenticator.setVerified(true)
    await page.getByRole("button", { name: "Try Face ID again" }).click()
    await expect(page.getByRole("heading", { name: "Stock picker is live" })).toBeVisible()
  })

  test("going back to the rules after a cancelled Face ID sets the draft aside", async ({ page, authenticator, funded: _ }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "Review" }).click()
    await authenticator.setVerified(false)
    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()
    await expect(page.getByText("Face ID didn't work. Try again.")).toBeVisible()

    await page.getByRole("button", { name: "Back to rules" }).click()

    await expect(page.getByRole("heading", { name: "Its limits" })).toBeVisible()
    await page.getByRole("button", { name: "Review" }).click()
    await expect(page.getByRole("textbox", { name: "Name" })).toBeEnabled()
    await page.goto("/agents")
    await expect(page.getByText("No agents yet")).toBeVisible()
  })
})
