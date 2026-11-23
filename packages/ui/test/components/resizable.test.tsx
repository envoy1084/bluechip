import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@bluechip/ui/components/resizable"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

describe("Resizable", () => {
  it("resizes the first panel with the arrow keys, within its limits", async () => {
    const sizes: Array<number> = []
    await render(
      <ResizablePanelGroup
        defaultSize={34}
        onSizeChange={(size) => sizes.push(size)}
        style={{ width: 600, height: 200 }}
      >
        <ResizablePanel>Agents</ResizablePanel>
        <ResizableHandle aria-label="Resize agents panel" />
        <ResizablePanel>Chat</ResizablePanel>
      </ResizablePanelGroup>
    )
    const handle = page.getByRole("separator", { name: "Resize agents panel" })
    handle.element().focus()

    await userEvent.keyboard("{ArrowRight}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "39")
    expect(handle.element().parentElement?.style.getPropertyValue("--resizable-size")).toBe("39%")

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "29")
    await userEvent.keyboard("{End}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "80")
    await userEvent.keyboard("{ArrowRight}{Home}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "20")
    expect(sizes).toEqual([39, 34, 29, 80, 80, 20])
  })
})
