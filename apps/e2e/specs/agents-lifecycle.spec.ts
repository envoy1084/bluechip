import { expect, test } from "../fixtures/test.ts"
import { createAgent, createDraft, dayFromNow, daysFromNow, statePill } from "../utils/agents.ts"

test.describe("pause and resume", () => {
  test("Pause stops it in place: paused pill, Resume where Pause was, no trading", async ({ page, funded: _ }) => {
    await createAgent(page, { name: "Pausable" })

    await page.getByRole("button", { name: "Pause", exact: true }).click()

    await expect(statePill(page)).toContainText("Paused")
    await expect(page.getByText("It won't trade until you resume it. Nothing was sold.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeFocused()
    await expect(page.getByRole("region", { name: "Trade with this agent" })).toBeHidden()
  })

  test("Resume starts it again", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Resumable" })
    await page.getByRole("button", { name: "Pause", exact: true }).click()
    await expect(statePill(page)).toContainText("Paused")

    await page.getByRole("button", { name: "Resume", exact: true }).click()

    await expect(statePill(page)).toContainText("Active")
    await expect(page.getByText("It won't trade until you resume it. Nothing was sold.")).toBeHidden()
    await expect(page.getByRole("region", { name: "Trade with this agent" })).toBeVisible()
  })

  test("a paused agent's card says it's paused", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Paused card" })
    await page.getByRole("button", { name: "Pause", exact: true }).click()
    await expect(statePill(page)).toContainText("Paused")

    await page.goto("/agents")

    await expect(page.getByRole("link", { name: /^Paused card / })).toContainText("Paused cardPaused")
  })
})

test.describe("pause all", () => {
  test("with no agents there is nothing to pause", async ({ page, user: _user }) => {
    await page.goto("/settings")

    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Danger zone" })).toBeHidden()
    await expect(page.getByRole("button", { name: "Pause all agents" })).toBeHidden()
  })

  test("the sidebar's Pause all agents pauses every agent", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "One of two" })
    await createAgent(page, { name: "Two of two", stocks: ["AAPL Apple"] })

    await page.getByRole("button", { name: "Pause all agents" }).click()

    await expect(page.getByRole("button", { name: "Resume all agents" })).toBeFocused()
    await expect(page.getByText("Paused 2 agents")).toBeVisible()
    await page.goto("/agents")
    await expect(page.getByRole("link", { name: /^One of two / })).toContainText("Paused")
    await expect(page.getByRole("link", { name: /^Two of two / })).toContainText("Paused")
  })

  test("the sidebar's Resume all agents resumes every agent", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Sleeper" })
    await page.getByRole("button", { name: "Pause all agents" }).click()

    await page.getByRole("button", { name: "Resume all agents" }).click()

    await expect(page.getByRole("button", { name: "Pause all agents" })).toBeVisible()
    await expect(statePill(page)).toContainText("Active")
  })

  test("Settings' danger zone pauses every agent and resumes them", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Settled" })
    await page.getByRole("link", { name: "Settings" }).click()
    const zone = page.getByRole("main")
    await expect(zone.getByText("They stop right away. Nothing is sold. Resume them any time.")).toBeVisible()

    await zone.getByRole("button", { name: "Pause all" }).click()

    await expect(zone.getByText("Every agent is paused. None of them can trade until you resume them.")).toBeVisible()
    await zone.getByRole("button", { name: "Resume all" }).click()
    await expect(zone.getByText("They stop right away. Nothing is sold. Resume them any time.")).toBeVisible()
  })
})

