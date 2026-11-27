import { addAuthenticator } from "../fixtures/authenticator.ts"
import { expect, test } from "../fixtures/test.ts"

test.describe("recovery", () => {
  test("a recovery key on a hardware key is set up with Face ID", async ({ page, funded: _funded }) => {
    const hardwareKey = await addAuthenticator(page, { transport: "usb" })
    await page.goto("/settings/security")
    await expect(page.getByText("No recovery key yet")).toBeVisible()

    await page.getByRole("button", { name: "Set up a recovery key" }).click()
    await page.getByRole("button", { name: "Lock with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "Your recovery key is ready" })).toBeVisible()
    expect(await hardwareKey.credentials()).toHaveLength(1)
    await page.getByRole("button", { name: "Done" }).click()
    await expect(page.getByText(/^Ready since /)).toBeVisible()
  })

  test("asked for on a new device, it waits 48 hours, and the owner cancels it without Face ID", async ({ browser, page, funded: _funded }) => {
    const hardwareKey = await addAuthenticator(page, { transport: "usb" })
    await page.goto("/settings/security")
    await page.getByRole("button", { name: "Set up a recovery key" }).click()
    await page.getByRole("button", { name: "Lock with Face ID" }).click()
    await expect(page.getByRole("heading", { name: "Your recovery key is ready" })).toBeVisible()
    await page.getByRole("button", { name: "Done" }).click()

    // A new device with none of the account's passkeys, and the hardware key plugged in.
    const lost = await browser.newPage()
    await addAuthenticator(lost)
    await hardwareKey.copyTo(await addAuthenticator(lost, { transport: "usb" }))
    await lost.goto("/signin")
    await lost.getByRole("link", { name: "Lost your passkey? Recover your account" }).click()
    await lost.getByRole("button", { name: "Use my recovery key" }).click()
    await expect(lost.getByRole("heading", { name: "Ask for a recovery" })).toBeVisible()
    await lost.getByRole("button", { name: "Make a passkey and ask" }).click()
    await expect(lost.getByRole("heading", { name: "Your recovery is waiting" })).toBeVisible()
    await expect(lost.getByText(/^It can go through from /)).toBeVisible()

    await expect(page.getByText("Someone asked to recover your account")).toBeVisible()
    await page.getByRole("button", { name: "Cancel recovery" }).click()

    await expect(page.getByText("Someone asked to recover your account")).toBeHidden()
    await lost.close()
  })

  test("the recovery passkey can't sign in to the app", async ({ browser, page, funded: _funded }) => {
    const hardwareKey = await addAuthenticator(page, { transport: "usb" })
    await page.goto("/settings/security")
    await page.getByRole("button", { name: "Set up a recovery key" }).click()
    await page.getByRole("button", { name: "Lock with Face ID" }).click()
    await expect(page.getByRole("heading", { name: "Your recovery key is ready" })).toBeVisible()

    const lost = await browser.newPage()
    await hardwareKey.copyTo(await addAuthenticator(lost, { transport: "usb" }))
    await lost.goto("/signin")
    await lost.getByRole("button", { name: "Sign in with passkey" }).click()

    await expect(lost.getByText("We couldn't sign you in")).toBeVisible()
    await lost.close()
  })

  test("a passkey that isn't a recovery key is refused on the recovery page", async ({ page }) => {
    await page.goto("/recover")

    await page.getByRole("button", { name: "Use my recovery key" }).click()

    await expect(page.getByText(/You cancelled Face ID|isn't a recovery key/)).toBeVisible()
  })
})
