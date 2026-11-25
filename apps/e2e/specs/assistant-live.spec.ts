// The one test on Anthropic's real models, opt-in and run alone (it costs a few cents):
// `BLUECHIP_E2E_LIVE=1 pnpm test:e2e specs/assistant-live.spec.ts`. Every other assistant test runs on recorded replies.
import { expect, test } from "../fixtures/test.ts"

test.skip(process.env["BLUECHIP_E2E_LIVE"] !== "1", "live model only with BLUECHIP_E2E_LIVE=1")

test.describe("the assistant on the live model", () => {
  test("answers a price question with the market's price", async ({ page, user: _user }) => {
    const composer = page.getByRole("textbox", { name: "Message bluechip" })

    await composer.fill("What is Apple's price right now? Answer in one short sentence.")
    await composer.press("Enter")

    // A live model with its tool round can take most of a minute.
    await expect(page.getByRole("main").getByText(/\$100(\.\d\d)?/).first()).toBeVisible({ timeout: 90_000 })
  })
})
