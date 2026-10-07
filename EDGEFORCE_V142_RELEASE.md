# Edgeforce V142 — Fair-Share Priority Queue and Recovered-Slot Allocation

V142 makes recovered Vercel capacity deterministic and fair across Edgeforce, Safeguard, and TravAI.

The 84 normal automated deployment slots are partitioned into explicit rolling shares: Edgeforce 34, Safeguard 28, and TravAI 22. Those shares sum exactly to the normal-cap budget and do not consume the six-slot emergency reserve.

Pending projects are ranked by a fairness score made from four signals: configured project priority, waiting-age bonus, under-budget credit, and over-budget penalty. Under-share pending projects are always queued before over-share projects. When no under-share project needs all available normal slots, at most one over-share project may borrow unused capacity in a governor run.

The allocator exposes queue rank, score, project 24-hour usage, configured share, budget state, and whether borrowed capacity was used. Peer-project Vercel deployments carry the same allocation metadata so release evidence can be traced back to the governor decision.

Migration v117 extends durable governor decision history with queue rank, fairness score, share usage, budget state, and borrowed-capacity evidence. The Edgeforce dashboard shows the same fields for live project state and recent decisions.

V142 does not loosen V141 emergency controls. Automatic allocation still stops at 84. Emergency releases remain reviewed/manual only between 84 and 89, and every release path remains blocked at or above 90.
