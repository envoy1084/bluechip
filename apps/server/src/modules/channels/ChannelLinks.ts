import {
  ChannelLink,
  LINK_CODE_ALPHABET,
  LINK_CODE_MINUTES,
  LinkCode,
  type Platform
} from "@bluechip/domain/channels/Channel"
import { NotFound } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { ChannelLinkId, ConversationId, UserId } from "@bluechip/domain/Ids"
import { notificationOfChatLink } from "@bluechip/domain/notifications/Drafts"
import { and, asc, eq, gt, isNull } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createHash, randomInt } from "node:crypto"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { ChannelsLinks as ChannelsLinksMetric, count } from "../../platform/telemetry/Metrics.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { AuditLog } from "../audit/AuditLog.ts"
import { NotificationOutbox } from "../notifications/Outbox.ts"
import { channelLinkCodes, channelLinks } from "./tables.ts"
import { TelegramConfig } from "./telegram/TelegramConfig.ts"

export type ChannelLinkRow = typeof channelLinks.$inferSelect

const hashOf = (code: string) => createHash("sha256").update(code).digest("hex")

const toLink = (row: ChannelLinkRow) =>
  new ChannelLink({ id: row.id as ChannelLinkId, platform: row.platform, name: row.name, linkedAt: row.linkedAt })

/** Who sent a code, and from which chat: the platform's ids, and the name it gives them. */
export interface ChatOrigin {
  readonly platform: Platform
  readonly chatId: string
  readonly externalUserId: string
  readonly name: string | null
}

/**
 * Chats linked to accounts. The app makes a one-time code (10 minutes, one at a time per platform, stored hashed);
 * sending it to the bot from a private chat links that chat. Either side unlinks it. Every link and unlink is a
 * security notification on every channel, and goes into the audit trail.
 */
