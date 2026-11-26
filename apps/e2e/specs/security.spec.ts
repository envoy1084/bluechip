import { addAuthenticator } from "../fixtures/authenticator.ts"
import { expect, test } from "../fixtures/test.ts"

test.describe("security: passkeys", () => {
  test("the passkey you signed up with is the one owner, and can't be removed", async ({ page, user: _user }) => {
    await page.goto("/settings/security")

    const passkeys = page.locator("section", { hasText: "Each passkey signs in and approves" })
    await expect(passkeys.getByText("This device", { exact: true })).toBeVisible()
    await expect(passkeys.getByText(/^On one device only, added /)).toBeVisible()
    await expect(passkeys.getByRole("button", { name: "Remove" })).toBeHidden()
    await expect(passkeys.getByText("You have one passkey. Add another so losing this device never locks you out."))
      .toBeVisible()
  })

  test("a hardware key added with Face ID becomes a second owner, then the first can be removed", async ({ page, funded: _funded }) => {
    const hardwareKey = await addAuthenticator(page, { transport: "usb" })
    await page.goto("/settings/security")

    await page.getByRole("button", { name: "Add a passkey" }).click()
    await page.getByRole("button", { name: "Make it and approve with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "The passkey is added" })).toBeVisible()
    expect(await hardwareKey.credentials()).toHaveLength(1)
    await page.getByRole("button", { name: "Done" }).click()
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(2)
  })

  test("removing a passkey asks first and ends with an outcome", async ({ page, funded: _funded }) => {
    await addAuthenticator(page, { transport: "usb" })
    await page.goto("/settings/security")
    await page.getByRole("button", { name: "Add a passkey" }).click()
    await page.getByRole("button", { name: "Make it and approve with Face ID" }).click()
    await expect(page.getByRole("heading", { name: "The passkey is added" })).toBeVisible()
    await page.getByRole("button", { name: "Done" }).click()

    await page.getByRole("button", { name: "Remove" }).last().click()
    await expect(page.getByRole("alertdialog")).toContainText("It can no longer sign in or approve anything")
    await page.getByRole("button", { name: "Remove with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "The passkey is removed" })).toBeVisible()
  })

  test("a cancelled Face ID adds nothing and says so", async ({ page, authenticator, funded: _funded }) => {
    await addAuthenticator(page, { transport: "usb" })
    await page.goto("/settings/security")
    await authenticator.setVerified(false)

    await page.getByRole("button", { name: "Add a passkey" }).click()
    await page.getByRole("button", { name: "Make it and approve with Face ID" }).click()

    await expect(page.getByRole("alertdialog")).toContainText("Nothing changed")
    await authenticator.setVerified(true)
  })
})

test.describe("security: devices", () => {
  test("this browser is listed as this device, with no one to sign out", async ({ page, user: _user }) => {
    await page.goto("/settings/security")

    const devices = page.locator("section", { hasText: "Every browser signed in to your account." })
    await expect(devices.getByText("This device", { exact: true })).toBeVisible()
    await expect(devices.getByRole("button", { name: "Sign out" })).toBeHidden()
    await expect(devices.getByRole("button", { name: "Sign out others" })).toBeHidden()
  })

  test("another browser signed in is listed, notified, and signed out from here", async ({ browser, page, authenticator, user: _user }) => {
    const other = await browser.newPage()
    await authenticator.copyTo(await addAuthenticator(other))
    await other.goto("/")
    await other.getByRole("button", { name: "Sign in with passkey" }).click()
    await expect(other.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()

    await page.goto("/settings/security")
    const devices = page.locator("section", { hasText: "Every browser signed in to your account." })
    await expect(devices.getByRole("button", { name: /^Sign out (?!others)/ })).toHaveCount(1)
    await devices.getByRole("button", { name: "Sign out others" }).click()

    await expect(devices.getByRole("button", { name: /^Sign out (?!others)/ })).toHaveCount(0)
    await other.reload()
    await expect(other).toHaveURL(/\/$/)
    await other.close()
  })
})
