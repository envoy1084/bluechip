import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../../platform/db/columns.ts"

export const users = pgTable("users", {
  id: typeId("user")("id").primaryKey(),
  displayName: text("display_name"),
  eligibility: text("eligibility", { enum: ["unknown", "outsideUs", "us"] }).notNull().default("unknown"),
  /** An IANA zone, set by the app on the first visit and in settings; `null` before (UTC until then). */
  timeZone: text("time_zone"),
  createdAt: dateTimeUtc("created_at").notNull()
})

/**
 * Passkeys that sign in and own the account (`owner`, any one of them signs), or only recover it (`recovery`).
 * `coseKey` is the credential's public key as WebAuthn reports it (for verifying sign-ins); `publicKey` is the same
 * P-256 key uncompressed (`0x04‖x‖y`), as Namera's `WebAuthnValidator` takes it. An owner added later is `pending`
 * until its owner operation (`user_op_hash`) lands, and `removing` until its removal does.
 */
export const passkeys = pgTable("passkeys", {
  id: typeId("passkey")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  coseKey: text("cose_key").notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull(),
  transports: text("transports").array().notNull(),
  /** "iCloud Keychain on Mac": the provider (from the authenticator's AAGUID) and the device it was created on. */
  label: text("label"),
  /** Backed up by the provider, so it works on the user's other devices too. */
  synced: boolean("synced").notNull().default(false),
  role: text("role", { enum: ["owner", "recovery"] }).notNull().default("owner"),
  status: text("status", { enum: ["pending", "active", "removing", "removed"] }).notNull().default("active"),
  /** The owner operation adding or removing it, while it is on its way. */
  userOpHash: text("user_op_hash"),
  createdAt: dateTimeUtc("created_at").notNull(),
  lastUsedAt: dateTimeUtc("last_used_at"),
  removedAt: dateTimeUtc("removed_at")
})

/** The user's Kernel account on Base; the address is fixed by the sign-up passkey. */
export const accounts = pgTable("accounts", {
  userId: typeId("user")("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  address: text("address").notNull().unique(),
  createdAt: dateTimeUtc("created_at").notNull(),
  /** When bluechip first saw the account's code on chain. Deployment can't be undone, so this is never asked again. */
  deployedAt: dateTimeUtc("deployed_at")
})
