# Agents

## What an agent is

An agent trades for you within rules you lock onchain. It is a session key on your bluechip account that carries
policies: the stocks it may trade, how much it may spend, how large a trade it makes on its own and more. Base checks
every trade it sends against those policies, so nothing bluechip runs can make it go past them.

## Starting from a template

New agents start from a template: Stock picker buys and sells a few stocks you pick, Weekly buyer buys them on a
schedule, Rebalancer keeps your target mix, and Stop-loss guard only sells, to protect what you hold. You can change
every policy before you lock it, or start from scratch.

## Locking it with Face ID

An agent starts as a draft. When you lock it, your passkey (Face ID or your fingerprint) signs its policies onchain.
A lock lasts 90 days; renew it before then to keep the agent trading.

## Pausing, changing and removing

You can pause an agent at any time, or pause every agent at once; a paused agent sends nothing, and its trades that
weren't sent yet are cancelled. Changing its policies or removing it takes your Face ID, because it changes what is
locked onchain.
