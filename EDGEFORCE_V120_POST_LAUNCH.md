# EdgeForce V120 — Inline Decision Robustness

V120 productizes the existing robustness work on the live sports decision surface without changing the certified V119 runtime identity.

## What changed

- adds a zero-extra-provider-call robustness engine for every scanned sports row
- evaluates edge buffer, dynamic confidence, simulation interval width, data freshness, market regime, context/intelligence coverage, reliability state, and cross-book consensus
- classifies rows as ROBUST, RESILIENT, FRAGILE, or FAIL
- exposes an opt-in dashboard filter for Resilient+ and Robust-only views
- shows robustness directly beside high-simulation opportunities so a high sim is not presented without stability context
- adds a review count for fragile/failing/stale/reliability-critical rows
- keeps the existing deep V120 scenario stress lab available in the Operator Command Center for full deterministic shock analysis

## Cost and transport contract

The inline robustness engine performs no fetches and makes no provider requests. It uses the already-loaded live-board row only. The default dashboard filter remains ALL, so V120 does not silently suppress qualified rows or change the existing parlay engine unless the operator selects a robustness filter.

## Safety

Robustness is sensitivity and data-quality decision support, not a guarantee of outcomes or profit. FRAGILE/FAIL means the current edge depends more heavily on assumptions, freshness, confidence, or market confirmation and deserves additional review.

## Release identity

This post-launch product milestone intentionally retains the certified runtime identity:

- build: V119
- app version: 119.0.0
- model version: edgeforce-v119
- migration version: 118

A future release-identity increment should happen only when runtime, model, migration, or production release contracts require it.
