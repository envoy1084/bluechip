import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { saveOwn, sentence, WEEKLY } from "../utils/automations.ts"

test.describe("automations list", () => {
  test("with none, it says what they do and offers a new one", async ({ page, user: _user }) => {
    await page.getByRole("complementary", { name: "App navigation" }).getByRole("link", { name: "Automations" })
      .click()

    await expect(page.getByRole("heading", { name: "No automations yet" })).toBeVisible()
    await page.getByRole("main").getByRole("link", { name: "New automation" }).last().click()
    await expect(page).toHaveURL(/\/automations\/new$/)
  })

  test("with none, an example starts a new one on its trigger", async ({ page, user: _user }) => {
    await page.goto("/automations")

    await page.getByRole("list", { name: "What can start one" }).getByRole("link", { name: /^Price move/ }).click()

    await expect(page).toHaveURL(/\/automations\/new\?trigger=priceMove$/)
    await expect(sentence(page)).toHaveText(/^When .+ falls 10% from its high, buy \$50 of .+\.$/)
  })

  test("your own automations are listed with their sentence, as yours", async ({ page, user: _user }) => {
    await saveOwn(page, "Monday buy")

    await page.goto("/automations")

    const list = page.getByRole("list", { name: "Automations" })
    await expect(list.getByRole("link", { name: /^Monday buy Active .*You, with Face ID/ })).toBeVisible()
    await expect(list.getByRole("link", { name: /^Monday buy / })).toContainText(
      /Next run \w{3} \d+ \w{3}, \d{2}:\d{2} your time, (in \d+ (days|h|min)|tomorrow|now)/
    )
  })

  test("the overview counts what's running, with no filters for so few", async ({ page, user: _user }) => {
    await saveOwn(page, "Counted buy")

    await page.goto("/automations")

    await expect(page.getByRole("region", { name: "Overview" })).toContainText("1 automation watching for you")
    await expect(page.getByRole("tab", { name: /^Needs attention/ })).toBeHidden()
  })

  test("Pause on its row pauses it there", async ({ page, user: _user }) => {
    await saveOwn(page, "Row pause")

    await page.goto("/automations")
    await page.getByRole("button", { name: "Pause Row pause" }).click()

    await expect(page.getByRole("link", { name: /^Row pause Paused / })).toBeVisible()
    await expect(page.getByRole("button", { name: "Resume Row pause" })).toBeVisible()
  })
})

