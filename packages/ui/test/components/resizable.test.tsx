import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@bluechip/ui/components/resizable"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const Split = ({ onResize }: { readonly onResize: (size: number) => void }) => (
  <div style={{ width: 600, height: 200 }}>
    <ResizablePanelGroup>
      <ResizablePanel
        id="agents"
        defaultSize="34%"
        minSize="20%"
        maxSize="80%"
        onResize={(size) => onResize(Math.round(size.asPercentage))}
      >
        Agents
      </ResizablePanel>
      <ResizableHandle aria-label="Resize agents panel" />
      <ResizablePanel id="chat">Chat</ResizablePanel>
    </ResizablePanelGroup>
  </div>
)

describe("Resizable", () => {
  it("resizes the first panel with the arrow keys, within its limits", async () => {
    const sizes: Array<number> = []
    await render(<Split onResize={(size) => sizes.push(size)} />)
    const handle = page.getByRole("separator", { name: "Resize agents panel" })
    await expect.element(handle).toHaveAttribute("aria-valuenow", "34")
    handle.element().focus()
    await expect.element(handle).toHaveFocus()

    await userEvent.keyboard("{ArrowRight}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "39")
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "29")
    await userEvent.keyboard("{End}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "80")
    await userEvent.keyboard("{Home}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "20")
    expect(sizes.at(-1)).toBe(20)
  })

  it("ignores the other axis's arrow keys", async () => {
    await render(<Split onResize={() => {}} />)
    const handle = page.getByRole("separator", { name: "Resize agents panel" })
    handle.element().focus()
    await expect.element(handle).toHaveFocus()
    await userEvent.keyboard("{ArrowDown}")
    await expect.element(handle).toHaveAttribute("aria-valuenow", "34")
  })
})
