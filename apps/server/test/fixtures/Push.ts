// A browser's push subscription, as `PushSubscription.toJSON()` gives it: its push service's endpoint (new each time)
// and the keys it decrypts with.
import type { NewPushSubscription } from "@bluechip/domain/push/Push"
import { createECDH, randomBytes, randomUUID } from "node:crypto"

export const pushSubscription = (): NewPushSubscription => {
  const keys = createECDH("prime256v1")
  keys.generateKeys()
  return {
    endpoint: `https://push.bluechip.test/${randomUUID()}`,
    keys: { p256dh: keys.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
    device: "Chrome on Mac"
  }
}