export class ChannelLinks extends Context.Service<ChannelLinks, {
  readonly createCode: (userId: UserId, platform: Platform) => Effect.Effect<LinkCode>
  /** Links the chat with the user whose code this is; `undefined` for a code that's wrong, used or expired. */
  readonly redeem: (code: string, origin: ChatOrigin) => Effect.Effect<ChannelLinkRow | undefined>
  /** The link of a chat, while it is linked. */
  readonly ofChat: (platform: Platform, chatId: string) => Effect.Effect<ChannelLinkRow | undefined>
  /** The user's linked chats, on one platform or all. */
  readonly ofUser: (userId: UserId, platform?: Platform | undefined) => Effect.Effect<ReadonlyArray<ChannelLinkRow>>
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<ChannelLink>>
  /** Unlinks one of the user's chats, from the app. */
  readonly unlink: (userId: UserId, id: string) => Effect.Effect<void, NotFound>
  /** Unlinks a chat from the chat itself; `undefined` when it wasn't linked. */
  readonly unlinkChat: (platform: Platform, chatId: string) => Effect.Effect<ChannelLinkRow | undefined>
  /** Unlinks a chat whose person blocked the bot: the platform refuses every message to it. */
  readonly blocked: (platform: Platform, chatId: string) => Effect.Effect<void>
  /** Remembers the conversation a chat continues. */
  readonly setConversation: (id: ChannelLinkRow["id"], conversationId: ConversationId) => Effect.Effect<void>
}>()("@bluechip/server/ChannelLinks") {
  static readonly layer = Layer.effect(
    ChannelLinks,
    Effect.gen(function*() {
      const db = yield* Database
      const outbox = yield* NotificationOutbox
      const live = yield* LiveEvents
      const audit = yield* AuditLog
      const analytics = yield* Analytics
      const telegram = yield* TelegramConfig

      const createCode = Effect.fn("ChannelLinks.createCode")(function*(userId: UserId, platform: Platform) {
        const code = Array.from({ length: 8 }, () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)]).join("")
        const expiresAt = DateTime.add(yield* DateTime.now, { minutes: LINK_CODE_MINUTES })

        yield* db.transaction((tx) =>
          Effect.gen(function*() {
            yield* tx.delete(channelLinkCodes).where(and(
              eq(channelLinkCodes.userId, userId as `user_${string}`),
              eq(channelLinkCodes.platform, platform)
            ))
            yield* tx.insert(channelLinkCodes).values({
              codeHash: hashOf(code),
              userId: userId as `user_${string}`,
              platform,
              expiresAt,
              usedAt: null
            })
          })
        ).pipe(Effect.orDie)

        const bot = telegram.username
        return new LinkCode({
          platform,
          code,
          bot: bot === undefined ? null : `@${bot}`,
          deepLink: bot === undefined ? null : `https://t.me/${bot}?start=${code}`,
          expiresAt
        })
      })

      // The notification goes to the outbox in the change's transaction; the rest is told once it's committed.
      const notify = (row: ChannelLinkRow, change: "linked" | "unlinked" | "blocked") =>
        outbox.notify(notificationOfChatLink(row, change), row.userId as UserId)

      const told = (row: ChannelLinkRow, change: "linked" | "unlinked" | "blocked") =>
        Effect.andThen(
          live.publish(LiveEvent.cases.AccountChanged.make({}), row.userId as UserId),
          audit.record({
            userId: row.userId as UserId,
            actor: change === "blocked" ? "system" : "owner",
            action: change === "linked" ? "channel.linked" : "channel.unlinked",
            subjectType: "channelLink",
            subjectId: row.id,
            data: change === "blocked" ? { platform: row.platform, reason: "blocked" } : { platform: row.platform }
          }).pipe(
            Effect.andThen(count(ChannelsLinksMetric, { platform: row.platform, change })),
            Effect.andThen(
              row.platform !== "telegram" ? Effect.void : analytics.capture(row.userId as UserId, {
                _tag: change === "linked" ? "telegram_linked" : "telegram_unlinked"
              }, {
                id: `${row.id}:${change === "linked" ? "linked" : "unlinked"}`,
                set: { telegram_linked: change === "linked" }
              })
            )
          )
        )

      const ofChat = Effect.fn("ChannelLinks.ofChat")(function*(platform: Platform, chatId: string) {
        const [row] = yield* db.select().from(channelLinks).where(and(
          eq(channelLinks.platform, platform),
          eq(channelLinks.chatId, chatId),
          isNull(channelLinks.unlinkedAt)
        )).pipe(Effect.orDie)
        return row
      })

      const redeem = Effect.fn("ChannelLinks.redeem")(function*(code: string, origin: ChatOrigin) {
        const now = yield* DateTime.now
        const linked = yield* db.transaction(() =>
          Effect.gen(function*() {
            const [used] = yield* db.update(channelLinkCodes).set({ usedAt: now }).where(and(
              eq(channelLinkCodes.codeHash, hashOf(code)),
              eq(channelLinkCodes.platform, origin.platform),
              isNull(channelLinkCodes.usedAt),
              gt(channelLinkCodes.expiresAt, now)
            )).returning()
            if (used === undefined) return undefined

            // A chat is linked to one account at a time: a new code moves it.
            const before = yield* ofChat(origin.platform, origin.chatId)
            if (before !== undefined) {
              yield* db.update(channelLinks).set({ unlinkedAt: now }).where(eq(channelLinks.id, before.id))
              yield* notify(before, "unlinked")
            }
            const [row] = yield* db.insert(channelLinks).values({
              id: typeid("channellink").toString() as `channellink_${string}`,
              userId: used.userId,
              platform: origin.platform,
              externalUserId: origin.externalUserId,
              chatId: origin.chatId,
              name: origin.name,
              conversationId: null,
              linkedAt: now,
              unlinkedAt: null
            }).returning()
            yield* notify(row!, "linked")
            return { before, row: row! }
          })
        ).pipe(Effect.orDie)
        if (linked === undefined) return undefined

        if (linked.before !== undefined) yield* told(linked.before, "unlinked")
        yield* told(linked.row, "linked")
        return linked.row
      })

      const ofUser = Effect.fn("ChannelLinks.ofUser")(function*(userId: UserId, platform?: Platform | undefined) {
        return yield* db.select().from(channelLinks).where(and(
          eq(channelLinks.userId, userId as `user_${string}`),
          platform === undefined ? undefined : eq(channelLinks.platform, platform),
          isNull(channelLinks.unlinkedAt)
        )).orderBy(asc(channelLinks.linkedAt)).pipe(Effect.orDie)
      })

      const close = Effect.fnUntraced(function*(row: ChannelLinkRow, change: "unlinked" | "blocked" = "unlinked") {
        const now = yield* DateTime.now
        const closed = yield* db.transaction(() =>
          Effect.gen(function*() {
            const [closed] = yield* db.update(channelLinks).set({ unlinkedAt: now })
              .where(and(eq(channelLinks.id, row.id), isNull(channelLinks.unlinkedAt))).returning()
            if (closed !== undefined) yield* notify(closed, change)
            return closed
          })
        ).pipe(Effect.orDie)
        if (closed !== undefined) yield* told(closed, change)
        return closed
      })

      const unlink = Effect.fn("ChannelLinks.unlink")(function*(userId: UserId, id: string) {
        const [row] = yield* db.select().from(channelLinks).where(and(
          eq(channelLinks.id, id as `channellink_${string}`),
          eq(channelLinks.userId, userId as `user_${string}`),
          isNull(channelLinks.unlinkedAt)
        )).pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "channelLink", id })
        yield* close(row)
      })

      const unlinkChat = Effect.fn("ChannelLinks.unlinkChat")(function*(platform: Platform, chatId: string) {
        const row = yield* ofChat(platform, chatId)
        return row === undefined ? undefined : yield* close(row)
      })

      const blocked = Effect.fn("ChannelLinks.blocked")(function*(platform: Platform, chatId: string) {
        const row = yield* ofChat(platform, chatId)
        if (row !== undefined) yield* close(row, "blocked")
      })

      const setConversation = (id: ChannelLinkRow["id"], conversationId: ConversationId) =>
        db.update(channelLinks).set({ conversationId: conversationId as `conversation_${string}` })
          .where(eq(channelLinks.id, id)).pipe(Effect.orDie, Effect.asVoid)

      return ChannelLinks.of({
        createCode,
        redeem,
        ofChat,
        ofUser,
        list: (userId) => Effect.map(ofUser(userId), (rows) => rows.map(toLink)),
        unlink,
        unlinkChat,
        blocked,
        setConversation
      })
    })
  )
}
