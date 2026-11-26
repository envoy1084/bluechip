import { Command } from "effect/cli"

import { circular } from "./commands/circular.ts"
import { clean } from "./commands/clean.ts"
import { contracts } from "./commands/contracts.ts"
import { dev } from "./commands/dev.ts"
import { devnet } from "./commands/devnet.ts"
import { lint } from "./commands/lint.ts"
import { vapid } from "./commands/vapid.ts"

/** `node scripts/bin.ts <command>`: the repository's tooling, run from the repository root. */
export const cli = Command.make("scripts").pipe(
  Command.withDescription("Repository tooling for bluechip, run from the repository root"),
  Command.withSubcommands([
    circular,
    clean,
    contracts,
    dev,
    devnet,
    lint,
    vapid
  ])
)
