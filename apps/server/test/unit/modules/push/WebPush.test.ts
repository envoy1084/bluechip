import { assert, describe, it } from "@effect/vitest"
import { createECDH, createPublicKey, verify } from "node:crypto"
import { encryptPayload, vapidAuthorization } from "../../../../src/modules/push/WebPush.ts"

describe("encryptPayload", () => {
  it("RFC 8291's example message (Appendix A)", () => {
    const body = encryptPayload({
      payload: "When I grow up, I want to be a watermelon",
      p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
      auth: "BTBZMqHH6r4Tts7J_aSIgg",
      salt: Buffer.from("DGv6ra1nlYgDCS1FRnbzlw", "base64url"),
      serverPrivateKey: Buffer.from("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw", "base64url")
    })

    assert.strictEqual(
      body.toString("base64url"),
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
    )
  })

  it("a fresh salt and key for every message", () => {
    const options = {
      payload: "hi",
      p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
      auth: "BTBZMqHH6r4Tts7J_aSIgg"
    }

    assert.notStrictEqual(
      encryptPayload(options).subarray(0, 86).toString("hex"),
      encryptPayload(options).subarray(0, 86).toString("hex")
    )
  })
})

describe("vapidAuthorization", () => {
  const keys = createECDH("prime256v1")
  keys.generateKeys()
  const publicKey = keys.getPublicKey().toString("base64url")
  const header = vapidAuthorization({
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    publicKey,
    privateKey: keys.getPrivateKey().toString("base64url"),
    subject: "mailto:ops@bluechip.test",
    now: 1_800_000_000
  })
  const [, token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!
  const [encodedHeader, encodedClaims, signature] = token!.split(".")

  it("claims the push service's origin, 12 hours and the subject", () => {
    assert.deepStrictEqual(
      [
        JSON.parse(Buffer.from(encodedHeader!, "base64url").toString()),
        JSON.parse(Buffer.from(encodedClaims!, "base64url").toString()),
        key
      ],
      [
        { typ: "JWT", alg: "ES256" },
        { aud: "https://fcm.googleapis.com", exp: 1_800_043_200, sub: "mailto:ops@bluechip.test" },
        publicKey
      ]
    )
  })

  it("is signed with the server's key (ES256)", () => {
    const raw = Buffer.from(publicKey, "base64url")
    const verifier = createPublicKey({
      format: "jwk",
      key: {
        kty: "EC",
        crv: "P-256",
        x: raw.subarray(1, 33).toString("base64url"),
        y: raw.subarray(33).toString("base64url")
      }
    })

    assert.isTrue(
      verify(
        "sha256",
        Buffer.from(`${encodedHeader}.${encodedClaims}`),
        { key: verifier, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature!, "base64url")
      )
    )
  })
})
