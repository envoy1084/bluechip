/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Authentication } from "../Auth.ts"
import { InvalidSpec, NotFound } from "../Errors.ts"
import { SavedTemplateId } from "../Ids.ts"
import { AgentSpec } from "../policies/AgentSpec.ts"
import { PolicyInfo, SpecCheck } from "../policies/Catalog.ts"
import { SavedTemplate, TemplateInfo, TemplateName } from "../policies/Templates.ts"

/**
 * The policy catalog and templates: what an agent's session key can carry, the ready-made sets to start from (built-in
 * and saved), and a check of a draft against the catalog, for forms, the assistant and other clients.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class PoliciesApi extends HttpApiGroup.make("policies").add(
  HttpApiEndpoint.get("catalog", "/policies", {
    success: Schema.Array(PolicyInfo)
  }),
  HttpApiEndpoint.get("templates", "/templates", {
    success: Schema.Struct({ builtIn: Schema.Array(TemplateInfo), saved: Schema.Array(SavedTemplate) })
  }),
  HttpApiEndpoint.post("saveTemplate", "/templates", {
    payload: Schema.Struct({ name: TemplateName, basedOn: Schema.NullOr(Schema.String), spec: AgentSpec }),
    success: SavedTemplate,
    error: InvalidSpec
  }),
  HttpApiEndpoint.delete("deleteTemplate", "/templates/:id", {
    params: { id: SavedTemplateId },
    success: Schema.Void,
    error: NotFound
  }),
  HttpApiEndpoint.post("check", "/sessions/check", {
    /** `before`: the policies in force, to compare a change with. */
    payload: Schema.Struct({ spec: AgentSpec, before: Schema.NullOr(AgentSpec) }),
    success: SpecCheck
  })
).middleware(Authentication) {}
