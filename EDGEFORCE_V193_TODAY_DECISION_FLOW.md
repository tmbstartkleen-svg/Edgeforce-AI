# EdgeForce V193 — Today Decision Flow

V193 connects the most important decision states into one compact surface.

## Decision sequence
1. Act Now — top action candidate from the existing action lane.
2. Watch Next — strongest secondary watch candidate.
3. Review — first flagged review candidate plus total review pressure.
4. Best Parlay — current promoted parlay state, or an explicit no-build safety state.

## Interaction
- Action and watch cards open the existing market explanation flow.
- Review focuses the existing review queue.
- Best Parlay jumps to the parlay section.
- The strip uses the current ranked board and parlay payload only.

## Runtime impact
- Zero additional provider/API calls.
- No changes to provider cadence, model weights, simulations, settlement, qualification, pricing, or deployment topology.
