import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Layer from "effect/Layer"
import { ServerLive } from "./Server.ts"

NodeRuntime.runMain(Layer.launch(ServerLive))
