import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Agents } from "../agents/Agents.ts"

export const AgentsHandlers = HttpApiBuilder.group(BluechipApi, "agents", (handlers) =>
  handlers
    .handle("list", () => Effect.flatMap(Effect.all([CurrentUser, Agents]), ([user, agents]) => agents.list(user)))
    .handle("agent", ({ params }) =>
      Effect.flatMap(Effect.all([CurrentUser, Agents]), ([user, agents]) => agents.find(user, params.id)))
    .handle("usage", ({ params }) =>
      Effect.flatMap(Effect.all([CurrentUser, Agents]), ([user, agents]) =>
        agents.usage(user, params.id)))
    .handle("create", ({ payload }) =>
      Effect.flatMap(Effect.all([CurrentUser, Agents]), ([user, agents]) =>
        agents.create(user, payload)))
    .handle("lock", ({ params, payload }) =>
      Effect.flatMap(
        Effect.all([CurrentUser, Agents]),
        ([user, agents]) =>
          agents.lock(user, params.id, payload.requestId)
      ))
    .handle("changeLimits", ({ params, payload }) =>
      Effect.flatMap(Effect.all([CurrentUser, Agents]), ([user, agents]) =>
        agents.changeLimits(user, params.id, payload)))
    .handle("remove", ({ params, payload }) =>
      Effect.flatMap(
        Effect.all([CurrentUser, Agents]),
        ([user, agents]) =>
          agents.remove(user, params.id, payload.requestId)
      ))
    .handle("confirm", ({ params, payload }) =>
      Effect.flatMap(
        Effect.all([CurrentUser, Agents]),
        ([user, agents]) =>
          agents.confirm(user, params.id, payload.credential)
      ))
    .handle("pause", ({ params }) =>
      Effect.flatMap(Effect.all([CurrentUser, Agents]), ([user, agents]) =>
        agents.pause(user, params.id)))
    .handle("resume", ({ params }) =>
      Effect.flatMap(Effect.all([CurrentUser, Agents]), ([user, agents]) =>
        agents.resume(user, params.id)))
    .handle("pauseAll", () =>
      Effect.flatMap(Effect.all([CurrentUser, Agents]), ([user, agents]) =>
        agents.pauseAll(user)))
    .handle("resumeAll", () =>
      Effect.flatMap(Effect.all([CurrentUser, Agents]), ([user, agents]) =>
        agents.resumeAll(user))))
