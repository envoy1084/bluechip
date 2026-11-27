import { fundedBucket, usdBucket } from "@bluechip/domain/analytics/Buckets"
import { assert, describe, it } from "@effect/vitest"

describe("usdBucket", () => {
  it.each(
    [
      { usd: 0, bucket: "<$10" },
      { usd: 9.99, bucket: "<$10" },
      { usd: 10, bucket: "$10–50" },
      { usd: 49.99, bucket: "$10–50" },
      { usd: 50, bucket: "$50–100" },
      { usd: 100, bucket: "$100–500" },
      { usd: 499.99, bucket: "$100–500" },
      { usd: 500, bucket: "$500–1k" },
      { usd: 1_000, bucket: "$1k–5k" },
      { usd: 4_999.99, bucket: "$1k–5k" },
      { usd: 5_000, bucket: "$5k+" },
      { usd: 1_000_000, bucket: "$5k+" }
    ] as const
  )("$usd: $bucket", ({ bucket, usd }) => {
    assert.strictEqual(usdBucket(usd), bucket)
  })
})

describe("fundedBucket", () => {
  it.each(
    [
      { usd: 0, bucket: "<$100" },
      { usd: 99.99, bucket: "<$100" },
      { usd: 100, bucket: "$100–1k" },
      { usd: 1_000, bucket: "$1k–10k" },
      { usd: 9_999.99, bucket: "$1k–10k" },
      { usd: 10_000, bucket: "$10k+" }
    ] as const
  )("$usd: $bucket", ({ bucket, usd }) => {
    assert.strictEqual(fundedBucket(usd), bucket)
  })
})
