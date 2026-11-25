import { pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../columns.ts"
import { passkeys, users } from "./accounts.ts"

/** Signed-in sessions. Only a SHA-256 of the cookie's token is stored, so a database leak cannot sign anyone in. */
export const sessions = pgTable("sessions", {
  id: typeId("session")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  /** The passkey that signed in; sessions from before this column existed have none and are no longer valid. */
  passkeyId: typeId("passkey")("passkey_id").references(() => passkeys.id, { onDelete: "cascade" }),
  createdAt: dateTimeUtc("created_at").notNull(),
  expiresAt: dateTimeUtc("expires_at").notNull(),
  revokedAt: dateTimeUtc("revoked_at")
})

/** WebAuthn challenges: each is used at most once, within five minutes. */
export const authChallenges = pgTable("auth_challenges", {
  id: typeId("challenge")("id").primaryKey(),
  purpose: text("purpose", { enum: ["register", "login"] }).notNull(),
  challenge: text("challenge").notNull(),
  expiresAt: dateTimeUtc("expires_at").notNull(),
  usedAt: dateTimeUtc("used_at")
})
