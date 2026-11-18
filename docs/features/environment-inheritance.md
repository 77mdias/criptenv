# Environment inheritance (child environments)

A **child environment** inherits every secret of a **parent** and stores only what it changes.
Typical use: one child per git worktree, so parallel agents or branches share `dev`'s secrets
but each gets its own port, database name or webhook secret.

```
dev                      DATABASE_URL, PORT=3000, SENTRY_DSN, STRIPE_KEY
└── dev/wt-feature-x     PORT=3101            (override)
                         unset SENTRY_DSN     (hidden here, dev keeps it)
```

`dev/wt-feature-x` resolves to `DATABASE_URL` and `STRIPE_KEY` (from `dev`), `PORT=3101` (its own),
and no `SENTRY_DSN`.

## Rules

- **Resolution:** the nearest environment wins: child > parent > grandparent. Each level first drops
  the keys it unsets, then lays its own values on top. An unset in a middle level hides the key from
  there down; a lower level can set it again.
- **Propagation:** a child stores only its overrides, so any change in the parent shows up in the
  child on the next read. Nothing is copied.
- **Depth:** at most `ENV_INHERITANCE_MAX_DEPTH` parent hops (default 3, API setting). The parent
  is chosen at creation and never changes, so a cycle cannot be built through the API; the resolver
  refuses one anyway (and refuses a chain that is too deep).
- **Names:** `^[a-z0-9-]+(/[a-z0-9-]+)*$`. The `parent/child` form is a convention, not enforced.
- **Restricted:** a child of a restricted environment is restricted too, and stays so. A parent
  with open children cannot be restricted (an open child would hand out the restricted values).
- **Ephemeral children (TTL):** `ttl_seconds` (1 minute to 90 days) only on a child, never on a root
  environment. A child never outlives its ancestors: its expiry is clamped to theirs. An expired
  child is not found right away; a job deletes it every 15 minutes (`environment.expired` in the
  audit log). **Children with a TTL do not count against the plan's environment limit.**
- **Deleting:** a child is deleted for good, with its own values only; the parent is untouched and
  the name is free again. CI tokens and API keys scoped to it are revoked, so a token for an old
  worktree never reaches a new environment created later under the same name. An environment with
  live children cannot be deleted (409). A root environment is still archived, as before.
- **Zero-knowledge is unchanged:** the server resolves on key names (already plaintext) and never
  sees a value. Each resolved blob carries the `environment_id` of the environment holding it and is
  decrypted with that environment's key on the client.

## Permission rule

| Credential | Child (`dev/wt-x`) | Parent (`dev`) |
|---|---|---|
| Member of the project (session) | same rules as any environment | same rules as any environment |
| CI token or API key **scoped to `dev/wt-x`** | reads the resolved set (`/vault/resolved`, `/ci/secrets`): its own values plus the inherited ones it neither overrides nor unsets | **no** pull, list, version, resolved or push: 403/404 |
| CI token scoped to `dev/wt-x` with `write:secrets` | pushes the child's own values and unset list | **no** |
| API key (any scope) | read-only, as always | read-only |

- A credential scoped to a child receives the inherited values at runtime (that is what `run`
  injects), never the parent's values it overrides or unsets, and cannot read or change the parent
  directly.
- Tokens can be restricted to one environment (`environment_scope`), read-only (API keys always;
  CI tokens without `write:secrets`) and expire (`expires_at`). Expired and revoked credentials are
  refused.
- What zero-knowledge cannot prevent: whoever can run the child sees the inherited values that
  reach the process. Scope a credential to the child, not to the parent, to keep the rest of the
  parent's history and overrides out of its reach.

## Audit

Key names and origins only, never a value, IV or ciphertext.

| Action | Metadata |
|---|---|
| `environment.created` | name, parent, expiry |
| `environment.deleted` / `environment.expired` | name, parent, reason (`manual` / `ttl`) |
| `vault.pushed` | `changes`: keys `added`, `updated`, `removed`, `unset`, `restored`; the CI token when there is one |
| `vault.pulled` | environment, auth type, API key id, `keys: [{key, source, origin}]` |
| `vault.resolved_read` | environment, auth type, API key id or CI token id, `keys: [{key, source, origin}]` |

## API

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/projects/{p}/environments` | `parent_id`, `ttl_seconds` (child only) |
| `GET` | `/api/v1/projects/{p}/environments/{e}` | adds `parent_id`, `expires_at`, `unset_keys` |
| `GET` | `/api/v1/projects/{p}/environments/{e}/diff` | key names vs the parent: `override`, `added`, `unset`, `inherited` |
| `DELETE` | `/api/v1/projects/{p}/environments/{e}` | a child is deleted for good |
| `GET` | `/api/v1/projects/{p}/environments/{e}/vault/resolved` | resolved blobs with `origin` and `source_environment_name` |
| `GET` | `/api/v1/projects/{p}/environments/{e}/vault/pull` | the environment's own blobs + `unset_keys` (what a client edits) |
| `POST` | `/api/v1/projects/{p}/environments/{e}/vault/push` | `unset_keys` (child only; omitted keeps the current list) |
| `GET` | `/api/v1/ci/secrets?environment=dev/wt-x` | resolved, each blob with its source `environment_id` |

## Git worktrees: one child per worktree

```bash
# once per worktree
git worktree add ../app-feature-x -b feature-x
criptenv env create dev/wt-feature-x --parent dev --ttl 7d
criptenv set PORT=3101 --env dev/wt-feature-x
criptenv set DB_NAME=app_feature_x --env dev/wt-feature-x
criptenv set WEBHOOK_SECRET=whsec_local_x --env dev/wt-feature-x
criptenv unset SENTRY_DSN --env dev/wt-feature-x

# check what it resolves to (values masked) and how it differs from dev
criptenv env show dev/wt-feature-x --resolved
criptenv env diff dev/wt-feature-x

# run the app (or the agent) in that worktree
cd ../app-feature-x
criptenv run --env dev/wt-feature-x -- docker compose up

# when the branch is merged (or let the TTL do it)
criptenv env delete dev/wt-feature-x --force
git worktree remove ../app-feature-x
```

For an agent that must not touch anything else, give it a read-only API key scoped to the child:
`criptenv api-keys create --name agent-x --env dev/wt-feature-x --expires-days 7` and
`CRIPTENV_API_KEY=... CRIPTENV_VAULT_PASSWORD=... criptenv run --env dev/wt-feature-x -- <command>`.

## Known limitations

- **Older CLIs** (and older copies of the GitHub Action) decrypt every blob with the environment's
  own key: on a child they fail on the first inherited value. Update the CLI before using children.
- **Re-parenting** is not supported: the parent is fixed at creation (delete and recreate the child).
- **TTL cannot be extended** after creation.
- **Web pushes re-encrypt every value**, so a push from the dashboard lists every key as `updated` in
  the audit log; CLI pushes list only what changed.
- **Rotation, expiration alerts and the per-environment secret count** work on a child's own values,
  not on the inherited ones (rotate those in the parent).
- **The secrets matrix** (`/secrets/matrix`) shows each environment's own keys, not the resolved set.
- **Migration downgrade** keeps every environment and secret but drops the parent link, the unset
  lists and the expiries: children become standalone environments holding only their overrides.
