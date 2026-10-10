# EdgeForce V181 — Robustness Review Queue

V181 adds an opt-in review queue to the ranked board.

A row enters the queue when either:
- the robustness engine marks it review-required, or
- robustness-aware ranking materially downgrades it.

The default remains the full ranked board.

This feature uses only locally computed board signals, adds no provider/network requests, and does not change qualification gates or deployment topology.
