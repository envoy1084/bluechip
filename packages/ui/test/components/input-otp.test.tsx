import { InputOTP, InputOTPSlot } from "@bluechip/ui/components/input-otp"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const Code = ({ onValueChange }: { readonly onValueChange: (value: string) => void }) => (
  <>
    <label htmlFor="code">Digit 1</label>
    <InputOTP id="code" length={6} onValueChange={onValueChange}>
      {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} {...(i > 0 ? { "aria-label": `Digit ${i + 1}` } : {})} />)}
    </InputOTP>
  </>
)

describe("InputOTP", () => {
  it("moves to the next slot as each digit is typed", async () => {
    let code = ""
    const screen = await render(<Code onValueChange={(value) => (code = value)} />)
    await userEvent.click(screen.getByLabelText("Digit 1").first())
    await userEvent.keyboard("481")
    expect(code).toBe("481")
    await expect.element(screen.getByLabelText("Digit 4")).toHaveFocus()
  })

  it("fills every slot from a pasted code", async () => {
    let code = ""
    const screen = await render(<Code onValueChange={(value) => (code = value)} />)
    await userEvent.click(screen.getByLabelText("Digit 1").first())
    const clipboardData = new DataTransfer()
    clipboardData.setData("text/plain", "48 12 07")
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true })
    )
    await expect.element(screen.getByLabelText("Digit 6")).toHaveValue("7")
    expect(code).toBe("481207")
  })

  it("clears the previous slot on Backspace from an empty slot", async () => {
    let code = ""
    const screen = await render(<Code onValueChange={(value) => (code = value)} />)
    await userEvent.click(screen.getByLabelText("Digit 1").first())
    await userEvent.keyboard("48")
    await userEvent.keyboard("{Backspace}")
    expect(code).toBe("4")
    await expect.element(screen.getByLabelText("Digit 2")).toHaveFocus()
  })
})
