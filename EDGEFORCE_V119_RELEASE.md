# Edgeforce V119 — Production Gate Correctness

V119 closes two false-negative production gates exposed after V118 fixed the underlying runtime failures.

## Vercel comparative canary

V118's deployment guard returned a valid PASS with `hardBlock:false`, but the workflow parsed it with:

```
jq -r '.hardBlock // true'
```

In jq, `false // true` evaluates to `true`, so the workflow incorrectly reported a hard blocker.

V119 preserves an explicit boolean false with an existence check and only defaults to true when the field is actually missing.

## Cloudflare strict launch doctor

V118 proved the Worker-safe prediction-intelligence fix: the warehouse prime completed successfully instead of failing with Worker resource error 1102.

The next Cloudflare gate then failed at a one-shot strict launch-doctor request, while the workflow hid the response body behind `curl --fail`.

V119:
- records the launch-doctor response body on every attempt
- parses `ready` and release version explicitly
- requires two successful V119-ready responses out of three attempts
- retries short transient readiness misses
- still fails closed if repeated current-release readiness cannot be demonstrated

## Certified pulse readiness continuity

Cloudflare production re-runs strict readiness immediately after provider certification. When the direct pulse recheck is transiently unavailable, V119 may bridge only the `oddsProvider` readiness failure from the just-persisted current-release FanDuel pulse certification.

The bridge is bounded to:
- current release only
- launch-ready provider certification
- provider id `fanlinewire-fanduel-pulse`
- status `CERTIFIED`
- certification age <= 2 minutes
- no other strict readiness failure

Any database, migration, secret, bankroll, model-version, demo-data, or other readiness failure still blocks.

## Identity

- build: V119
- app: 119.0.0
- package: 0.119.0
- model: edgeforce-v119
- migration: v114
