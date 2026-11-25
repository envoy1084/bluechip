import { integer, pgTable, text } from "drizzle-orm/pg-core"
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
  label: text("label"),
  createdAt: dateTimeUtc("created_at").notNull(),
  lastUsedAt: dateTimeUtc("last_used_at")
})

/** The user's Kernel account on Base; the address is fixed by the sign-up passkey. */
export const accounts = pgTable("accounts", {
  userId: typeId("user")("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  address: text("address").notNull().unique(),
  createdAt: dateTimeUtc("created_at").notNull()
})
