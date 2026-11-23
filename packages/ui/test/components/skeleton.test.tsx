import { Skeleton, SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

interface Holding {
  readonly name: string
  readonly value: string
}

const SAMPLE: Holding = { name: "Sample stock", value: "$0,000.00" }

function Row({ holding }: { readonly holding: Holding }) {
  return (
    <p>
      <span>{holding.name}</span> <b>{holding.value}</b>
    </p>
  )
}

describe("Skeleton", () => {
  it("is busy and labelled while its data loads, then shows the content", async () => {
    const screen = await render(
      <Skeleton data={null} sample={SAMPLE} label="Loading holding">
        {(holding: Holding) => <Row holding={holding} />}
      </Skeleton>
    )
    await expect.element(screen.getByText("Loading holding")).toBeInTheDocument()
    expect(screen.container.querySelector("[aria-busy=true]")).not.toBeNull()
    // The sample only shapes the skeleton; it's hidden from screen readers.
    await expect.element(screen.getByRole("paragraph")).not.toBeInTheDocument()

    await screen.rerender(
      <Skeleton data={{ name: "NVIDIA", value: "$1,240.50" }} sample={SAMPLE} label="Loading holding">
        {(holding: Holding) => <Row holding={holding} />}
      </Skeleton>
    )
    await expect.element(screen.getByRole("paragraph")).toHaveTextContent("NVIDIA $1,240.50")
    await expect.poll(() => screen.container.querySelector("[aria-busy=true]")).toBeNull()
  })

  it("toggles over plain children with loading", async () => {
    const screen = await render(
      <Skeleton loading>
        <button type="button">Add cash</button>
      </Skeleton>
    )
    await expect.element(screen.getByRole("button", { name: "Add cash" })).not.toBeInTheDocument()
    await screen.rerender(
      <Skeleton loading={false}>
        <button type="button">Add cash</button>
      </Skeleton>
    )
    await expect.element(screen.getByRole("button", { name: "Add cash" })).toBeVisible()
  })

  it("draws a block without children", async () => {
    const screen = await render(
      <div>
        <Skeleton className="h-9 w-48" />
        <SkeletonBlock className="size-8" />
      </div>
    )
    expect(screen.container.querySelectorAll("[data-slot=skeleton-block]")).toHaveLength(2)
  })
})
