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

  it("sends with the Send button", async () => {
    const sent: Array<string> = []
    const screen = await render(<ChatComposer onSend={(message) => sent.push(message)} />)
    await userEvent.fill(screen.getByRole("textbox", { name: "Message bluechip" }), "Pause the weekly buyer")
    await userEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(sent).toEqual(["Pause the weekly buyer"])
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

  it("won't send a blank message", async () => {
    const sent: Array<string> = []
    const screen = await render(<ChatComposer onSend={(message) => sent.push(message)} />)
    await userEvent.click(screen.getByRole("textbox", { name: "Message bluechip" }))
    await userEvent.keyboard("   {Enter}")
    await expect.element(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    expect(sent).toEqual([])
  })

  it("won't send while bluechip answers", async () => {
    const sent: Array<string> = []
    const screen = await render(<ChatComposer sending onSend={(message) => sent.push(message)} />)
    const box = screen.getByRole("textbox", { name: "Message bluechip" })
    await userEvent.fill(box, "Pause the weekly buyer")
    await userEvent.keyboard("{Enter}")
    await expect.element(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    await expect.element(box).toHaveValue("Pause the weekly buyer")
    expect(sent).toEqual([])
  })

  it("says bluechip is answering in the empty box", async () => {
    const screen = await render(<ChatComposer sending onSend={() => {}} />)
    await expect.element(screen.getByRole("textbox", { name: "Message bluechip" })).toHaveAttribute(
      "placeholder",
      "bluechip is answering…"
    )
  })

  it("turns Send into Stop while bluechip answers, given onStop", async () => {
    let stopped = 0
    const screen = await render(<ChatComposer sending onStop={() => stopped++} onSend={() => {}} />)
    await userEvent.click(screen.getByRole("button", { name: "Stop" }))
    expect(stopped).toBe(1)
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
