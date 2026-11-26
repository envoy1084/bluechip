import { ResearchCard } from "@bluechip/ui/bluechip/research-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("ResearchCard", () => {
  it("lists a page cited twice once", async () => {
    const page = { url: "https://example.com/nvidia-q3", title: "Nvidia Q3", citedText: "Revenue rose 60%." }
    const screen = await render(<ResearchCard query="Nvidia results" citations={[page, page]} />)
    await expect.element(screen.getByRole("listitem")).toHaveLength(1)
  })

  it("names a page without a title by its site", async () => {
    const screen = await render(
      <ResearchCard query="Chips" citations={[{ url: "https://www.example.org/chips", title: "", citedText: null }]} />
    )
    await expect.element(screen.getByRole("link", { name: "example.org" })).toHaveAttribute(
      "href",
      "https://www.example.org/chips"
    )
  })

  it("says so when there's nothing to cite", async () => {
    const screen = await render(<ResearchCard query="Chips" citations={[]} />)
    await expect.element(screen.getByText("No pages to cite.")).toBeVisible()
  })
})
