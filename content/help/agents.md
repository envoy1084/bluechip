# Agents

## What an agent is

An agent trades for you within rules you lock onchain. It is a key on your bluechip account that carries rules: the
stocks it may trade, how much it may spend, how large a trade it makes on its own and more. Base checks every trade it
sends against those rules, so nothing bluechip runs can make it go past them. An agent can never send money out of your
account or change its own rules.

## Starting from a template

New agent starts with What should your agent do? Pick a template: Stock picker buys and sells a few stocks you pick,
Weekly buyer buys them on a schedule, Rebalancer keeps your target mix, and Stop-loss guard only sells, to protect what
you hold. Start from scratch begins with only the rules every agent has. Templates you saved with Save as template are
offered there too.

## Setting its rules

From a built-in template, the Rules step starts with a preset: Conservative, Balanced or Active set the amounts in one
tap. Under Fine-tuning you can change any rule and turn the optional ones on or off; the ones marked Every agent has
this rule stay. Review shows its rules at a glance, what it can do and what it can never do, and asks for its name.

## Locking it with Face ID

An agent starts as a draft. When you choose Lock with Face ID, your passkey signs its rules onchain, and Base takes a
couple of seconds. A lock lasts 90 days: bluechip tells you seven days and one day before it ends, and Renew keeps it
trading for another 90 days. An agent whose lock ended trades no more until you renew it.

## Pausing, changing and removing

Pause stops an agent at once, and Pause all agents (in the sidebar and under Danger zone in Settings) stops every one. A
paused agent sends nothing, its trades that weren't sent yet are cancelled, and nothing is sold; Resume starts it again.
Edit rules and Remove agent take your Face ID, because they change what is locked onchain. A removed agent can never
trade again; your stocks and cash stay in your account, and its history stays.

## The agent's page

Each agent's page shows its trades, how much of its limits it has used today, its results and its journal: what it did
and why, written as it happened. Its automations are listed there too.
