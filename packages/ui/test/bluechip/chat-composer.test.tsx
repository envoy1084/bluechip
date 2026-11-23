import { ChatComposer } from "@bluechip/ui/bluechip/chat-composer"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("ChatComposer", () => {
  it("sends the trimmed message on Enter and clears the box", async () => {
    const sent: Array<string> = []
    const screen = await render(<ChatComposer onSend={(message) => sent.push(message)} />)
    const box = screen.getByRole("textbox", { name: "Message bluechip" })
    await userEvent.click(box)
    await userEvent.keyboard("  What's Nvidia's price?  {Enter}")
    expect(sent).toEqual(["What's Nvidia's price?"])
    await expect.element(box).toHaveValue("")
  })

  it("adds a line on Shift+Enter instead of sending", async () => {
    const sent: Array<string> = []
    const screen = await render(<ChatComposer onSend={(message) => sent.push(message)} />)
    const box = screen.getByRole("textbox", { name: "Message bluechip" })
    await userEvent.click(box)
    await userEvent.keyboard("Buy Apple{Shift>}{Enter}{/Shift}every Monday")
    await expect.element(box).toHaveValue("Buy Apple\nevery Monday")
    expect(sent).toEqual([])
  })

  it("blocks sending an empty message and while bluechip answers", async () => {
    const sent: Array<string> = []
    const screen = await render(<ChatComposer onSend={(message) => sent.push(message)} />)
    const box = screen.getByRole("textbox", { name: "Message bluechip" })
    await userEvent.click(box)
    await userEvent.keyboard("   {Enter}")
    await expect.element(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    await screen.rerender(<ChatComposer sending onSend={(message) => sent.push(message)} />)
    await userEvent.fill(box, "Pause the weekly buyer")
    await userEvent.keyboard("{Enter}")
    await expect.element(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    expect(sent).toEqual([])
  })

  it("fills the box from a suggestion without sending it", async () => {
    const sent: Array<string> = []
    const screen = await render(
      <ChatComposer suggestions={["Sell Tesla if it drops 10%"]} onSend={(message) => sent.push(message)} />
    )
    await userEvent.click(screen.getByRole("button", { name: "Sell Tesla if it drops 10%" }))
    const box = screen.getByRole("textbox", { name: "Message bluechip" })
    await expect.element(box).toHaveValue("Sell Tesla if it drops 10%")
    await expect.element(box).toHaveFocus()
    expect(sent).toEqual([])
  })
})
