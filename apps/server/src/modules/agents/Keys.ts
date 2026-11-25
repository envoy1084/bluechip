// Agents' session keys at rest: AES-256-GCM under `AGENT_KEY_ENCRYPTION_KEY`, with the agent's id as associated
// data, so a ciphertext only opens for the agent it was made for. A KMS replaces the environment key before mainnet.
import * as Redacted from "effect/Redacted"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import type { Address, Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const FORMAT = "v1"

const keyOf = (secret: Redacted.Redacted<string>) => {
  const key = Buffer.from(Redacted.value(secret), "base64")
  if (key.length !== 32) throw new Error("AGENT_KEY_ENCRYPTION_KEY must be 32 bytes, base64")
  return key
}

/** Encrypts an agent's private key: `v1.iv.ciphertext.tag`, base64url. */
export const encryptKey = (secret: Redacted.Redacted<string>, agentId: string, privateKey: Hex): string => {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv).setAAD(Buffer.from(agentId))
  const ciphertext = Buffer.concat([cipher.update(privateKey.slice(2), "hex"), cipher.final()])
  return [FORMAT, iv, ciphertext, cipher.getAuthTag()].map((part) =>
    typeof part === "string" ? part : part.toString("base64url")
  ).join(".")
}

/** The agent's private key; throws on another agent's ciphertext, a changed one, or the wrong encryption key. */
export const decryptKey = (secret: Redacted.Redacted<string>, agentId: string, sealed: string): Hex => {
  const [format, iv, ciphertext, tag] = sealed.split(".")
  if (format !== FORMAT || iv === undefined || ciphertext === undefined || tag === undefined) {
    throw new Error("not an agent key ciphertext")
  }
  const decipher = createDecipheriv("aes-256-gcm", keyOf(secret), Buffer.from(iv, "base64url"))
    .setAAD(Buffer.from(agentId))
    .setAuthTag(Buffer.from(tag, "base64url"))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()])
  return `0x${plaintext.toString("hex")}`
}

/** A new session key for an agent: its address, and its private key sealed for that agent. */
export const newAgentKey = (secret: Redacted.Redacted<string>, agentId: string) => {
  const privateKey = generatePrivateKey()
  return {
    address: privateKeyToAccount(privateKey).address as Address,
    ciphertext: encryptKey(secret, agentId, privateKey)
  }
}
