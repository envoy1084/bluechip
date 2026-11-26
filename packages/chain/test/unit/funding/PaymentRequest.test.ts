import { usdcTransferRequest } from "@bluechip/chain/funding/PaymentRequest"
import { assert, describe, it } from "@effect/vitest"

const RECIPIENT = "0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"

describe("usdcTransferRequest", () => {
  it("Base: a USDC transfer to the recipient on chain 8453, with no amount", () => {
    assert.strictEqual(
      usdcTransferRequest({ network: "base", recipient: RECIPIENT }),
      "ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"
    )
  })

  it("the local chain: Base's chain id and USDC", () => {
    assert.strictEqual(
      usdcTransferRequest({ network: "local", recipient: RECIPIENT }),
      "ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"
    )
  })

  it("an amount, in USDC's units", () => {
    assert.strictEqual(
      usdcTransferRequest({ network: "base", recipient: RECIPIENT, amount: 25_000_000n }),
      "ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4&uint256=25000000"
    )
  })
})
