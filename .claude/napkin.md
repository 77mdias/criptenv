# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-09-18] Documentation claims must be checked against source and commands**
   Do instead: verify routes, scripts, dependency manifests, deploy files, and test output before updating status.
2. **[2026-09-19] Cypress signup fixtures must not use example.com with a live Resend key**
   Do instead: use an accepted Resend test recipient or disable/mock Resend in the isolated E2E environment before relying on browser results.

## Shell & Command Reliability
1. **[2026-09-18] Prefer repository Make targets for validation**
   Do instead: inspect `Makefile` first, then run the narrowest applicable checks and record limitations.

## Domain Behavior Guardrails
1. **[2026-09-18] Keep zero-knowledge and deployment security claims evidence-based**
   Do instead: distinguish implemented behavior, configuration requirements, and roadmap items in docs.

## User Directives
1. **[2026-09-18] Keep project data, software information, usage, and documentation current**
   Do instead: audit the whole repository and update all affected documentation without inventing unsupported status.
