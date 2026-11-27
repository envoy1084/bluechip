import { expect, test } from "../fixtures/test.ts"
import { withdraw } from "../utils/trading.ts"

const burn = "0x000000000000000000000000000000000000dEaD"

test.describe("add cash", () => {
  test("sign-up's deposit screen shows where to send USDC, without test money", async ({ page }) => {
    await page.goto("/welcome")
    await page.getByRole("button", { name: "Create account with Face ID" }).click()
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByRole("heading", { name: "Are you a US citizen or resident?" })).toBeVisible()
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page).toHaveURL(/\/welcome\/deposit$/)
    await expect(page.getByRole("heading", { name: "Add cash", level: 1 })).toBeVisible()
    await expect(
      page.getByText(
        "Send USDC on Base to this address. It shows up here as soon as it lands, or add it later from home."
      )
    ).toBeVisible()
    const deposit = page.getByRole("region", { name: "Your deposit address" })
    await expect(
      deposit.getByRole("img", { name: /^QR code to send USDC on Base to 0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/ })
    )
      .toBeVisible()
    await expect(deposit.getByRole("button", { name: "Copy address" })).toBeVisible()
    await expect(page.getByRole("button", { name: /test money/ })).toHaveCount(0)
    await page.getByRole("button", { name: "Go to home" }).click()
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()
  })

  test("Portfolio's Add cash shows the account's address, then the cash that arrives", async ({ page, user }) => {
    await page.goto("/portfolio")

    await page.getByRole("button", { name: "Add cash" }).first().click()

    const dialog = page.getByRole("dialog", { name: "Add cash" })
    await expect(dialog.getByText("Send USDC on Base to your bluechip account. It shows up here as soon as it lands."))
      .toBeVisible()
    await expect(dialog.getByTitle(user.address)).toBeVisible()
    await expect(dialog.getByRole("button", { name: /test money/ })).toHaveCount(0)
    await user.fund(page)
    await expect(dialog.getByRole("region", { name: "Cash arrived" })).toContainText("$1,000.00")
    await dialog.getByRole("button", { name: "Close" }).click()
    await expect(page.getByRole("region", { name: "Holdings" })).toContainText("$1,000.00")
  })

  test("Settings' test money adds $1,000 on the local network", async ({ page, user: _user }) => {
    await page.goto("/settings")

    await page.getByRole("button", { name: "Get $1,000 test money" }).click()

    await expect(page.getByText("$1,000 is on its way. You can get $9,000 more today.")).toBeVisible()
    await page.goto("/portfolio")
    await expect(page.getByRole("region", { name: "Holdings" })).toContainText("$1,000.00")
  })
})

test.describe("withdraw", () => {
  test("$25 to an address with Face ID: sent, then listed under withdrawals", async ({ page, funded: _funded }) => {
    await withdraw(page, 25, burn)

    const withdrawals = page.getByRole("region", { name: "Withdrawals" })
    await expect(withdrawals.getByRole("listitem")).toHaveCount(1)
    await expect(withdrawals.getByRole("listitem")).toContainText("$25.00")
    await expect(withdrawals.getByRole("listitem")).toContainText("to 0x0000…dEaD")
    await expect(withdrawals.getByRole("listitem")).toContainText("Sent")
    await expect(withdrawals.getByRole("link", { name: "View on BaseScan" })).toHaveAttribute(
      "href",
      /^https:\/\/basescan\.org\/tx\/0x[0-9a-f]{64}$/
    )
    await expect(page.getByRole("region", { name: "Holdings" })).toContainText("$975.00")
  })

  test("the review shows what Face ID approves, and the first send sets the account up", async ({ page, funded: _ }) => {
    await page.goto("/portfolio")
    await page.getByRole("button", { name: "Withdraw" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Withdraw cash" })
    await dialog.getByRole("textbox", { name: "Amount" }).fill("40")
    await dialog.getByRole("textbox", { name: /^To this address on Base/ }).fill(burn)

    await dialog.getByRole("button", { name: "Review withdrawal" }).click()

    await expect(dialog.getByRole("definition").nth(0)).toHaveText("$40.00")
    await expect(dialog.getByRole("definition").nth(1)).toHaveText(burn)
    await expect(dialog.getByRole("definition").nth(2)).toHaveText("Base, as USDC")
    await expect(
      dialog.getByText(
        "This is your account's first transaction on Base, so it also sets the account up. You only do this once."
      )
    ).toBeVisible()
    await dialog.getByRole("button", { name: "Change amount or address" }).click()
    await expect(dialog.getByRole("button", { name: "Review withdrawal" })).toBeVisible()
  })

  test("more than your cash can't be reviewed", async ({ page, funded: _funded }) => {
    await page.goto("/portfolio")
    await page.getByRole("button", { name: "Withdraw" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Withdraw cash" })

    await dialog.getByRole("textbox", { name: "Amount" }).fill("1000.01")
    await dialog.getByRole("textbox", { name: /^To this address on Base/ }).fill(burn)

    await expect(dialog.getByRole("textbox", { name: "Amount" })).toHaveAttribute("aria-invalid", "true")
    await expect(dialog.getByText("You have $1,000.00 in cash. Lower the amount.")).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Review withdrawal" })).toBeDisabled()
  })

  test("an address that isn't a Base address can't be reviewed", async ({ page, funded: _funded }) => {
    await page.goto("/portfolio")
    await page.getByRole("button", { name: "Withdraw" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Withdraw cash" })

    await dialog.getByRole("textbox", { name: "Amount" }).fill("10")
    await dialog.getByRole("textbox", { name: /^To this address on Base/ }).fill("0x1234")

    await expect(dialog.getByText("That isn't a Base address: 0x and 40 letters or digits.")).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Review withdrawal" })).toBeDisabled()
  })

  test("Max fills in all the cash", async ({ page, funded: _funded }) => {
    await page.goto("/portfolio")
    await page.getByRole("button", { name: "Withdraw" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Withdraw cash" })

    await dialog.getByRole("button", { name: "Max" }).click()

    await expect(dialog.getByRole("textbox", { name: "Amount" })).toHaveValue("1,000")
  })

  test("a cancelled Face ID sends nothing", async ({ page, authenticator, funded: _funded }) => {
    await page.goto("/portfolio")
    await page.getByRole("button", { name: "Withdraw" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Withdraw cash" })
    await dialog.getByRole("textbox", { name: "Amount" }).fill("10")
    await dialog.getByRole("textbox", { name: /^To this address on Base/ }).fill(burn)
    await dialog.getByRole("button", { name: "Review withdrawal" }).click()
    await authenticator.setVerified(false)
    const confirms: Array<string> = []
    page.on("request", (request) => {
      if (/\/api\/withdrawals\/[^/]+\/confirm$/.test(request.url())) confirms.push(request.url())
    })

    await dialog.getByRole("button", { name: "Withdraw with Face ID" }).click()

    await expect(dialog.getByText("Face ID didn't work. Try again.")).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Try Face ID again" })).toBeVisible()
    expect(confirms).toEqual([])
    await dialog.getByRole("button", { name: "Close" }).click()
    await expect(page.getByRole("region", { name: "Withdrawals" })).toContainText("No withdrawals yet.")
    await expect(page.getByRole("region", { name: "Holdings" })).toContainText("$1,000.00")
  })

  test("Withdraw is off with no cash", async ({ page, user: _user }) => {
    await page.goto("/portfolio")

    await expect(page.getByText("No stocks yet")).toBeVisible()
    await expect(page.getByRole("button", { name: "Withdraw" })).toBeDisabled()
  })
})
