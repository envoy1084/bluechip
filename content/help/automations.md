# Automations

## What an automation is

An automation runs a step when something happens: when a trigger fires, it checks its conditions, then acts. It can
trade for one of your agents, within that agent's policies, or for your own account, asking for your Face ID.

## Triggers

A price crossing a level you pick, a price move from the close or another reference, a schedule, your mix drifting
from an agent's target mix, a portfolio level (cash falling under, or a stock growing over, a share of your money), or
news about stocks or a topic you pick.

## Actions

Buy an amount of dollars split across stocks you pick, sell a dollar amount of a stock, rebalance to the agent's
target mix, ask you first (propose the trades and wait for your approval), or just tell you.

## Several trades at once

When an action makes several trades (a rebalance, a buy split across stocks), the agent sends them together in one
transaction: they land in the same block, all or none, and count as one of its trades for the day. Two trades of the
same stock go in separate transactions, so each stays within the agent's largest trade. If its policies refuse the
transaction as a whole, the agent tries each trade on its own, so one trade doesn't hold back the others.

## Settings and judgments

An automation waits an hour between runs unless you change its cooldown, and can keep quiet hours. A news trigger can
ask a model a question about the story ("is this materially negative?"); bluechip records each answer, how sure the
model was and why, and acts only when it is sure enough. Every run is listed on the automation's page.
