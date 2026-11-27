import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { canRules, glanceNumbers, neverRules, openFineTuning, openRule, ruleRow, startAgent } from "../utils/agents.ts"

// A Stock picker of NVIDIA at its balanced preset, as the rules at a glance read it back: its three numbers above, then
// what its other rules let it do and its own limits (what every agent can never do is said once, below).
const NUMBERS = ["$250", "$100", "No limit"]
const CAN = ["Trade on weekends and holidays, with a tighter price limit", "Spend up to 0.038 ETH on gas a day"]
const NEVER = [
  "Never trade more than 1% away from Chainlink's price",
  "Never put over 30% of your money in one stock",
  "Never leave less than 10% in cash",
  "Never lose more than 1% of your money to prices in a week"
]

/** The rules step of a Stock picker of NVIDIA. */
const stockPicker = async (page: Page) => {
  await startAgent(page, "Stock picker")
  await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
}

/** The rules step of a Rebalancer of Apple and NVIDIA: 30% each, 40% cash. */
const rebalancer = async (page: Page) => {
  await startAgent(page, "Rebalancer")
  await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
  await page.getByRole("button", { name: "AAPL Apple" }).click()
}

const review = (page: Page) => page.getByRole("button", { name: "Review" })

const glance = (page: Page) => page.getByRole("region", { name: "Its rules at a glance" })

test.describe("rules step: presets", () => {
  for (
    const [template, amounts] of [
      // A rebalance moves a share of everything at once, so its presets have more room.
      ["Rebalancer", [
        "$500 a day $200 per trade 20% max in one",
        "$2,000 a day $500 per trade 30% max in one",
        "$5,000 a day $1,000 per trade 40% max in one"
      ]],
      ["Stock picker", [
        "$100 a day $50 per trade 20% max in one",
        "$250 a day $100 per trade 30% max in one",
        "$1,000 a day $400 per trade 40% max in one"
      ]],
      // The Weekly buyer spends at most $500 a day, so its Active preset is capped there.
      ["Weekly buyer", [
        "$100 a day $50 per trade 20% max in one",
        "$250 a day $100 per trade 30% max in one",
        "$500 a day $400 per trade 40% max in one"
      ]],
      ["Stop-loss guard", ["No buys $50 per trade", "No buys $100 per trade", "No buys $400 per trade"]]
    ] as const
  ) {
    test(`a ${template} offers its three presets, Balanced picked`, async ({ page, user: _user }) => {
      await startAgent(page, template)

      const presets = page.getByRole("radiogroup", { name: "Limit presets" }).getByRole("radio")
      await expect(presets.nth(0)).toHaveAccessibleName(`Conservative Small, careful trades ${amounts[0]}`)
      await expect(presets.nth(1)).toHaveAccessibleName(`Balanced Most people start here ${amounts[1]}`)
      await expect(presets.nth(2)).toHaveAccessibleName(`Active More room, still capped ${amounts[2]}`)
      await expect(presets.nth(1)).toBeChecked()
    })
  }

  test("Conservative sets its amounts", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("radio", { name: /^Conservative/ }).click()

    await expect(glanceNumbers(page)).toHaveText(["$100", "$50", "No limit"])
    await expect(canRules(page)).toHaveText(CAN.with(1, "Spend up to 0.015 ETH on gas a day"))
    await expect(neverRules(page)).toHaveText(
      NEVER.with(1, "Never put over 20% of your money in one stock").with(2, "Never leave less than 20% in cash")
    )
  })

  test("a Weekly buyer's Active preset spends its capped $500 a day", async ({ page, user: _user }) => {
    await startAgent(page, "Weekly buyer")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()

    await page.getByRole("radio", { name: /^Active/ }).click()

    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("500")
    await openRule(page, "Trade size")
    await expect(page.getByRole("textbox", { name: "Ask you above" })).toHaveValue("400")
    await expect(glanceNumbers(page)).toHaveText(["$500", "$400", "No limit"])
  })

  test("an amount changed by hand is custom", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("textbox", { name: "Daily budget" }).fill("300")

    await expect(page.getByText("Custom amounts.")).toBeVisible()
    await expect(page.getByRole("radiogroup", { name: "Limit presets" }).getByRole("radio", { checked: true }))
      .toHaveCount(0)
  })

  test("an agent from scratch has no presets", async ({ page, user: _user }) => {
    await startAgent(page, "Start from scratch")

    await expect(page.getByText("Start from a preset")).toBeHidden()
    await openFineTuning(page)
    await expect(page.getByRole("switch")).toHaveCount(5)
    for (const name of ["Max in one stock", "Cash reserve", "Target mix", "Stop-loss floor", "Weekly slippage"]) {
      await expect(page.getByRole("switch", { name })).not.toBeChecked()
    }
  })
})

