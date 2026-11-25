import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../columns.ts"

export const users = pgTable("users", {
  id: typeId("user")("id").primaryKey(),
  displayName: text("display_name"),
  eligibility: text("eligibility", { enum: ["unknown", "outsideUs", "us"] }).notNull().default("unknown"),
  createdAt: dateTimeUtc("created_at").notNull()
})

/**
 * Passkeys that sign in and own the account. `coseKey` is the credential's public key as WebAuthn reports it (for
 * verifying sign-ins); `publicKey` is the same P-256 key uncompressed (`0x04‖x‖y`), as Kernel's validator takes it.
 */
export const passkeys = pgTable("passkeys", {
  id: typeId("passkey")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  coseKey: text("cose_key").notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull(),
  transports: text("transports").array().notNull(),
  /** "iCloud Keychain · Mac": the provider (from the authenticator's AAGUID) and the device it was created on. */
  label: text("label"),
  /** Backed up by the provider, so it works on the user's other devices too. */
  synced: boolean("synced").notNull().default(false),
  createdAt: dateTimeUtc("created_at").notNull(),
  lastUsedAt: dateTimeUtc("last_used_at")
})

/** The user's Kernel account on Base; the address is fixed by the sign-up passkey. */
export const accounts = pgTable("accounts", {
  userId: typeId("user")("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  address: text("address").notNull().unique(),
  createdAt: dateTimeUtc("created_at").notNull(),
  /** When bluechip first saw the account's code on chain. Deployment can't be undone, so this is never asked again. */
  deployedAt: dateTimeUtc("deployed_at")
})
