/**
 * The JSON shapes of WebAuthn ceremonies (base64url fields), as browsers' `PublicKeyCredential.toJSON()` and
 * SimpleWebAuthn produce them.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"

const Base64Url = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]*$/))

const ClientExtensionResults = Schema.Record(Schema.String, Schema.Unknown)

/**
 * Options for `navigator.credentials.create` / `.get`, passed to the browser as they are.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const CeremonyOptions = Schema.Record(Schema.String, Schema.Unknown).annotate({
  identifier: "@bluechip/domain/WebAuthn/CeremonyOptions",
  description: "PublicKeyCredentialCreationOptionsJSON or PublicKeyCredentialRequestOptionsJSON"
})

/**
 * A ceremony's options with the id of its single-use challenge, to send back with the signed response.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export class Ceremony extends Schema.Class<Ceremony>("@bluechip/domain/WebAuthn/Ceremony")({
  challengeId: Schema.String,
  options: CeremonyOptions
}) {}

/**
 * A new passkey (`RegistrationResponseJSON`).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const RegistrationCredential = Schema.Struct({
  id: Base64Url,
  rawId: Base64Url,
  type: Schema.Literal("public-key"),
  authenticatorAttachment: Schema.optionalKey(Schema.Literals(["platform", "cross-platform"])),
  clientExtensionResults: ClientExtensionResults,
  response: Schema.Struct({
    clientDataJSON: Base64Url,
    attestationObject: Base64Url,
    authenticatorData: Schema.optionalKey(Base64Url),
    transports: Schema.optionalKey(Schema.Array(Schema.String)),
    publicKeyAlgorithm: Schema.optionalKey(Schema.Number),
    publicKey: Schema.optionalKey(Base64Url)
  })
}).annotate({ identifier: "@bluechip/domain/WebAuthn/RegistrationCredential" })

/**
 * A passkey's signature over a challenge (`AuthenticationResponseJSON`).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AuthenticationCredential = Schema.Struct({
  id: Base64Url,
  rawId: Base64Url,
  type: Schema.Literal("public-key"),
  authenticatorAttachment: Schema.optionalKey(Schema.Literals(["platform", "cross-platform"])),
  clientExtensionResults: ClientExtensionResults,
  response: Schema.Struct({
    clientDataJSON: Base64Url,
    authenticatorData: Base64Url,
    signature: Base64Url,
    userHandle: Schema.optionalKey(Base64Url)
  })
}).annotate({ identifier: "@bluechip/domain/WebAuthn/AuthenticationCredential" })