test.describe("rules step: the rules it follows", () => {
  test("the rules every agent has carry a lock, not a switch", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openFineTuning(page)

    // Trade size and gas a day, then the fair price and trades a day in the fine-tuning.
    await expect(page.getByRole("img", { name: "Every agent has this rule" })).toHaveCount(4)
  })

  test("each rule reads as what it does now", async ({ page, user: _user }) => {
    await stockPicker(page)

    await expect(ruleRow(page, "Trade size")).toHaveAccessibleName(
      "Trade size Trade up to $100 at a time, and ask you before anything bigger. Edit"
    )
    await expect(ruleRow(page, "Max in one stock")).toHaveAccessibleName(
      "Max in one stock Never put over 30% of your money in one stock. Edit"
    )
    await expect(ruleRow(page, "Gas a day")).toHaveAccessibleName("Gas a day Spend up to 0.038 ETH on gas a day. Edit")
  })

  test("turning off Max in one stock drops its rule and its editor", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("switch", { name: "Max in one stock" }).click()

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(1, 1))
    await expect(page.getByRole("textbox", { name: "Max in one stock" })).toBeHidden()
  })

  test("turning Max in one stock back on brings it back at 30%", async ({ page, user: _user }) => {
    await stockPicker(page)
    await page.getByRole("switch", { name: "Max in one stock" }).click()

    await page.getByRole("switch", { name: "Max in one stock" }).click()

    await expect(neverRules(page)).toHaveText(NEVER)
    await expect(page.getByRole("textbox", { name: "Max in one stock" })).toHaveValue("30")
  })

  test("turning off Cash reserve drops its rule", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("switch", { name: "Cash reserve" }).click()

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(2, 1))
    await expect(page.getByRole("textbox", { name: "Cash reserve" })).toBeHidden()
  })

  test("turning off Weekly slippage drops its rule", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openFineTuning(page)
    await page.getByRole("switch", { name: "Weekly slippage" }).click()

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(3, 1))
  })

  test("adding Max in one stock to an agent from scratch adds its rule at 30%", async ({ page, user: _user }) => {
    await startAgent(page, "Start from scratch")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()

    await page.getByRole("switch", { name: "Max in one stock" }).click()

    await expect(neverRules(page)).toHaveText([
      "Never trade more than 1% away from Chainlink's price",
      "Never put over 30% of your money in one stock"
    ])
  })

  test("turning off a Rebalancer's Target mix makes it buy and sell", async ({ page, user: _user }) => {
    await rebalancer(page)

    await page.getByRole("switch", { name: "Target mix" }).click()

    await expect(page.getByRole("button", { name: "Buy and sell", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(page.getByRole("switch", { name: "Target mix" })).toHaveAccessibleDescription(
      "Turning it on makes it trade only toward your mix."
    )
    await expect(glance(page)).toContainText("Buys and sells")
    await expect(page.getByRole("button", { name: "Split evenly" })).toBeHidden()
  })

  test("turning Target mix back on makes it rebalance again", async ({ page, user: _user }) => {
    await rebalancer(page)
    await page.getByRole("switch", { name: "Target mix" }).click()

    await page.getByRole("switch", { name: "Target mix" }).click()

    await expect(page.getByRole("button", { name: "Rebalance only" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("switch", { name: "Target mix" })).toHaveAccessibleDescription(
      "Turning it off lets it buy and sell freely instead."
    )
    await expect(glance(page)).toContainText("Only rebalances")
    await openRule(page, "Target mix")
    await expect(page.getByRole("textbox", { name: "Apple target, percent" })).toHaveValue("30")
  })

  test("picking Rebalance only turns on Target mix", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("button", { name: "Rebalance only" }).click()

    await expect(page.getByRole("switch", { name: "Target mix" })).toBeChecked()
    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(3, 0, "Never trade away from your target mix"))
    await openRule(page, "Target mix")
    await expect(page.getByRole("textbox", { name: "Nvidia target, percent" })).toHaveValue("30")
  })
})

test.describe("rules step: stocks and direction", () => {
  test("no stock can't be reviewed", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")

    await review(page).click()
    await expect(page.getByText("Pick at least one stock.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })

  test("before a stock, the glance asks for one", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")

    await expect(glance(page).getByText("No stocks yet. Pick the ones it may trade.")).toBeVisible()
  })

  test("each stock picked is a pill at a glance", async ({ page, user: _user }) => {
    await stockPicker(page)

    for (const stock of ["AAPL Apple", "AMZN Amazon", "MSFT Microsoft"]) {
      await page.getByRole("button", { name: stock }).click()
    }

    await expect(glance(page).getByRole("list", { name: "Its stocks" }).getByRole("listitem")).toHaveText([
      "AAPL",
      "AMZN",
      "MSFT",
      "NVDA"
    ])
    await expect(review(page)).toBeEnabled()
  })

  test("Buy only buys", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("button", { name: "Buy only" }).click()

    await expect(
      page.getByRole("button", { name: "About direction: It only ever buys. It can never sell what you hold." })
    )
      .toBeVisible()
    await expect(glance(page)).toContainText("Only buys")
    await expect(glanceNumbers(page)).toHaveText(NUMBERS)
  })

  test("Sell only sells and has no daily budget", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("button", { name: "Sell only" }).click()

    await expect(
      page.getByRole("button", { name: "About direction: It only ever sells, so it never spends your cash." })
    )
      .toBeVisible()
    await expect(page.getByText("It only sells, so it has no daily budget.")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Daily budget" })).toBeHidden()
    await expect(glance(page)).toContainText("Only sells")
    await expect(glanceNumbers(page)).toHaveText(NUMBERS.with(0, "No buys"))
  })

  test("back from Sell only, it buys with the standard $250 a day", async ({ page, user: _user }) => {
    await stockPicker(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("400")
    await page.getByRole("button", { name: "Sell only" }).click()

    await page.getByRole("button", { name: "Buy and sell", exact: true }).click()

    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("250")
    await expect(glanceNumbers(page)).toHaveText(NUMBERS)
  })
})

test.describe("rules step: daily budget", () => {
  test("a typed budget is what it may spend a day", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("textbox", { name: "Daily budget" }).fill("500")

    await expect(glanceNumbers(page)).toHaveText(NUMBERS.with(0, "$500"))
  })

  test("the slider moves it $10 at a time", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("slider", { name: "Daily budget" }).focus()
    await page.keyboard.press("ArrowRight")

    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("260")
    await expect(glanceNumbers(page)).toHaveText(NUMBERS.with(0, "$260"))
  })

  test("$0 for an agent that buys can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("textbox", { name: "Daily budget" }).fill("0")

    await review(page).click()
    await expect(page.getByText("Give it a daily budget to buy with.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })
})

test.describe("rules step: trade size", () => {
  test("Ask you above is the largest trade it makes alone", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask you above" }).fill("70")

    await expect(ruleRow(page, "Trade size")).toHaveAccessibleName(
      "Trade size Trade up to $70 at a time, and ask you before anything bigger. Close"
    )
    await expect(glanceNumbers(page)).toHaveText(NUMBERS.with(1, "$70"))
  })

  test("Ask you above under $10 can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask you above" }).fill("5")

    await review(page).click()
    await expect(page.getByText("At least $10.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })

  test("Ask you above over the daily budget can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask you above" }).fill("300")

    await review(page).click()
    await expect(page.getByText("Can't be more than the daily budget ($250).")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })

  test("a smallest trade over Ask you above can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask you above" }).fill("50")

    await page.getByRole("textbox", { name: "Smallest trade" }).fill("60")

    await review(page).click()
    await expect(page.getByText("Can't be more than the largest trade.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })
})

test.describe("rules step: max in one stock and cash reserve", () => {
  test("a lower max in one stock is its rule", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Max in one stock")
    await page.getByRole("textbox", { name: "Max in one stock" }).fill("20")

    await expect(neverRules(page)).toHaveText(NEVER.with(1, "Never put over 20% of your money in one stock"))
  })

  test("a max in one stock under 5% can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Max in one stock")
    await page.getByRole("textbox", { name: "Max in one stock" }).fill("2")

    await review(page).click()
    await expect(page.getByText("Pick 5% to 100%.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })

  test("a max in one stock of 100% leaves no room for the cash reserve", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Max in one stock")
    await page.getByRole("textbox", { name: "Max in one stock" }).fill("100")

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(1, 1))
    await review(page).click()
    await expect(page.getByText("Cash reserve plus max in one stock can't pass 100%.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })

  test("a larger cash reserve is its rule", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Cash reserve")
    await page.getByRole("textbox", { name: "Cash reserve" }).fill("25")

    await expect(neverRules(page)).toHaveText(NEVER.with(2, "Never leave less than 25% in cash"))
  })

  test("a cash reserve of 0% has no rule", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Cash reserve")
    await page.getByRole("textbox", { name: "Cash reserve" }).fill("0")

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(2, 1))
  })

  test("a cash reserve over 50% can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Cash reserve")
    await page.getByRole("textbox", { name: "Cash reserve" }).fill("60")

    await review(page).click()
    await expect(page.getByText("Pick 0% to 50%.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })
})

test.describe("rules step: target mix", () => {
  test("it starts even within the max in one stock, cash the rest", async ({ page, user: _user }) => {
    await rebalancer(page)

    await openRule(page, "Target mix")
    await expect(page.getByRole("textbox", { name: "Apple target, percent" })).toHaveValue("30")
    await expect(page.getByRole("textbox", { name: "Nvidia target, percent" })).toHaveValue("30")
    await expect(page.getByRole("listitem").filter({ hasText: "Fills the rest" })).toContainText("40%")
    await expect(review(page)).toBeEnabled()
  })

  test("a stock over the max in one stock can't be reviewed", async ({ page, user: _user }) => {
    await rebalancer(page)

    await openRule(page, "Target mix")
    await page.getByRole("textbox", { name: "Apple target, percent" }).fill("40")

    await review(page).click()
    await expect(page.getByText("Over your 30% max in one stock. Agents won't buy past 30%.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })

  test("cash under the cash reserve can't be reviewed", async ({ page, user: _user }) => {
    await rebalancer(page)
    await openRule(page, "Max in one stock")
    await page.getByRole("textbox", { name: "Max in one stock" }).fill("50")

    await openRule(page, "Target mix")
    await page.getByRole("textbox", { name: "Apple target, percent" }).fill("50")
    await page.getByRole("textbox", { name: "Nvidia target, percent" }).fill("45")

    await review(page).click()
    await expect(page.getByText("Below your 10% cash reserve. Agents keep 10% anyway.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })

  test("a stock taken out of the mix asks for its target", async ({ page, user: _user }) => {
    await rebalancer(page)
    await openRule(page, "Target mix")

    await page.getByRole("button", { name: "Remove Nvidia" }).click()

    await review(page).click()
    await expect(page.getByText("Give every stock a target.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })

  test(
    "Split evenly keeps each stock within the max in one stock",
    async ({ page, user: _user }) => {
      await rebalancer(page)
      await openRule(page, "Target mix")
      await page.getByRole("textbox", { name: "Apple target, percent" }).fill("10")

      await page.getByRole("button", { name: "Split evenly" }).click()

      await expect(page.getByRole("textbox", { name: "Apple target, percent" })).toHaveValue("30")
      await expect(page.getByRole("textbox", { name: "Nvidia target, percent" })).toHaveValue("30")
      await expect(review(page)).toBeEnabled()
    }
  )

  test("a wider trigger waits for more drift", async ({ page, user: _user }) => {
    await rebalancer(page)
    await openRule(page, "Target mix")

    await page.getByRole("button", { name: "10%", exact: true }).click()

    await expect(page.getByRole("button", {
      name: "About rebalance when off by: It starts trading once your mix is 10% off target."
    })).toBeVisible()
    await expect(ruleRow(page, "Target mix")).toHaveAccessibleName(
      "Target mix Start rebalancing once your mix is 10% off target. Close"
    )
  })
})

test.describe("rules step: fine-tuning", () => {
  test("Strict price protection is its price rule", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openFineTuning(page)
    await openRule(page, "Fair price")

    await page.getByRole("button", { name: "Strict, 0.5%" }).click()

    await expect(page.getByRole("button", {
      name: "About furthest from chainlink's price: Every trade stays within 0.5% of Chainlink's price."
    })).toBeVisible()
    await expect(neverRules(page)).toHaveText(NEVER.with(0, "Never trade more than 0.5% away from Chainlink's price"))
  })

  test("not trading while prices are paused", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openFineTuning(page)
    await openRule(page, "Fair price")

    await page.getByRole("switch", { name: "Trade while prices are paused" }).click()

    await expect(canRules(page)).toHaveText(CAN.toSpliced(0, 1))
    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(1, 0, "Never trade while prices are paused"))
  })

  test("a Rebalancer may trade while prices are paused", async ({ page, user: _user }) => {
    await rebalancer(page)
    await openFineTuning(page)

    await openRule(page, "Fair price")

    await expect(page.getByRole("switch", { name: "Trade while prices are paused" })).toBeChecked()
  })

  test("a larger weekly slippage is its rule", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openFineTuning(page)
    await openRule(page, "Weekly slippage")

    await page.getByRole("button", { name: "2%", exact: true }).click()

    await expect(neverRules(page)).toHaveText(
      NEVER.with(3, "Never lose more than 2% of your money to prices in a week")
    )
  })

  test("fewer trades a day", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openFineTuning(page)
    await openRule(page, "Trades a day")

    await page.getByRole("textbox", { name: "Trades a day" }).fill("3")

    await expect(glanceNumbers(page)).toHaveText(NUMBERS.with(2, "3"))
    await expect(ruleRow(page, "Trades a day")).toHaveAccessibleName("Trades a day Trade 3 times a day at most. Close")
  })

  test("one trade a day", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openFineTuning(page)
    await openRule(page, "Trades a day")

    await page.getByRole("textbox", { name: "Trades a day" }).fill("1")

    await expect(ruleRow(page, "Trades a day")).toHaveAccessibleName("Trades a day Trade once a day at most. Close")
  })

  test("more than 2000 trades a day can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openFineTuning(page)
    await openRule(page, "Trades a day")

    await page.getByRole("textbox", { name: "Trades a day" }).fill("2001")

    await review(page).click()
    await expect(page.getByText("Pick 1 to 2000.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })
})

test.describe("rules step: gas a day", () => {
  test("a larger gas budget is what it may spend on gas", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openRule(page, "Gas a day")

    await page.getByRole("textbox", { name: "Gas it may spend a day" }).fill("0.1")

    await expect(canRules(page)).toHaveText(CAN.with(1, "Spend up to 0.1 ETH on gas a day"))
  })

  test("more than 1 ETH of gas a day can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openRule(page, "Gas a day")

    await page.getByRole("textbox", { name: "Gas it may spend a day" }).fill("2")

    await review(page).click()
    await expect(page.getByText("Pick 0.001 ETH to 1 ETH.")).toBeVisible()
    await expect(page.getByText("Fix what's marked to review it.")).toBeVisible()
  })
})
