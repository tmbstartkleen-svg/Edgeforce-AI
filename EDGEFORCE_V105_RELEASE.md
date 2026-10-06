# Edgeforce V105 — Production Closure Orchestration

V105 removes the remaining manual cross-platform release gap.

## Release contract

A successful `Verify Edgeforce` run on `main` is the source of truth for production deployment.

Both Vercel and Cloudflare:
- trigger only after the verified main workflow completes successfully
- deploy the exact `workflow_run.head_sha`
- preserve manual `workflow_dispatch` as an operator fallback
- write production convergence evidence against that exact commit
- attempt the V104 final closure certificate after production evidence is recorded

Cloudflare additionally stamps `DEPLOYMENT_COMMIT` into the generated Worker configuration before deploy, so live runtime identity is commit-addressable.

## Identity

- build: V105
- app: 105.0.0
- package: 0.105.0
- model: edgeforce-v105
- migration: v114 (unchanged)