test.describe("renew", () => {
  test("Renew locks the same rules for another 90 days", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Renewed" })

    await page.getByRole("button", { name: "Renew", exact: true }).click()

    const history = page.getByRole("region", { name: "Its rules over time" }).locator("li")
    await expect(history).toHaveText([
      new RegExp(`^Locked ${dayFromNow(0)} by you, until ${dayFromNow(90)}\\s*In force\\s*The same rules, renewed\\.$`),
      /Replaced\s*Its first rules\.$/
    ])
    await expect(statePill(page)).toContainText("Active")
  })

  test("a cancelled Face ID renews nothing and says so", async ({ page, authenticator, funded: _ }) => {
    await createAgent(page, { name: "Not renewed" })
    await authenticator.setVerified(false)

    await page.getByRole("button", { name: "Renew", exact: true }).click()

    await expect(page.getByRole("alert")).toHaveText(
      "You cancelled Face ID. Nothing changed."
    )
    await expect(page.getByRole("region", { name: "Its rules over time" }).locator("li")).toHaveCount(1)
  })
})

test.describe("remove", () => {
  test("Keep agent closes the question", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Kept" })
    await page.getByRole("button", { name: "Remove", exact: true }).click()

    await page.getByRole("button", { name: "Keep agent" }).click()

    await expect(page.getByRole("region", { name: "Remove Kept?" })).toBeHidden()
    await expect(statePill(page)).toContainText("Active")
  })

  test("a draft is removed at once and leaves the list", async ({ page, authenticator, funded: _ }) => {
    await createDraft(page, authenticator, { name: "Throwaway" })
    await page.getByRole("button", { name: "Remove", exact: true }).click()

    const confirm = page.getByRole("region", { name: "Remove Throwaway?" })
    await expect(confirm).toContainText("It was never locked, so it never traded. Nothing changes in your account.")
    await confirm.getByRole("button", { name: "Remove agent" }).click()

    await expect(page).toHaveURL(/\/agents$/)
    await expect(page.getByText("No agents yet")).toBeVisible()
  })

  test("a live agent is removed with Face ID and leaves the list and sidebar", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Goner" })
    await createAgent(page, { name: "Stayer", stocks: ["AAPL Apple"] })
    await page.getByRole("complementary", { name: "App navigation" }).getByRole("link", { name: "Goner" }).click()
    await page.getByRole("button", { name: "Remove", exact: true }).click()

    const confirm = page.getByRole("region", { name: "Remove Goner?" })
    await expect(confirm).toContainText(
      "It stops right away and can never trade again, and its automations are deleted with it. Your stocks and cash stay in your account; nothing is sold. Its history stays here."
    )
    await confirm.getByRole("button", { name: "Remove agent" }).click()

    await expect(page).toHaveURL(/\/agents$/)
    await expect(page.getByRole("link", { name: /^Stayer / })).toBeVisible()
    await expect(page.getByRole("link", { name: /^Goner / })).toBeHidden()
    const sidebar = page.getByRole("complementary", { name: "App navigation" })
    await expect(sidebar.getByRole("link", { name: "Goner" })).toBeHidden()
  })

  test("a removed agent's page keeps its history, read only", async ({ page, funded: _funded }) => {
    const { id } = await createAgent(page, { name: "Archived" })
    await page.getByRole("button", { name: "Remove", exact: true }).click()
    await page.getByRole("button", { name: "Remove agent" }).click()
    await expect(page).toHaveURL(/\/agents$/)

    await page.goto(`/agents/${id}`)

    await expect(page.getByText("Archived was removed")).toBeVisible()
    await expect(
      page.getByText(
        "It can never trade again. This page keeps its history, read only. Your stocks and cash stayed in your account."
      )
    ).toBeVisible()
    await expect(statePill(page)).toContainText("Removed")
    await expect(page.getByRole("heading", { name: "The rules it had" })).toBeVisible()
    await expect(page.getByText("Removed, so these rules no longer apply")).toBeVisible()
    await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeHidden()
  })

  test("a cancelled Face ID keeps the agent and says so", async ({ page, authenticator, funded: _ }) => {
    await createAgent(page, { name: "Survivor" })
    await page.getByRole("button", { name: "Remove", exact: true }).click()
    await authenticator.setVerified(false)

    await page.getByRole("button", { name: "Remove agent" }).click()

    await expect(page.getByRole("region", { name: "Remove Survivor?" }).getByRole("alert")).toHaveText(
      "You cancelled Face ID. Nothing changed."
    )
    await expect(statePill(page)).toContainText("Active")
  })
})

