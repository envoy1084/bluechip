import { MixBar, MixCompare, mixText } from "@bluechip/ui/bluechip/mix-bar"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("mixText", () => {
  it.each([
    {
      name: "each part with its rounded share",
      parts: [{ id: "AAPL", label: "Apple", percent: 41.6 }, { id: "cash", label: "Cash", percent: 58.4 }],
      expected: "Apple 42%, Cash 58%"
    },
    {
      name: "a part at 0% left out",
      parts: [{ id: "AAPL", label: "Apple", percent: 100 }, { id: "cash", label: "Cash", percent: 0 }],
      expected: "Apple 100%"
    },
    { name: "nothing", parts: [], expected: "" }
  ])("$name", ({ expected, parts }) => {
    expect(mixText(parts)).toBe(expected)
  })
})

describe("MixBar", () => {
  it("says its shares as its name, after its label", async () => {
    const screen = await render(
      <MixBar
        label="Now"
        parts={[{ id: "NVDA", label: "Nvidia", percent: 30 }, { id: "cash", label: "Cash", percent: 70 }]}
      />
    )

    await expect.element(screen.getByRole("img", { name: "Now: Nvidia 30%, Cash 70%" })).toBeInTheDocument()
  })
})

describe("MixCompare", () => {
  it("draws the mix now and after, and lists each part's shares", async () => {
    const screen = await render(
      <MixCompare
        changes={[
          { id: "NVDA", label: "Nvidia", before: 40, after: 30 },
          { id: "cash", label: "Cash", before: 60, after: 70 }
        ]}
      />
    )

    await expect.element(screen.getByRole("img", { name: "Now: Nvidia 40%, Cash 60%" })).toBeInTheDocument()
    await expect.element(screen.getByRole("img", { name: "After: Nvidia 30%, Cash 70%" })).toBeInTheDocument()
    await expect.element(screen.getByRole("listitem").first()).toHaveTextContent("Nvidia40%→to30%")
  })
})
