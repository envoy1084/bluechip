import { assert, describe, it } from "@effect/vitest"
import { type NewsFrame, readNewsFrame } from "../../../../../src/modules/market/alpaca/NewsFrames.ts"
import * as Frames from "../../../../fixtures/alpaca/NewsFrames.ts"

describe("readNewsFrame", () => {
  it.each<{ name: string; frame: string; expected: ReadonlyArray<NewsFrame> }>([
    { name: "connected", frame: Frames.CONNECTED, expected: [] },
    { name: "authenticated", frame: Frames.AUTHENTICATED, expected: [] },
    { name: "subscribed", frame: Frames.SUBSCRIBED, expected: [] },
    {
      name: "a story",
      frame: Frames.STORY,
      expected: [{
        _tag: "Story",
        story: {
          id: "24918784",
          headline: "NVIDIA Lowers Its Fourth-Quarter Guidance",
          summary: "The chipmaker now expects revenue below analysts' estimates.",
          url: "https://www.benzinga.com/news/26/11/24918784/nvidia-lowers-guidance",
          symbols: ["NVDA"],
          publishedAt: "2026-11-26T14:31:10Z"
        }
      }]
    },
    {
      name: "two stories, one without a url",
      frame: Frames.TWO_STORIES,
      expected: [
        {
          _tag: "Story",
          story: {
            id: "24918790",
            headline: "Apple Opens A New Plant",
            summary: "",
            url: "https://www.benzinga.com/news/26/11/24918790/apple-plant",
            symbols: ["AAPL"],
            publishedAt: "2026-11-26T14:40:00Z"
          }
        },
        {
          _tag: "Story",
          story: {
            id: "24918791",
            headline: "Chip Stocks Rally",
            summary: "Semiconductors lead the market.",
            url: null,
            symbols: ["NVDA", "INTC"],
            publishedAt: "2026-11-26T14:41:00Z"
          }
        }
      ]
    },
    {
      name: "406: the connection limit, a refusal",
      frame: Frames.CONNECTION_LIMIT,
      expected: [{ _tag: "Refused", code: 406, message: "connection limit exceeded" }]
    },
    {
      name: "402: auth failed, a refusal",
      frame: Frames.AUTH_FAILED,
      expected: [{ _tag: "Refused", code: 402, message: "auth failed" }]
    },
    {
      name: "409: news not in the plan, a refusal",
      frame: Frames.NOT_IN_PLAN,
      expected: [{ _tag: "Refused", code: 409, message: "insufficient subscription" }]
    },
    {
      name: "500: worth connecting again",
      frame: Frames.INTERNAL_ERROR,
      expected: [{ _tag: "Failed", code: 500, message: "internal error" }]
    }
  ])("$name", ({ expected, frame }) => {
    assert.deepStrictEqual(readNewsFrame(frame), expected)
  })

  it("a frame that isn't JSON throws", () => {
    assert.throws(() => readNewsFrame("not json"))
  })
})
