# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** criptenv
- **Date:** 2026-05-02
- **Prepared by:** TestSprite AI Team, completed by Codex
- **Test Scope:** Backend API, codebase scope
- **Local Target:** `http://localhost:8000/api/v1/health`
- **Execution Mode:** Development server, FastAPI on port `8000`
- **Environment Note:** API was started with `DEBUG=false` to override the local `apps/api/.env` value `DEBUG=release`, which is not a valid boolean for Pydantic settings.

---

## 2️⃣ Requirement Validation Summary

### Requirement: User Signup
- **Description:** The API should allow valid user registration and return a documented authentication response.

#### Test TC001 post api auth signup user creation
- **Test Code:** [TC001_post_api_auth_signup_user_creation.py](./TC001_post_api_auth_signup_user_creation.py)
- **Test Error:** `AssertionError: Expected 201 Created, got 422`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/5dd74ecd-e680-4447-abff-aa0a7554f45d
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The generated test sent only `email` and `password`, but the real `UserSignup` schema also requires `name`. This is primarily a test-contract mismatch. Separately, the generated test expected a top-level `user_id`, while the actual response model is nested as `user.id` with `session` and `token`.
---

### Requirement: User Login and Authenticated Profile Access
- **Description:** The API should allow valid login and authenticated session/profile access using the documented auth routes.

#### Test TC002 post api auth login valid credentials
- **Test Code:** [TC002_post_api_auth_login_valid_credentials.py](./TC002_post_api_auth_login_valid_credentials.py)
- **Test Error:** `AssertionError: Expected status code 200, got 404`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/6d554a67-01a1-4282-8ac7-bac4c4db8369
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The generated test called `/api/auth/login`, but the implemented route is `/api/auth/signin`. This is a route naming mismatch, not proof that signin is broken.
---

#### Test TC003 get api profile authorized access
- **Test Code:** [TC003_get_api_profile_authorized_access.py](./TC003_get_api_profile_authorized_access.py)
- **Test Error:** `AssertionError: Signup response missing user_id`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/8553d603-27e3-414b-9e8b-db62a6a9b74a
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The test could not establish an authenticated user because it expected `user_id` at the top level. The implemented profile/session route is `/api/auth/session`, not `/api/profile`.
---

### Requirement: Authorized Project Management
- **Description:** Authenticated users should be able to create and manage projects through the implemented project API.

#### Test TC004 post api projects create project authorized
- **Test Code:** [TC004_post_api_projects_create_project_authorized.py](./TC004_post_api_projects_create_project_authorized.py)
- **Test Error:** `AssertionError: Signup response missing user_id`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/e929365e-6a26-47a3-8adc-ca6c59c89ba2
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The project creation flow was blocked by the same auth setup mismatch. The implemented project creation route is `/api/v1/projects`, while the generated test assumptions around auth response shape do not match the code.
---

### Requirement: Zero-Knowledge Vault Sync
- **Description:** Authenticated users should be able to push encrypted vault blobs without exposing plaintext secrets.

#### Test TC005 post api vaults push encrypted blob
- **Test Code:** [TC005_post_api_vaults_push_encrypted_blob.py](./TC005_post_api_vaults_push_encrypted_blob.py)
- **Test Error:** `requests.exceptions.HTTPError: 422 Client Error: Unprocessable Content for url: http://localhost:8000/api/auth/signup`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/904543c7-48b4-40de-9998-e4ae0c1fa4c2
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The test never reached vault push because signup failed validation. The generated endpoint shape `/api/vaults/{project_id}/{env_id}/push` does not match the implemented route `/api/v1/projects/{project_id}/environments/{environment_id}/vault/push`.
---

### Requirement: Secret Metadata and Rotation-Adjacent Workflows
- **Description:** Secret metadata, expiration, and related project-scoped operations should be reachable through documented API routes.

#### Test TC006 post api projects secrets create secret metadata
- **Test Code:** [TC006_post_api_projects_secrets_create_secret_metadata.py](./TC006_post_api_projects_secrets_create_secret_metadata.py)
- **Test Error:** `requests.exceptions.HTTPError: 422 Client Error: Unprocessable Content for url: http://localhost:8000/api/auth/signup`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/7e4b3607-a760-44da-a9f3-b1dd177d2426
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The test was blocked by invalid signup payload assumptions. It also assumes a `/api/projects/{project_id}/secrets` route; this project primarily stores secrets as encrypted vault blobs, with rotation/expiration APIs under the implemented v1 routers.
---

### Requirement: Team Invites
- **Description:** Authenticated project members should be able to create project invites with appropriate role data.