test.describe("automation editor", () => {
  test("a new one starts as a weekly buy, read back in a sentence, through you", async ({ page, user: _user }) => {
    await page.goto("/automations/new")

    await expect(sentence(page)).toHaveText(WEEKLY)
    await expect(page.getByRole("combobox", { name: "Trades through" })).toHaveText("You, with Face ID for each trade")
    await expect(page.getByRole("button", { name: "Save automation" })).toBeEnabled()
  })

  test("its settings stay folded until opened", async ({ page, user: _user }) => {
    await page.goto("/automations/new")

    await expect(page.getByRole("switch", { name: "Quiet hours" })).toBeHidden()
    await page.getByRole("button", { name: /^More settings/ }).click()
    await expect(page.getByRole("switch", { name: "Quiet hours" })).toBeVisible()
  })

  test("a price trigger reads back as a fall from its high", async ({ page, user: _user }) => {
    await page.goto("/automations/new")

    await page.getByRole("radiogroup", { name: "Trigger" }).getByRole("radio", { name: /^Price move/ }).click()

    await expect(sentence(page)).toHaveText(/^When .+ falls 10% from its high, buy \$50 of .+\.$/)
  })

  test("a condition joins the sentence, and goes with Remove", async ({ page, user: _user }) => {
    await page.goto("/automations/new")

    await page.getByRole("button", { name: "Add the check Market open" }).click()
    await expect(sentence(page)).toHaveText(/^Every Monday at 10:00 New York time, while the market is open, buy/)
    await page.getByRole("button", { name: "Remove condition 1" }).click()

    await expect(sentence(page)).toHaveText(WEEKLY)
  })

  test("a buy of no stock can't be saved, and says why", async ({ page, user: _user }) => {
    await page.goto("/automations/new")
    await expect(sentence(page)).toHaveText(WEEKLY)

    await page.getByRole("region", { name: "Then" }).getByRole("button", { pressed: true }).click()

    await expect(page.getByRole("alert").filter({ hasText: "It can't run yet" })).toContainText(
      "Then: Pick at least one stock."
    )
    await expect(page.getByRole("button", { name: "Save automation" })).toBeDisabled()
  })

  test("an idea fills in every step", async ({ page, user: _user }) => {
    await page.goto("/automations/new")

    await page.getByRole("radiogroup", { name: "Start from an idea" }).getByRole("radio", { name: /^Stop-loss/ })
      .click()

    await expect(sentence(page)).toHaveText(/^When .+ falls 10% from its high, sell all your .+\.$/)
    await expect(page.getByRole("radiogroup", { name: "Trigger" }).getByRole("radio", { name: /^Price move/ }))
      .toBeChecked()
  })

  test("a check is added from the menu, grouped by what it reads", async ({ page, user: _user }) => {
    await page.goto("/automations/new")

    await page.getByRole("button", { name: "More checks" }).click()
    await page.getByRole("menuitem", { name: /^Time window/ }).click()

    await expect(page.getByRole("region", { name: "Condition 1" })).toContainText("Time window")
  })

  test("a message with nothing to say can't be saved", async ({ page, user: _user }) => {
    await page.goto("/automations/new")

    await page.getByRole("radiogroup", { name: "Action" }).getByRole("radio", { name: /^Tell me/ }).click()

    await expect(page.getByRole("alert").filter({ hasText: "It can't run yet" })).toContainText(
      "Then: Write what to tell you."
    )
    await expect(page.getByRole("button", { name: "Save automation" })).toBeDisabled()
  })

  test("an edit is saved under its new name", async ({ page, user: _user }) => {
    await saveOwn(page, "Before the edit")

    await page.getByRole("button", { name: "Edit", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: "Edit Before the edit" })
    await sheet.getByRole("textbox", { name: "Name" }).fill("After the edit")
    await sheet.getByRole("button", { name: "Save changes" }).click()

    await expect(sheet).toBeHidden()

    await expect(page.getByRole("heading", { level: 1, name: "After the edit" })).toBeVisible()
  })
})

test.describe("automation page", () => {
  test("a new one says what it does, who trades, and that it hasn't run", async ({ page, user: _user }) => {
    await saveOwn(page, "Fresh one")

    const about = page.getByRole("region", { name: "What it does" })
    await expect(about).toContainText("Active")
    await expect(sentence(page)).toHaveText(WEEKLY)
    await expect(about).toContainText("You, with Face ID for each trade")
    await expect(about).toContainText("RanNot yet")
    await expect(about).toContainText("You set it up")
    await expect(page.getByText(/^No runs yet\.$/)).toBeVisible()
  })

  test("Pause stops it, and Resume starts it again", async ({ page, user: _user }) => {
    await saveOwn(page, "Pause me")

    await page.getByRole("button", { name: "Pause", exact: true }).click()
    await expect(page.getByRole("region", { name: "What it does" })).toContainText("Paused")
    await page.getByRole("button", { name: "Resume", exact: true }).click()

    await expect(page.getByRole("region", { name: "What it does" })).toContainText("Active")
  })

  test("Delete asks first, then it leaves your list", async ({ page, user: _user }) => {
    await saveOwn(page, "Delete me")

    await page.getByRole("button", { name: "Delete", exact: true }).click()
    const confirm = page.getByRole("alertdialog", { name: "Delete “Delete me”?" })
    await confirm.getByRole("button", { name: "Delete automation" }).click()

    await expect(page).toHaveURL(/\/automations$/)
    await expect(page.getByRole("heading", { name: "No automations yet" })).toBeVisible()
  })

  test("Keep it leaves it as it was", async ({ page, user: _user }) => {
    await saveOwn(page, "Keep me")

    await page.getByRole("button", { name: "Delete", exact: true }).click()
    await page.getByRole("button", { name: "Keep it" }).click()

    await expect(page.getByRole("heading", { level: 1, name: "Keep me" })).toBeVisible()
  })

  test("an id no automation has shows the not-found screen", async ({ page, user: _user }) => {
    await page.goto("/automations/automation_01jd8v4t5m6n7a8q9r0s1t2v3w")

    await expect(page.getByRole("heading", { name: "We can't find that automation" })).toBeVisible()
  })
})

