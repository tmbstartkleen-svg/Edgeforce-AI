# EdgeForce V189 — Ranked Board Decision Surface

V189 corrects a UI/control mismatch in the probability board and improves decision scanability.

## Functional correction
- The visible mobile cards and desktop table now render `rankedFiltered`, not the pre-ranking `filtered` collection.
- Priority ranking now changes visible order.
- Movement filtering now changes visible rows.
- Review-queue-only mode now changes visible rows.
- Empty states reflect the final ranked/review-filtered result.

## Decision surface
- Adds a compact board summary for visible rows, robust rows, review rows, upgraded rows, positive-edge rows, and active order mode.
- Adds local ACTION / WATCH / REVIEW badges derived from existing robustness, rank movement, sportsbook edge, and confidence values.
- Adds subtle row/card emphasis without changing recommendation or execution logic.

## Runtime impact
- Zero new provider or API calls.
- No simulation, qualification, pricing, settlement, or deployment-topology changes.
