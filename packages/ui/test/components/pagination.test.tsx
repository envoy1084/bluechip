import { paginationRange } from "@bluechip/ui/components/pagination"
import { describe, expect, it } from "@effect/vitest"

describe("paginationRange", () => {
  it("keeps the ends and the current page's neighbours, folding the gaps", () => {
    expect(paginationRange(3, 12)).toEqual([1, 2, 3, 4, "ellipsis", 12])
    expect(paginationRange(7, 12)).toEqual([1, "ellipsis", 6, 7, 8, "ellipsis", 12])
    expect(paginationRange(12, 12)).toEqual([1, "ellipsis", 11, 12])
  })

  it("shows every page when there is nothing to fold", () => {
    expect(paginationRange(1, 1)).toEqual([1])
    expect(paginationRange(2, 4)).toEqual([1, 2, 3, 4])
    expect(paginationRange(4, 9, 2)).toEqual([1, 2, 3, 4, 5, 6, "ellipsis", 9])
  })
})
