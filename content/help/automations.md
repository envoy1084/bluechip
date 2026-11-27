# Automations

## What an automation is

An automation does something when something happens: When its trigger fires, Only if its checks pass, Then it acts. It
trades through one of your agents, within that agent's rules, or for you, with Face ID for each trade. Choose who under
Trades through.

## Starting from an idea

New automation starts with Start from an idea: Weekly buy, Buy the dip, Stop-loss, Take profit, Price alert or Bad news
alert. An idea fills in the steps, and you can change anything after.

## When: triggers

- On a schedule: on the days and at the time you pick.
- Price crosses a level: a stock goes above or below a price you pick.
- Price move: a stock rises or falls a percentage from its close, its high or another reference.
- Portfolio level: cash falls under, or a stock grows over, a share of your portfolio.
- Mix drifts: your mix drifts from the agent's target mix by more than its trigger.
- News: a story about stocks or a topic you pick.

## Only if: checks

Checks are optional; with none, it acts every time it starts. Market open (regular trading hours), Prices fresh, Price
above, Price below, Still holding (a stock, or at least some shares of it), Time window, and Judgment (for news). All
of, Any of and Not combine them.

## Then: actions

- Buy: a dollar amount, split across the stocks you pick.
- Sell: a dollar amount of a stock, never more than you hold.
- Sell part of a holding: a quarter, half or all of it.
- Rebalance: trade back to the agent's target mix.
- Ask me first: propose the trades and wait for your approval with Face ID.
- Tell me: send you a message, and trade nothing.

## More settings

An automation waits an hour between runs unless you change Wait between runs. It can stop after a number of runs or end
on a date, run only while the market is open, and keep quiet hours in your time zone. Trades on news wait for your Face
ID unless you turn on Trade without asking me, because a story is text anyone could write.

## Judgments

A Judgment asks a model a question about the story that fired a news trigger, such as whether it is materially bad news.
bluechip records each answer, how sure the model was and why, and goes on only when it is sure enough (70% to start).
When an answer holds an automation back, the A judgment held an automation back notification says so.

## Several trades at once

When an action makes several trades (a rebalance, a buy split across stocks), the agent sends them together in one
transaction: they land together, all or none, and count as one of its trades for the day. Two trades of the same stock
go in separate transactions, so each stays within the agent's largest trade. If its rules refuse the transaction as a
whole, each trade is tried on its own, so one trade doesn't hold back the others.

## Runs

Every run is listed on the automation's page: what fired it, what it checked and the trades it made. You can pause,
resume, edit or delete it there; deleting it stops it at once, and its trades stay in your activity.
