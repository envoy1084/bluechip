import { InputOTP, InputOTPSlot } from "@bluechip/ui/components/input-otp"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("InputOTP", () => {
  it("typing a code fills its slots and reports the code", async () => {
    let code = ""
    // Base UI names the first slot from the field's label, and the others from their own aria-label.
    const screen = await render(
      <>
        <label htmlFor="code">Digit 1</label>
        <InputOTP id="code" length={4} onValueChange={(value) => (code = value)}>
          {[1, 2, 3, 4].map((digit) => (
            <InputOTPSlot key={digit} {...(digit > 1 ? { "aria-label": `Digit ${digit}` } : {})} />
          ))}
        </InputOTP>
      </>
    )
    await userEvent.click(screen.getByLabelText("Digit 1").first())
    await userEvent.keyboard("4812")
    expect(code).toBe("4812")
  })
})
