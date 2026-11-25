import { InvalidSpec, NotFound } from "@bluechip/domain/Errors"
import type { SavedTemplateId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { checkSpec, complete } from "@bluechip/domain/policies/Catalog"
import { SavedTemplate, TemplateId, templateInfos } from "@bluechip/domain/policies/Templates"
import { and, asc, eq } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { fromString, toUUID, typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { agentTemplates } from "../db/schema/agents.ts"
import type { Owner } from "../signing/SigningRequests.ts"

type TemplateRow = typeof agentTemplates.$inferSelect

const toTemplate = (row: TemplateRow) =>
  new SavedTemplate({
    id: row.id as SavedTemplateId,
    name: row.name,
    basedOn: row.basedOn,
    spec: row.spec,
    createdAt: row.createdAt
  })

const isSavedId = (id: string) => {
  try {
    toUUID(fromString(id, "template"))
    return true
  } catch {
    return false
  }
}

/**
 * The templates agents start from: bluechip's built-in ones, and the sets of policies each user saved.
 */
export class SavedTemplates extends Context.Service<SavedTemplates, {
  readonly list: (owner: Owner) => Effect.Effect<{
    readonly builtIn: ReturnType<typeof templateInfos>
    readonly saved: ReadonlyArray<SavedTemplate>
  }>
  readonly save: (
    owner: Owner,
    input: { readonly name: string; readonly basedOn: string | null; readonly spec: AgentSpec }
  ) => Effect.Effect<SavedTemplate, InvalidSpec>
  readonly remove: (owner: Owner, id: SavedTemplateId) => Effect.Effect<void, NotFound>
  /** Fails unless `template` is a built-in template's id or one of the owner's saved templates. */
  readonly requireExists: (owner: Owner, template: string) => Effect.Effect<void, NotFound>
}>()("@bluechip/server/SavedTemplates") {
  static readonly layer = Layer.effect(
    SavedTemplates,
    Effect.gen(function*() {
      const db = yield* Database

      const ownedBy = (owner: Owner, id: string) =>
        and(eq(agentTemplates.id, id as `template_${string}`), eq(agentTemplates.userId, owner.id as `user_${string}`))

      const list = Effect.fn("SavedTemplates.list")(function*(owner: Owner) {
        const rows = yield* db.select().from(agentTemplates)
          .where(eq(agentTemplates.userId, owner.id as `user_${string}`))
          .orderBy(asc(agentTemplates.createdAt)).pipe(Effect.orDie)
        return { builtIn: templateInfos(), saved: rows.map(toTemplate) }
      })

      const save = Effect.fn("SavedTemplates.save")(function*(
        owner: Owner,
        input: { readonly name: string; readonly basedOn: string | null; readonly spec: AgentSpec }
      ) {
        const spec = complete(input.spec)
        const problems = checkSpec(spec)
        if (problems.length > 0) return yield* new InvalidSpec({ problems })

        const [row] = yield* db.insert(agentTemplates).values({
          id: typeid("template").toString() as `template_${string}`,
          userId: owner.id as `user_${string}`,
          name: input.name,
          basedOn: input.basedOn,
          spec,
          createdAt: yield* DateTime.now
        }).returning().pipe(Effect.orDie)
        return toTemplate(row!)
      })

      const remove = Effect.fn("SavedTemplates.remove")(function*(owner: Owner, id: SavedTemplateId) {
        const deleted = yield* db.delete(agentTemplates).where(ownedBy(owner, id)).returning().pipe(Effect.orDie)
        if (deleted.length === 0) return yield* new NotFound({ resource: "template", id })
      })

      const requireExists = Effect.fnUntraced(function*(owner: Owner, template: string) {
        if ((TemplateId.literals as ReadonlyArray<string>).includes(template)) return
        const [row] = isSavedId(template) ?
          yield* db.select().from(agentTemplates).where(ownedBy(owner, template)).pipe(Effect.orDie) :
          []
        if (row === undefined) return yield* new NotFound({ resource: "template", id: template })
      })

      return { list, save, remove, requireExists }
    })
  )
}
