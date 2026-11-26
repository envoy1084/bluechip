import { generateRegistrationOptions } from "@simplewebauthn/server"
import { RP_ID } from "../utils/SoftPasskeyBrowser.ts"

/** Sign-up options with the server's own ceremony settings (`apps/server/src/modules/auth/WebAuthn.ts`). */
export const registrationOptions = (userName: string) =>
  generateRegistrationOptions({
    rpName: "bluechip",
    rpID: RP_ID,
    userName,
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    supportedAlgorithmIDs: [-7]
  })
