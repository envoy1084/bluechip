import { defineRelations } from "drizzle-orm"
import * as schema from "./schema/tables.ts"

export const relations = defineRelations(schema)