#### Test TC007 post api projects invites create invite
- **Test Code:** [TC007_post_api_projects_invites_create_invite.py](./TC007_post_api_projects_invites_create_invite.py)
- **Test Error:** `AssertionError`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/4551affa-c76b-464c-af53-c660ee2c0ba7
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The invite test could not complete auth setup. It should be regenerated against the actual signup/signin response and route structure before using this as a product failure.
---

### Requirement: CI Tokens
- **Description:** Authenticated users should be able to create scoped CI tokens and receive one-time token values.

#### Test TC008 post api projects ci tokens create ci token
- **Test Code:** [TC008_post_api_projects_ci_tokens_create_ci_token.py](./TC008_post_api_projects_ci_tokens_create_ci_token.py)
- **Test Error:** `AssertionError: Signup failed: {"detail":[{"type":"missing","loc":["body","name"],"msg":"Field required"...`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/452c560d-d4ef-484b-9ba6-9592a28254ae
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The CI token workflow was blocked at signup because the generated payload omitted `name`. The test should be regenerated with the actual auth schema before validating CI token behavior.
---

### Requirement: Audit Logs
- **Description:** Authenticated project members should be able to retrieve audit logs for authorized projects.

#### Test TC009 get api projects audit logs authorized
- **Test Code:** [TC009_get_api_projects_audit_logs_authorized.py](./TC009_get_api_projects_audit_logs_authorized.py)
- **Test Error:** `AssertionError: Signup failed with status 422`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/62a4eb30-cf6e-496b-a088-295848b6be91
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The audit test did not reach the audit endpoint because auth setup failed. Endpoint validation remains inconclusive from this run.
---

### Requirement: Webhook Registration
- **Description:** Project integrations should support webhook registration or notification delivery where implemented.

#### Test TC010 post api projects webhooks register webhook
- **Test Code:** [TC010_post_api_projects_webhooks_register_webhook.py](./TC010_post_api_projects_webhooks_register_webhook.py)
- **Test Error:** `AssertionError: user_id missing after signup`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b5a99e1b-bf23-46df-a160-95e21e63ab09/8bfd0c4e-fa22-47b9-909f-99435b06924a
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The test assumes a top-level `user_id` after signup and a project webhook registration route. The codebase currently has webhook delivery services for expiration notifications, but route availability for registering project webhooks needs to be checked against the implemented integrations API before this test can be considered authoritative.
---

## 3️⃣ Coverage & Matching Metrics

- **0% of generated TestSprite tests passed.**
- **10 generated backend tests executed.**
- **0 tests passed, 10 tests failed.**
- **Primary failure category:** Generated test contract did not match the implemented API contract.

| Requirement | Total Tests | ✅ Passed | ❌ Failed |
|-------------|-------------|-----------|-----------|
| User Signup | 1 | 0 | 1 |
| User Login and Authenticated Profile Access | 2 | 0 | 2 |
| Authorized Project Management | 1 | 0 | 1 |
| Zero-Knowledge Vault Sync | 1 | 0 | 1 |
| Secret Metadata and Rotation-Adjacent Workflows | 1 | 0 | 1 |
| Team Invites | 1 | 0 | 1 |
| CI Tokens | 1 | 0 | 1 |
| Audit Logs | 1 | 0 | 1 |
| Webhook Registration | 1 | 0 | 1 |

---

## 4️⃣ Key Gaps / Risks

> 0% of generated tests passed, but this run mostly exposed mismatches between TestSprite's inferred API contract and the actual FastAPI implementation.

- The generated tests used `/api/auth/login`; the implemented endpoint is `/api/auth/signin`.
- The generated signup payload omitted `name`, which is required by `UserSignup`.
- The generated tests expected top-level `user_id` and `session_token`; the actual `AuthResponse` returns nested `user`, nested `session`, and `token`.
- Several generated endpoint paths do not match the implemented v1 route layout, especially project, vault, and profile/session routes.
- The API server could not start with the checked-in/local `.env` value `DEBUG=release`; it required an environment override `DEBUG=false`.
- Local baseline `make test` previously failed because API tests use async pytest markers but the API install path does not install `pytest-asyncio`.
- Security issue CR-01 remains visible in code: `AuthResponse` returns `token` in the response body while also setting an HTTP-only cookie. This is documented as a P0 issue in project docs.
- Recommended next TestSprite pass: regenerate tests with explicit API contract instructions for `POST /api/auth/signup` including `name`, `POST /api/auth/signin`, `GET /api/auth/session`, and the `/api/v1/...` route structure.
---
