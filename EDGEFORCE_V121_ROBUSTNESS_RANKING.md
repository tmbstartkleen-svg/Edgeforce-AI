# EdgeForce V121 — Robustness-Aware Ranking

V121 adds an optional local decision-priority ranking to the live board.

- Default behavior remains highest simulation probability.
- Operators can switch to Robustness-aware ranking.
- Priority combines simulation probability, V120 robustness, and dynamic confidence.
- Review-required rows receive a small conservative penalty.
- The ranking engine performs zero additional provider/network requests.
- Existing robustness filters and all provider safety controls remain unchanged.

This is a presentation/ranking enhancement only. It does not weaken qualification gates or promise outcomes.