test.describe("expired", () => {
  // The expiry cron runs as if a day had passed after the session's end: 90 days, plus one.
  const ended = dayFromNow(90)

  test("its page says its rules ran out and offers Renew", async ({ page, funded }) => {
    await createAgent(page, { name: "Ran out" })

    await funded.expireAgents(page, daysFromNow(91))
    await page.reload()

    await expect(statePill(page)).toContainText("Ran out")
    await expect(page.getByText(`Its rules ran out on ${ended}`)).toBeVisible()
    await expect(
      page.getByText("Ran out stopped trading. Renew it with Face ID to keep it running with the same rules.")
    ).toBeVisible()
    await expect(page.getByText(/^Stock picker template, created /)).toHaveText(
      `Stock picker template, created ${dayFromNow(0)}, ran out on ${ended}`
    )
    await expect(page.getByText(`Ran out on ${ended}. Renew it to keep these rules`)).toBeVisible()
    await expect(page.getByRole("button", { name: "Edit rules" })).toBeHidden()
    await expect(page.getByRole("region", { name: "Its rules over time" }).locator("li")).toHaveText([
      /Ran out\s*Its first rules\.$/
    ])
  })

  test("its card says it ran out and offers Renew", async ({ page, funded }) => {
    await createAgent(page, { name: "Card ran out" })
    await funded.expireAgents(page, daysFromNow(91))

    await page.goto("/agents")

    await expect(page.getByRole("link", { name: /^Card ran out / })).toHaveText(
      new RegExp(`^Card ran out\\s*(Ran out)+\\s*Buys and sells.*Ran out on ${ended}$`)
    )
    await expect(page.getByRole("main").getByRole("button", { name: "Renew", exact: true })).toBeVisible()
  })

  test("its rules can't be edited until it's renewed", async ({ page, funded }) => {
    const { id } = await createAgent(page, { name: "No edits" })
    await funded.expireAgents(page, daysFromNow(91))

    await page.goto(`/agents/${id}/edit`)

    await expect(page.getByRole("heading", { name: "Its rules ran out" })).toBeVisible()
    await expect(
      page.getByText(
        "Its session ended, so it can't trade. Renew it with Face ID first, then you can change its rules."
      )
    ).toBeVisible()
  })

  test("renewing from its page makes it active again", async ({ page, funded }) => {
    await createAgent(page, { name: "Back again" })
    await funded.expireAgents(page, daysFromNow(91))
    await page.reload()

    await page.getByRole("status").filter({ hasText: "Its rules ran out" }).getByRole("button", {
      name: "Renew",
      exact: true
    })
      .click()

    await expect(statePill(page)).toContainText("Active")
    await expect(page.getByText(`Its rules ran out on ${ended}`)).toBeHidden()
    await expect(page.getByText(`Locked with Face ID until ${dayFromNow(90)}`)).toBeVisible()
  })

  test("renewing from its card makes it active again", async ({ page, funded }) => {
    await createAgent(page, { name: "Card renew" })
    await funded.expireAgents(page, daysFromNow(91))
    await page.goto("/agents")

    await page.getByRole("main").getByRole("button", { name: "Renew", exact: true }).click()

    await expect(page.getByRole("link", { name: /^Card renew / })).toContainText("Card renewActive")
    await expect(page.getByRole("main").getByRole("button", { name: "Renew", exact: true })).toBeHidden()
  })

  test("a cancelled Face ID leaves it expired and says so", async ({ page, authenticator, funded }) => {
    await createAgent(page, { name: "Still out" })
    await funded.expireAgents(page, daysFromNow(91))
    await page.reload()
    await authenticator.setVerified(false)

    await page.getByRole("status").filter({ hasText: "Its rules ran out" }).getByRole("button", {
      name: "Renew",
      exact: true
    })
      .click()

    await expect(page.getByRole("status").getByRole("alert")).toHaveText(
      "You cancelled Face ID. Nothing changed."
    )
    await expect(statePill(page)).toContainText("Ran out")
  })
})
