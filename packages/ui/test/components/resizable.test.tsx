import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@bluechip/ui/components/resizable"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

describe("Resizable", () => {
  it("its handle resizes the panels from the keyboard, 5% a press", async () => {
    await render(
      <div style={{ width: 600, height: 200 }}>
        <ResizablePanelGroup>
          <ResizablePanel id="agents" defaultSize="34%">Agents</ResizablePanel>
          <ResizableHandle aria-label="Resize agents panel" />
          <ResizablePanel id="chat">Chat</ResizablePanel>
        </ResizablePanelGroup>
      </div>
    )
    const handle = page.getByRole("separator", { name: "Resize agents panel" })
    handle.element().focus()
    await expect.element(handle).toHaveFocus()
    await userEvent.keyboard("{ArrowRight}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "39")
  })
})
