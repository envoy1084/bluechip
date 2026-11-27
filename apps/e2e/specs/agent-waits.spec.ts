import { parseEther, parseGwei } from "viem"
import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { agentActivity, askToBuy, tradeCard, typeBuy } from "../utils/intents.ts"

const noGas = /^Waiting: your account needs a little ETH for gas\. It tries again at \d{2}:\d{2}\.$/

test.describe("an agent's trade that waits", () => {
  test("with no ETH for gas, the preview says it would wait and why", async ({ page, chain, funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await chain.setEth(funded.address, BigInt(0))

    await typeBuy(page, 50)

    await expect(tradeCard(page).getByText(noGas)).toBeVisible()
  })

  test("with no ETH for gas, an asked trade waits in the card and its activity", async ({ page, chain, funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await chain.setEth(funded.address, BigInt(0))

    await askToBuy(page, 50)

    await expect(tradeCard(page).getByText("Buy $50.00 of NVIDIA")).toBeVisible()
    await expect(tradeCard(page).getByText("Waiting", { exact: true })).toBeVisible()
    await expect(tradeCard(page).getByText(noGas)).toBeVisible()
    await page.goto(`${page.url()}/history`)
    const row = agentActivity(page).getByRole("listitem").filter({ hasText: "Buy $50.00 of NVIDIA" })
    await expect(row.getByText("Waiting", { exact: true })).toBeVisible()
    await expect(row.getByText("You asked this agent to trade.")).toBeVisible()
    await expect(row.getByText(noGas)).toBeVisible()
  })

  test("cancelling a waiting trade ends it with nothing bought", async ({ page, chain, funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await chain.setEth(funded.address, BigInt(0))
    await askToBuy(page, 50)
    await expect(tradeCard(page).getByText(noGas)).toBeVisible()

    await tradeCard(page).getByRole("button", { name: "Cancel trade" }).click()

    await expect(tradeCard(page).getByText("Cancelled", { exact: true })).toBeVisible()
    await expect(
      tradeCard(page).getByText("You cancelled it. Nothing was bought. Your cash is where it was.")
    ).toBeVisible()
    await page.goto(`${page.url()}/history`)
    const row = agentActivity(page).getByRole("listitem").filter({ hasText: "Buy $50.00 of NVIDIA" })
    await expect(row.getByText("Cancelled", { exact: true })).toBeVisible()
    await expect(row.getByRole("button", { name: "Cancel trade" })).toBeHidden()
  })

  test(
    "a cancelled trade no longer says it tries again",
    async ({ page, chain, funded }) => {
      await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
      await chain.setEth(funded.address, BigInt(0))
      await askToBuy(page, 50)
      await expect(tradeCard(page).getByText(noGas)).toBeVisible()

      await tradeCard(page).getByRole("button", { name: "Cancel trade" }).click()

      await expect(tradeCard(page).getByText("Cancelled", { exact: true })).toBeVisible()
      await expect(page.getByText(/It tries again at/)).toHaveCount(0)
    }
  )

  // The agent offers twice the base fee per gas, and its gas policy charges an operation's most it could cost against
  // its daily budget (0.05 ETH): at 250 gwei, any swap over 100,000 gas is over it. The account gets 2 ETH, so the
  // bundler's own check that it can pay still passes.
  test(
    "a gas price over its daily gas budget makes it wait",
    { tag: "@chain" },
    async ({ page, chain, funded }) => {
      await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
      await chain.setEth(funded.address, parseEther("2"))

      try {
        await chain.setBaseFee(parseGwei("250"))
        await askToBuy(page, 50)

        await expect(tradeCard(page).getByText("Waiting", { exact: true })).toBeVisible()
        await expect(
          tradeCard(page).getByText(
            /^Waiting: gas costs more right now than this agent's daily gas budget allows\. It tries again at \d{2}:\d{2}\.$/
          )
        ).toBeVisible()
      } finally {
        await chain.resetBaseFee()
      }
    }
  )
})
