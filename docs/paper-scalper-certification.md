# Paper scalper certification checklist

This checklist is for simulated single-market trading only. No parlays, exchange credentials, or real order endpoints.

## Storage acceptance
- Apply the isolated paper ledger schema to a disposable database.
- Verify initialization does not overwrite existing state.
- Race two writes with the same expected revision; exactly one must succeed.
- Restart the process and recover the same inventory, fills and revision.
- Reject mismatched SQL and JSON revisions and malformed snapshots.
- Simulate a database outage; no simulated order may be reported as durably saved.

## Market data acceptance
- Verify actual public response schemas against recorded, timestamped fixtures.
- Distinguish exchange timestamps from local receipt times.
- Reject stale, crossed, incomplete or unreviewed books.
- Bind inventory to venue, market and outcome independently.

## Simulation acceptance
- Require confirmed simulated fills before creating exits.
- Model queue position, fees, partial fills and adverse price movements.
- Report realized and unrealized results separately; quoted spreads are not realized profit.
- Verify kill switch and exposure limits.
- Run a restart and replay test with no duplicate orders.

## Release gates
All checks require recorded evidence. Passing unit tests alone is not certification.
No production deployment or live order execution is authorized by this checklist.
