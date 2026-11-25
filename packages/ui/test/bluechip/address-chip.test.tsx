import { AddressChip, shortAddress } from "@bluechip/ui/bluechip/address-chip"
import { Toaster } from "@bluechip/ui/components/toast"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { cdp, userEvent } from "vitest/browser"

const ADDRESS = "0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"

// Real permissions for the test page's own browser context: headless Chromium denies clipboard writes without them.
const clipboard = async (allowed: boolean) => {
  const { targetInfo } = await cdp().send("Target.getTargetInfo") as { targetInfo: { browserContextId: string } }
  const { browserContextId } = targetInfo
  if (!allowed) return void await cdp().send("Browser.resetPermissions", { browserContextId })
  await cdp().send("Browser.grantPermissions", {
    browserContextId,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"]
  })
}

describe("shortAddress", () => {
  it("shortens an address to its first six and last four characters", () => {
    expect(shortAddress(ADDRESS)).toBe("0x7a3F…B9d4")
  })

  it("keeps twelve characters whole", () => {
    expect(shortAddress("0x1234567890")).toBe("0x1234567890")
  })

  it("shortens thirteen characters", () => {
    expect(shortAddress("0x12345678901")).toBe("0x1234…8901")
  })
})

describe("AddressChip", () => {
  it("shows the short address", async () => {
    const screen = await render(<AddressChip address={ADDRESS} />)
    await expect.element(screen.getByText("0x7a3F…B9d4")).toBeVisible()
  })

  it("copies the full address and announces it", async () => {
    await clipboard(true)
    const screen = await render(<AddressChip address={ADDRESS} />)
    await userEvent.click(screen.getByRole("button", { name: "Copy address" }))
    await expect.element(screen.getByText("Copied")).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(ADDRESS)
  })

  it("says so when the browser won't copy", async () => {
    await clipboard(false)
    const screen = await render(<AddressChip address={ADDRESS} />)
    await userEvent.click(screen.getByRole("button", { name: "Copy address" }))
    await expect.element(screen.getByText("Couldn't copy")).toBeVisible()
  })

  it("confirms a copy with a toast when asked to", async () => {
    await clipboard(true)
    const screen = await render(
      <>
        <AddressChip address={ADDRESS} feedback="toast" />
        <Toaster />
      </>
    )
    await userEvent.click(screen.getByRole("button", { name: "Copy address" }))
    await expect.element(screen.getByText("Address copied")).toBeVisible()
  })
})
