// The preview store as a service, so the mock API's handlers read and change the made-up world the Effect way.
import * as Context from "effect/Context"
import type { PreviewStore } from "../store.ts"

/** The tab's made-up world, for the mock API. */
export class Preview extends Context.Service<Preview, PreviewStore>()("@bluechip/web/preview/Preview") {}
