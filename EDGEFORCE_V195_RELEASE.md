# EdgeForce V195 — Daily / Weekly Sports Research Cockpit

V195 upgrades the existing `/sports-research` page into a live, evidence-first research cockpit without adding a second sports application or a new provider collector.

## What changed

- Adds one shared week-view live-board snapshot for the research page.
- Derives **Today / This Week / AM / PM** views locally from that one snapshot.
- Separates **STRICT** rows from **FALLBACK / REVIEW** rows using the live-board qualification contract.
- Surfaces material context changes—including injury, lineup, roster and other model-context revisions—beside the affected market.
- Adds chronological research sequencing without creating parlays, stakes, orders or wager instructions.
- Adds direct navigation to player history, prediction-market research and coverage-gap views.
- Keeps refresh manual; there is no background poller on this page.

## Evidence and safety contract

The cockpit never turns missing data into zeroes, never upgrades fallback rows into picks, and never treats a score feed as sportsbook odds. It consumes the existing live-board response and performs no order transport.

A mandatory regression test verifies daily/week filtering, strict/fallback behavior, context-change matching, the single-snapshot fetch contract and execution isolation.
