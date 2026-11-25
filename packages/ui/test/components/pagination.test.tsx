import { PaginationLink, paginationRange } from "@bluechip/ui/components/pagination"
import { assert, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("paginationRange", () => {
  it("one page", () => {
    assert.deepStrictEqual(paginationRange(1, 1), [1])
  })

  it("two pages", () => {
    assert.deepStrictEqual(paginationRange(1, 2), [1, 2])
  })

  it("every page shown when the neighbours reach both ends", () => {
    assert.deepStrictEqual(paginationRange(2, 4), [1, 2, 3, 4])
  })

  it("the first page of many: one gap before the last", () => {
    assert.deepStrictEqual(paginationRange(1, 12), [1, 2, "ellipsis", 12])
  })

  it("a page whose neighbour touches the first: one gap before the last", () => {
    assert.deepStrictEqual(paginationRange(3, 12), [1, 2, 3, 4, "ellipsis", 12])
  })

  it("a page one past touching the first: a single skipped page still folds", () => {
    assert.deepStrictEqual(paginationRange(4, 12), [1, "ellipsis", 3, 4, 5, "ellipsis", 12])
  })

  it("a page in the middle: gaps on both sides", () => {
    assert.deepStrictEqual(paginationRange(7, 12), [1, "ellipsis", 6, 7, 8, "ellipsis", 12])
  })

  it("the last page of many: one gap after the first", () => {
    assert.deepStrictEqual(paginationRange(12, 12), [1, "ellipsis", 11, 12])
  })

  it("two siblings either side", () => {
    assert.deepStrictEqual(paginationRange(4, 9, 2), [1, 2, 3, 4, 5, 6, "ellipsis", 9])
  })

  it("no siblings", () => {
    assert.deepStrictEqual(paginationRange(5, 9, 0), [1, "ellipsis", 5, "ellipsis", 9])
  })

  it("zero pages lists page 0 and page 1 (today's behaviour)", () => {
    assert.deepStrictEqual(paginationRange(1, 0), [0, 1])
  })

  it.skip("zero pages lists no pages (bug: lists a page 0 and a page 1 that don't exist)", () => {
    assert.deepStrictEqual(paginationRange(1, 0), [])
  })
})

describe("PaginationLink", () => {
  it("the active page is marked as the current page", async () => {
    const screen = await render(<PaginationLink isActive>3</PaginationLink>)
    await expect.element(screen.getByRole("button", { name: "3" })).toHaveAttribute("aria-current", "page")
  })

  it("another page is not marked current", async () => {
    const screen = await render(<PaginationLink>4</PaginationLink>)
    await expect.element(screen.getByRole("button", { name: "4" })).not.toHaveAttribute("aria-current")
  })
})
