import { assert, describe, it } from "@effect/vitest"
import * as Redacted from "effect/Redacted"
import { randomBytes } from "node:crypto"
import { privateKeyToAccount } from "viem/accounts"
import { decryptKey, encryptKey, newAgentKey } from "../../../../src/modules/agents/Keys.ts"

const secret = Redacted.make(randomBytes(32).toString("base64"))
const agentId = "agent_01jdrawxyzabcdefghjkmnpqrs"
const privateKey = `0x${"ab".repeat(32)}` as const

describe("encryptKey", () => {
  it("a key opens with the same secret, for the same agent", () => {
    assert.strictEqual(decryptKey(secret, agentId, encryptKey(secret, agentId, privateKey)), privateKey)
  })

  it("the same key sealed twice gives different ciphertexts", () => {
    assert.notStrictEqual(encryptKey(secret, agentId, privateKey), encryptKey(secret, agentId, privateKey))
  })
})

describe("decryptKey", () => {
  it("throws for another agent's ciphertext", () => {
    const sealed = encryptKey(secret, "agent_01jdrawxyzabcdefghjkmnpqrt", privateKey)

    assert.throws(() => decryptKey(secret, agentId, sealed))
  })

  it("throws under another secret", () => {
    const sealed = encryptKey(secret, agentId, privateKey)

    assert.throws(() => decryptKey(Redacted.make(randomBytes(32).toString("base64")), agentId, sealed))
  })

  it("throws for a changed ciphertext", () => {
    const [format, iv, ciphertext, tag] = encryptKey(secret, agentId, privateKey).split(".")
    const flipped = Buffer.from(ciphertext!, "base64url")
    flipped[0] = flipped[0]! ^ 1

    assert.throws(() => decryptKey(secret, agentId, [format, iv, flipped.toString("base64url"), tag].join(".")))
  })

  it("throws for a secret that isn't 32 bytes", () => {
    assert.throws(() => encryptKey(Redacted.make(randomBytes(16).toString("base64")), agentId, privateKey))
  })
})

describe("newAgentKey", () => {
  it("seals the private key of the address it returns", () => {
    const key = newAgentKey(secret, agentId)

    assert.strictEqual(privateKeyToAccount(decryptKey(secret, agentId, key.ciphertext)).address, key.address)
  })
})