test.describe("an agent's automations", () => {
  test("its page has none yet, and New automation trades through it", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Auto picker" })
    await page.getByRole("main").getByRole("link", { name: "Automations", exact: true }).click()

    const section = page.getByRole("region", { name: "Automations", exact: true })
    await expect(section.getByRole("heading", { name: "No automations yet" })).toBeVisible()
    await section.getByRole("link", { name: "New automation" }).first().click()

    await expect(page.getByRole("combobox", { name: "Trades through" })).toHaveText("Auto picker")
    await expect(sentence(page)).toHaveText(/^Every Monday at 10:00 New York time, buy \$50 of NVIDIA\.$/)
  })

  test("one saved for it is listed on its page and with its name", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Listed picker" })
    await page.getByRole("main").getByRole("link", { name: "Automations", exact: true }).click()
    await page.getByRole("region", { name: "Automations", exact: true }).getByRole("link", { name: "New automation" })
      .first().click()
    await page.getByRole("textbox", { name: "Name" }).fill("Picker's Monday")
    await page.getByRole("button", { name: "Save automation" }).click()
    await expect(page).toHaveURL(/\/automations\/automation_[0-9a-z]+$/)

    await page.getByRole("main").getByRole("link", { name: "Listed picker", exact: true }).click()
    await page.getByRole("main").getByRole("link", { name: "Automations", exact: true }).click()
    await expect(
      page.getByRole("region", { name: "Automations", exact: true }).getByRole("link", { name: /^Picker's Monday / })
    ).toBeVisible()
    await page.goto("/automations")
    // Under four automations the list has no filters: each row names who trades.
    await expect(
      page.getByRole("list", { name: "Automations" }).getByRole("link", { name: /^Picker's Monday .*Listed picker/ })
    ).toBeVisible()
  })

  test("a Weekly buyer's review shows its weekly buy, and Done lists it saved", async ({ page, funded: _funded }) => {
    await page.goto("/agents/new")
    await page.getByRole("radio", { name: /^Weekly buyer/ }).click()
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    const defaults = page.getByRole("region", { name: "Automations" })
    await expect(defaults.getByRole("switch", { name: "Keep Weekly buy of NVDA" })).toBeChecked()
    await expect(defaults).toContainText("Every Monday at 10:00 New York time, buy")
    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    const saved = page.getByRole("list", { name: "Its automations" })
    await expect(saved.getByRole("link", { name: "Weekly buy of NVDA" })).toBeVisible()
  })

  test("a default switched off isn't saved", async ({ page, funded: _funded }) => {
    await page.goto("/agents/new")
    await page.getByRole("radio", { name: /^Weekly buyer/ }).click()
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("switch", { name: "Keep Weekly buy of NVDA" }).click()
    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    await expect(page.getByRole("heading", { name: / is live$/ })).toBeVisible()
    await expect(page.getByRole("list", { name: "Its automations" })).toBeHidden()
  })

  test("a default changed on the review is saved as changed", async ({ page, funded: _funded }) => {
    await page.goto("/agents/new")
    await page.getByRole("radio", { name: /^Weekly buyer/ }).click()
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("button", { name: "Change Weekly buy of NVDA" }).click()
    const sheet = page.getByRole("dialog", { name: "Change Weekly buy of NVDA" })
    await sheet.getByRole("textbox", { name: "Name" }).fill("Friday NVDA")
    await sheet.getByRole("button", { name: "Keep these changes" }).click()
    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()

    await expect(page.getByRole("list", { name: "Its automations" }).getByRole("link", { name: "Friday NVDA" }))
      .toBeVisible()
  })
})
