# Phase 2 Web UI TODO

## Execution Checklist

- [x] Read `apps/web/AGENTS.md` and local Next.js App Router docs before route/layout edits.
- [x] Fix frontend foundation lint issues: non-conditional `useId`, no synchronous state update effect violations, unused imports, and hook dependencies.
- [x] Update auth API/backend/frontend to generate and expose `kdf_salt`.
- [x] Update vault frontend contract to use `environment.id` and full blob payloads.
- [x] Add in-memory vault unlock UX using Web Crypto and `useCryptoStore`.
- [x] Refactor secrets UI into reusable components: `EnvSelector`, `SecretsTable`, `SecretRow`, `SecretForm`, `ImportModal`, `ExportModal`.
- [x] Implement real zero-knowledge secrets CRUD: decrypt on pull, encrypt on create/update, delete by pushing updated encrypted set.
- [x] Implement Audit Log timeline with filters, pagination/load more, and JSON export.
- [x] Implement Team/Invite UI with valid roles, invite revoke, role update, member remove, validation, and feedback states.
- [x] Add Command Palette with Cmd/Ctrl+K and core navigation/actions.
- [x] Polish responsive/accessibility states.
- [x] Run backend tests, frontend lint, and frontend build.

## Notes

- Secrets plaintext must never be sent to the backend.
- Vault keys remain in memory only and are lost on refresh.
- Full member key grants/wrapped DEK sharing remains out of scope for this pass.
