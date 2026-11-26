import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { canRules, neverRules, openFineTuning, openRule, startAgent } from "../utils/agents.ts"

// A Stock picker of NVIDIA at its balanced preset, as the rules step reads it back.
const CAN = [
  "Buy and sell NVIDIA",
  "Spend up to $250 a day",
  "Trade up to $100 at a time, and ask you before anything bigger",
  "Trade on weekends and holidays, with a tighter price limit",
  "Trade 12 times a day at most"
]
const NEVER = [
  "Send money out of your account",
  "Trade stocks you didn't pick",
  "Make a trade under $5",
  "Trade more than 1% away from Chainlink's price",
  "Put over 30% of your money in one stock",
  "Leave less than 10% in cash",
  "Lose more than 1% of your money to prices in a week",
  "Change its own policies"
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

test.describe("rules step: presets", () => {
  for (
    const [template, amounts] of [
      ["Rebalancer", [
        "$100 a day $50 per trade 20% max in one",
        "$250 a day $100 per trade 30% max in one",
        "$1,000 a day $400 per trade 40% max in one"
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
      ["Stop-loss guard", ["$0 a day $50 per trade", "$0 a day $100 per trade", "$0 a day $400 per trade"]]
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

    await expect(canRules(page)).toHaveText([
      "Buy and sell NVIDIA",
      "Spend up to $100 a day",
      "Trade up to $50 at a time, and ask you before anything bigger",
      "Trade on weekends and holidays, with a tighter price limit",
      "Trade 12 times a day at most"
    ])
    await expect(neverRules(page)).toHaveText([
      "Send money out of your account",
      "Trade stocks you didn't pick",
      "Make a trade under $5",
      "Trade more than 1% away from Chainlink's price",
      "Put over 20% of your money in one stock",
      "Leave less than 20% in cash",
      "Lose more than 1% of your money to prices in a week",
      "Change its own policies"
    ])
  })

  test("a Weekly buyer's Active preset spends its capped $500 a day", async ({ page, user: _user }) => {
    await startAgent(page, "Weekly buyer")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()

    await page.getByRole("radio", { name: /^Active/ }).click()

    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("500")
    await openRule(page, "Trade size")
    await expect(page.getByRole("textbox", { name: "Ask me above" })).toHaveValue("400")
    await expect(canRules(page).nth(1)).toHaveText("Spend up to $500 a day")
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

    await expect(page.getByRole("img", { name: "Every agent has this rule" })).toHaveCount(3)
  })

  test("turning off Max in one stock drops its rule and its editor", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("switch", { name: "Max in one stock" }).click()

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(4, 1))
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

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(5, 1))
    await expect(page.getByRole("textbox", { name: "Cash reserve" })).toBeHidden()
  })

  test("turning off Weekly slippage drops its rule", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openFineTuning(page)
    await page.getByRole("switch", { name: "Weekly slippage" }).click()

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(6, 1))
  })

  test("adding Max in one stock to an agent from scratch adds its rule at 30%", async ({ page, user: _user }) => {
    await startAgent(page, "Start from scratch")
    await page.getByRole("button", { name: "NVDA NVIDIA" }).click()

    await page.getByRole("switch", { name: "Max in one stock" }).click()

    await expect(neverRules(page)).toHaveText([
      "Send money out of your account",
      "Trade stocks you didn't pick",
      "Make a trade under $5",
      "Trade more than 1% away from Chainlink's price",
      "Put over 30% of your money in one stock",
      "Change its own policies"
    ])
  })

  test("turning off a Rebalancer's Target mix makes it buy and sell", async ({ page, user: _user }) => {
    await rebalancer(page)

    await page.getByRole("switch", { name: "Target mix" }).click()

    await expect(page.getByRole("button", { name: "Buy and sell" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByText("Turning it on makes it trade only toward your mix, on live prices.")).toBeVisible()
    await expect(canRules(page).first()).toHaveText("Buy and sell Apple and NVIDIA")
    await expect(page.getByRole("button", { name: "Split evenly" })).toBeHidden()
  })

  test("turning Target mix back on makes it rebalance again", async ({ page, user: _user }) => {
    await rebalancer(page)
    await page.getByRole("switch", { name: "Target mix" }).click()

    await page.getByRole("switch", { name: "Target mix" }).click()

    await expect(page.getByRole("button", { name: "Rebalance only" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByText("Turning it off lets it buy and sell freely instead.")).toBeVisible()
    await expect(canRules(page).first()).toHaveText(
      "Trade Apple and NVIDIA, only to move you back to your target mix"
    )
    await openRule(page, "Target mix")
    await expect(page.getByRole("textbox", { name: "Apple target, percent" })).toHaveValue("30")
  })

  test("picking Rebalance only turns on Target mix, on live prices only", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("button", { name: "Rebalance only" }).click()

    await expect(page.getByRole("switch", { name: "Target mix" })).toBeChecked()
    await expect(neverRules(page)).toContainText(["Trade while prices are paused", "Trade away from your target mix"])
    await openRule(page, "Target mix")
    await expect(page.getByRole("textbox", { name: "Nvidia target, percent" })).toHaveValue("30")
  })
})

test.describe("rules step: stocks and direction", () => {
  test("no stock can't be reviewed", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")

    await expect(page.getByText("Pick at least one stock.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })

  test("two stocks are named in its rules", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("button", { name: "AAPL Apple" }).click()

    await expect(canRules(page).first()).toHaveText("Buy and sell Apple and NVIDIA")
    await expect(review(page)).toBeEnabled()
  })

  test("past three stocks it counts the rest", async ({ page, user: _user }) => {
    await stockPicker(page)

    for (const stock of ["AAPL Apple", "AMZN Amazon", "MSFT Microsoft"]) {
      await page.getByRole("button", { name: stock }).click()
    }

    await expect(canRules(page).first()).toHaveText("Buy and sell Apple, Amazon, Microsoft and 1 more")
  })

  test("Buy only buys", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("button", { name: "Buy only" }).click()

    await expect(page.getByText("It only ever buys. It can never sell what you hold.")).toBeVisible()
    await expect(canRules(page)).toHaveText(["Buy NVIDIA", ...CAN.slice(1)])
  })

  test("Sell only sells and has no daily budget", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("button", { name: "Sell only" }).click()

    await expect(page.getByText("It only ever sells, so it never spends your cash.")).toBeVisible()
    await expect(page.getByText("It only sells, so it has no daily budget.")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Daily budget" })).toBeHidden()
    await expect(canRules(page)).toHaveText(["Sell NVIDIA", ...CAN.slice(2)])
  })

  test("back from Sell only, it buys with the standard $250 a day", async ({ page, user: _user }) => {
    await stockPicker(page)
    await page.getByRole("textbox", { name: "Daily budget" }).fill("400")
    await page.getByRole("button", { name: "Sell only" }).click()

    await page.getByRole("button", { name: "Buy and sell" }).click()

    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("250")
    await expect(canRules(page)).toHaveText(CAN)
  })
})

test.describe("rules step: daily budget", () => {
  test("a typed budget is what it may spend a day", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("textbox", { name: "Daily budget" }).fill("500")

    await expect(canRules(page)).toHaveText(CAN.with(1, "Spend up to $500 a day"))
  })

  test("the slider moves it $10 at a time", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("slider", { name: "Daily budget" }).focus()
    await page.keyboard.press("ArrowRight")

    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("260")
    await expect(canRules(page)).toHaveText(CAN.with(1, "Spend up to $260 a day"))
  })

  test("over $2,000 can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("textbox", { name: "Daily budget" }).fill("2010")

    await expect(page.getByText("Pick $0 to $2,000.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })

  test("$0 for an agent that buys can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await page.getByRole("textbox", { name: "Daily budget" }).fill("0")

    await expect(page.getByText("Give it a daily budget to buy with.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })
})

test.describe("rules step: trade size", () => {
  test("Ask me above is the largest trade it makes alone", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask me above" }).fill("70")

    await expect(canRules(page)).toHaveText(
      CAN.with(2, "Trade up to $70 at a time, and ask you before anything bigger")
    )
  })

  test("Ask me above under $10 can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask me above" }).fill("5")

    await expect(page.getByText("Pick $10 to $1,000.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })

  test("Ask me above over the daily budget can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask me above" }).fill("300")

    await expect(page.getByText("Can't be more than the daily budget ($250).")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })

  test("the smallest trade is the least it trades", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Smallest trade" }).fill("20")

    await expect(neverRules(page)).toHaveText(NEVER.with(2, "Make a trade under $20"))
  })

  test("a smallest trade over Ask me above can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)
    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask me above" }).fill("50")

    await page.getByRole("textbox", { name: "Smallest trade" }).fill("60")

    await expect(page.getByText("Can't be more than the largest trade.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })
})

test.describe("rules step: max in one stock and cash reserve", () => {
  test("a lower max in one stock is its rule", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Max in one stock")
    await page.getByRole("textbox", { name: "Max in one stock" }).fill("20")

    await expect(neverRules(page)).toHaveText(NEVER.with(4, "Put over 20% of your money in one stock"))
  })

  test("a max in one stock under 5% can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Max in one stock")
    await page.getByRole("textbox", { name: "Max in one stock" }).fill("2")

    await expect(page.getByText("Pick 5% to 100%.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })

  test("a max in one stock of 100% leaves no room for the cash reserve", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Max in one stock")
    await page.getByRole("textbox", { name: "Max in one stock" }).fill("100")

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(4, 1))
    await expect(page.getByText("Cash reserve plus max in one stock can't pass 100%.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })

  test("a larger cash reserve is its rule", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Cash reserve")
    await page.getByRole("textbox", { name: "Cash reserve" }).fill("25")

    await expect(neverRules(page)).toHaveText(NEVER.with(5, "Leave less than 25% in cash"))
  })

  test("a cash reserve of 0% has no rule", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Cash reserve")
    await page.getByRole("textbox", { name: "Cash reserve" }).fill("0")

    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(5, 1))
  })

  test("a cash reserve over 50% can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)

    await openRule(page, "Cash reserve")
    await page.getByRole("textbox", { name: "Cash reserve" }).fill("60")

    await expect(page.getByText("Pick 0% to 50%.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
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

    await expect(page.getByText("Over your 30% max in one stock. Agents won't buy past 30%.")).toBeVisible()
    await expect(page.getByText("No stock's target can pass the max in one stock (30%).")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })

  test("cash under the cash reserve can't be reviewed", async ({ page, user: _user }) => {
    await rebalancer(page)
    await openRule(page, "Max in one stock")
    await page.getByRole("textbox", { name: "Max in one stock" }).fill("50")

    await openRule(page, "Target mix")
    await page.getByRole("textbox", { name: "Apple target, percent" }).fill("50")
    await page.getByRole("textbox", { name: "Nvidia target, percent" }).fill("45")

    await expect(page.getByText("Below your 10% cash reserve. Agents keep 10% anyway.")).toBeVisible()
    await expect(page.getByText("Cash's target can't be under the cash reserve (10%).")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })

  test("a stock taken out of the mix asks for its target", async ({ page, user: _user }) => {
    await rebalancer(page)

    await page.getByRole("button", { name: "Remove Nvidia" }).click()

    await expect(page.getByText("Give every stock a target.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
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

    await page.getByRole("button", { name: "10%", exact: true }).click()

    await expect(page.getByText("It starts trading once your mix is 10% off target.")).toBeVisible()
    await expect(canRules(page)).toContainText(["Start rebalancing once your mix is 10% off target"])
  })
})

test.describe("rules step: advanced", () => {
  test("Strict price protection is its price rule", async ({ page, user: _user }) => {
    await stockPicker(page)
    await page.getByRole("button", { name: "Advanced" }).click()

    await page.getByRole("button", { name: "Strict, 0.5%" }).click()

    await expect(page.getByText("Every trade stays within 0.5% of Chainlink's price.")).toBeVisible()
    await expect(neverRules(page)).toHaveText(NEVER.with(3, "Trade more than 0.5% away from Chainlink's price"))
  })

  test("not trading while prices are paused", async ({ page, user: _user }) => {
    await stockPicker(page)
    await page.getByRole("button", { name: "Advanced" }).click()

    await page.getByRole("switch", { name: "Trade while prices are paused" }).click()

    await expect(canRules(page)).toHaveText(CAN.toSpliced(3, 1))
    await expect(neverRules(page)).toHaveText(NEVER.toSpliced(4, 0, "Trade while prices are paused"))
  })

  test("a Rebalancer only trades while prices are live", async ({ page, user: _user }) => {
    await rebalancer(page)
    await page.getByRole("button", { name: "Advanced" }).click()

    await expect(page.getByText("A Rebalancer only trades while prices are live.")).toBeVisible()
    await expect(page.getByRole("switch", { name: "Trade while prices are paused" })).toBeDisabled()
  })

  test("a larger weekly slippage is its rule", async ({ page, user: _user }) => {
    await stockPicker(page)
    await page.getByRole("button", { name: "Advanced" }).click()

    await page.getByRole("button", { name: "2%", exact: true }).click()

    await expect(neverRules(page)).toHaveText(
      NEVER.with(6, "Lose more than 2% of your money to prices in a week")
    )
  })

  test("fewer trades a day", async ({ page, user: _user }) => {
    await stockPicker(page)
    await page.getByRole("button", { name: "Advanced" }).click()

    await openFineTuning(page)
    await openRule(page, "Trades a day")
    await page.getByRole("textbox", { name: "Trades a day" }).fill("3")

    await expect(canRules(page)).toHaveText(CAN.with(4, "Trade 3 times a day at most"))
  })

  test("one trade a day", async ({ page, user: _user }) => {
    await stockPicker(page)
    await page.getByRole("button", { name: "Advanced" }).click()

    await openFineTuning(page)
    await openRule(page, "Trades a day")
    await page.getByRole("textbox", { name: "Trades a day" }).fill("1")

    await expect(canRules(page)).toHaveText(CAN.with(4, "Trade once a day at most"))
  })

  test("more than 48 trades a day can't be reviewed", async ({ page, user: _user }) => {
    await stockPicker(page)
    await page.getByRole("button", { name: "Advanced" }).click()

    await openFineTuning(page)
    await openRule(page, "Trades a day")
    await page.getByRole("textbox", { name: "Trades a day" }).fill("49")

    await expect(page.getByText("Pick 1 to 48.")).toBeVisible()
    await expect(review(page)).toBeDisabled()
  })
})
