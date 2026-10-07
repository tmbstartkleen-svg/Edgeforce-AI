# Edgeforce V133 — Vercel Verification Retry Hardening

V133 hardens the Vercel production release workflow against transient control-plane read failures.

## What changed

- Identity-critical Vercel deployment and alias GET requests now use bounded retries for transport failures.
- Retry behavior is limited to idempotent read-only verification calls.
- Production promote and rollback mutations remain single-shot and are never covered by retry-all-errors.
- Regression coverage verifies the retry policy on baseline capture, staged candidate verification, pre-promotion alias checks, post-promotion convergence, and live identity verification.

## Why

The V132 candidate deployed successfully and Vercel reported it READY on the exact release commit. The release stopped only because the subsequent read-only alias verification request timed out after 30 seconds. V133 prevents a transient Vercel control-plane read timeout from discarding a valid staged candidate while preserving fail-closed identity validation.
