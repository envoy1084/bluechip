import { AddressChip, shortAddress } from "@bluechip/ui/bluechip/address-chip"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { cdp, userEvent } from "vitest/browser"

const ADDRESS = "0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"

describe("AddressChip", () => {
  it("shows the first six and last four characters", async () => {
    expect(shortAddress(ADDRESS)).toBe("0x7a3F…B9d4")
    const screen = await render(<AddressChip address={ADDRESS} />)
    await expect.element(screen.getByText("0x7a3F…B9d4")).toBeVisible()
  })

  it("copies the full address and says so", async () => {
    // A real permission grant, for the test page's own browser context: headless Chromium denies writes otherwise.
    const { targetInfo } = await cdp().send("Target.getTargetInfo") as { targetInfo: { browserContextId: string } }
    await cdp().send("Browser.grantPermissions", {
      browserContextId: targetInfo.browserContextId,
      permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"]
    })
    const screen = await render(<AddressChip address={ADDRESS} />)
    await userEvent.click(screen.getByRole("button", { name: "Copy address" }))
    await expect.element(screen.getByText("Copied")).toBeVisible()
    expect(await navigator.clipboard.readText()).toBe(ADDRESS)
  })
})
