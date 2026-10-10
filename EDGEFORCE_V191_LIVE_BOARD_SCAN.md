# EdgeForce V191 — Live Board Scan

V191 makes the probability board faster to scan during live operation.

## Action-first scan
- Sticky board scan dock stays visible while reviewing rows.
- One-tap SIM and PRIORITY ranking controls.
- One-tap ROBUST and REVIEW focus controls.
- ACTION, WATCH, and REVIEW lanes summarize the current ranked board.
- Each lane surfaces the top candidate and opens its explanation.

## Desktop improvements
- Probability-board table headers remain sticky while scrolling.
- Decision rows gain clearer hover hierarchy.

## Mobile improvements
- Scan lanes become horizontally scrollable cards.
- Action/review cards gain a stronger left-edge state indicator.
- Decision controls become larger touch targets.

## Runtime impact
- All scan lanes derive from already-loaded ranked board rows.
- Zero new provider/API calls.
- No changes to simulations, pricing, qualification, settlement, or deployment topology.
