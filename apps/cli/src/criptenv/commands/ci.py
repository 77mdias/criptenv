"""CI/CD Integration Commands for CriptEnv CLI.

Implements M3.3 CI Tokens Enhancement specification:
- ci-login: Login with CI token, save session locally
- ci-secrets: List available secrets for CI context
- ci-deploy: Deploy local secrets to cloud
- ci-tokens: Manage CI tokens (list, create, revoke)
"""

import asyncio
import base64
import json
import time
from typing import Optional

import click

from criptenv.api.client import CriptEnvClient
from criptenv.context import cli_context, _resolve_env_id
from criptenv.crypto import encrypt, decrypt
from criptenv.vault.models import CISession
from criptenv.vault import queries


# =============================================================================
# CI Session Management
# =============================================================================

class CISessionManager:
    """Manages encrypted CI session tokens in the local vault."""

    def __init__(self, master_key: bytes, db):
        self.master_key = master_key
        self.db = db
        self.client = CriptEnvClient()
        self._current_session: Optional[CISession] = None

    def _encrypt_token(self, token: str) -> bytes:
        """Encrypt token with master key. Returns iv + ciphertext + auth_tag."""
        ciphertext, iv, auth_tag, _ = encrypt(token.encode("utf-8"), self.master_key)
        return iv + ciphertext + auth_tag

    def _decrypt_token(self, encrypted: bytes) -> str:
        """Decrypt token from iv + ciphertext + auth_tag."""
        iv = encrypted[:12]
        ciphertext = encrypted[12:-16]
        auth_tag = encrypted[-16:]
        plaintext = decrypt(ciphertext, iv, auth_tag, self.master_key)
        return plaintext.decode("utf-8")

    async def ci_login(self, ci_token: str, project_id: Optional[str] = None) -> dict:
        """
        Login with CI token and store encrypted session locally.

        Args:
            ci_token: CI token from project settings (starts with 'ci_')
            project_id: Optional project ID override

        Returns:
            Session info dict with project_id, scopes, expires_at
        """
        # Call API to validate token and get session
        response = await self.client.ci_login(ci_token, project_id)
        session_token = response["session_token"]
        project_id = response["project_id"]
        project_name = response.get("project_name", "Unknown")
        scopes = response.get("permissions", ["read:secrets"])
        expires_in = response.get("expires_in", 3600)

        # Encrypt session token with master key
        token_encrypted = self._encrypt_token(session_token)

        # Store in local vault
        ci_session = CISession(
            id=f"ci_{int(time.time())}",
            project_id=project_id,
            project_name=project_name,
            session_token_encrypted=token_encrypted,
            scopes=scopes,
            environment_scope=None,
            created_at=int(time.time()),
            expires_at=int(time.time()) + expires_in,
        )
        await queries.save_ci_session(self.db, ci_session)

        # Set token on client for subsequent requests
        self.client.set_token(session_token)
        self._current_session = ci_session

        return {
            "project_id": project_id,
            "project_name": project_name,
            "scopes": scopes,
            "expires_in": expires_in,
        }

    async def get_active_session(self) -> Optional[CISession]:
        """Get the active (non-expired) CI session from local vault."""
        if self._current_session and not self._current_session.is_expired:
            return self._current_session

        session = await queries.get_active_ci_session(self.db)
        self._current_session = session
        return session

    async def get_authenticated_client(self) -> Optional[CriptEnvClient]:
        """Get an API client with a valid CI session token."""
        session = await self.get_active_session()
        if not session:
            return None

        token = self._decrypt_token(session.session_token_encrypted)
        self.client.set_token(token)
        return self.client

    async def logout(self):
        """Logout and clear local CI session."""
        await queries.delete_ci_session(self.db, self._current_session.id)
        self.client.clear_token()
        self._current_session = None


# =============================================================================
# CLI Commands
# =============================================================================

@click.group()
def ci():
    """CI/CD integration commands for automated workflows.

    These commands allow CI/CD systems to authenticate with CriptEnv
    using tokens and perform secret operations without user interaction.

    For non-interactive use, set CRIPTENV_MASTER_PASSWORD environment variable.
    """
    pass


@ci.command("login")
@click.option("--token", required=True, help="CI token from CriptEnv (starts with 'ci_')")
@click.option("--project", help="Project ID (optional, uses default from token)")
def ci_login(token: str, project: Optional[str]):
    """Login with CI token and save session locally.

    This command authenticates with CriptEnv using a CI token (not your
    user credentials). The session is stored encrypted locally and can
    be used by subsequent ci-secrets and ci-deploy commands.

    Example:
        criptenv ci login --token ci_abc123xyz
    """
    async def _do_login():
        with cli_context() as (db, master_key, _):
            manager = CISessionManager(master_key, db)
            result = await manager.ci_login(token, project)

            click.echo(f"✓ Logged in to project: {result['project_name']} ({result['project_id']})")
            click.echo(f"  Scopes: {', '.join(result['scopes'])}")
            click.echo(f"  Session expires in: {result['expires_in']} seconds")

    asyncio.run(_do_login())


@ci.command("logout")
def ci_logout():
    """Logout from CI session and clear local credentials."""
    async def _do_logout():
        with cli_context() as (db, master_key, _):
            manager = CISessionManager(master_key, db)
            session = await manager.get_active_session()

            if not session:
                click.echo("No active CI session found.")
                return

            await manager.logout()
            click.echo("✓ CI session logged out successfully.")

    asyncio.run(_do_logout())


@ci.command("secrets")
@click.option("--env", "environment", required=True, help="Environment name (e.g., production, staging)")
def ci_secrets(environment: str):
    """List secret keys available in CI context.

    Shows key names and versions for the specified environment.
    Values are NOT shown for security reasons.

    Example:
        criptenv ci secrets --env production
    """
    async def _do_list():
        with cli_context() as (db, master_key, _):
            manager = CISessionManager(master_key, db)
            session = await manager.get_active_session()

            if not session:
                click.echo("Error: No active CI session. Run 'criptenv ci login --token <token>' first.", err=True)
                return

            # Check environment scope
            if session.environment_scope and session.environment_scope != environment:
                click.echo(f"Error: Token is restricted to environment '{session.environment_scope}'", err=True)
                return

            client = await manager.get_authenticated_client()
            if not client:
                click.echo("Error: Invalid CI session. Run 'criptenv ci login --token <token>' again.", err=True)
                return

            try:
                secrets_data = await client.get_ci_secrets(session.project_id, environment)
                blobs = secrets_data.get("blobs", [])

                if not blobs:
                    click.echo(f"No secrets found in {environment} environment.")
                    return

                click.echo(f"Secrets in {environment} (showing keys only for security):")
                click.echo(f"  Version: {secrets_data.get('version', 'unknown')}")
                click.echo(f"  Count: {len(blobs)}")
                click.echo("")

                for blob in blobs:
                    key_id = blob.get("key_id", "unknown")
                    version = blob.get("version", 1)
                    click.echo(f"  {key_id:<40} v{version}")

            except Exception as e:
                click.echo(f"Error fetching secrets: {e}", err=True)

    asyncio.run(_do_list())


@ci.command("deploy")
@click.option("--env", "environment", required=True, help="Environment name")
@click.option("--provider", help="Sync to provider after push (e.g., vercel, railway, render)")
@click.option("--dry-run", is_flag=True, help="Show what would be deployed without actually deploying")
def ci_deploy(environment: str, provider: Optional[str], dry_run: bool):
    """Deploy local secrets to CriptEnv cloud.

    Pushes local vault secrets to CriptEnv cloud, then optionally
    syncs to connected providers.

    Example:
        criptenv ci deploy --env production --provider vercel
    """
    async def _do_deploy():
        with cli_context() as (db, master_key, _):
            manager = CISessionManager(master_key, db)
            session = await manager.get_active_session()

            if not session:
                click.echo("Error: No active CI session. Run 'criptenv ci login --token <token>' first.", err=True)
                return

            # Check environment scope
            if session.environment_scope and session.environment_scope != environment:
                click.echo(
                    f"Error: Token is restricted to environment '{session.environment_scope}'",
                    err=True
                )
                return

            # Resolve environment name to ID
            try:
                env_id = await _resolve_env_id(db, environment)
            except click.ClickException as e:
                click.echo(f"Error: {e.message}", err=True)
                return

            # Get local secrets for this environment
            local_secrets = await queries.list_secrets(db, env_id)

            if not local_secrets:
                click.echo(f"No local secrets found for environment '{environment}'.")
                return

            if dry_run:
                click.echo(f"[DRY RUN] Would deploy {len(local_secrets)} secret(s) to {environment}")
                for secret in local_secrets:
                    click.echo(f"  - {secret.key_id} (v{secret.version})")
                return

            click.echo(f"Deploying {len(local_secrets)} secret(s) to {environment}...")

            # Serialize blobs for API push
            blobs = []
            for secret in local_secrets:
                blobs.append({
                    "key_id": secret.key_id,
                    "iv": base64.b64encode(secret.iv).decode("ascii"),
                    "ciphertext": base64.b64encode(secret.ciphertext).decode("ascii"),
                    "auth_tag": base64.b64encode(secret.auth_tag).decode("ascii"),
                    "version": secret.version,
                    "checksum": secret.checksum,
                })

            # Push to API
            client = await manager.get_authenticated_client()
            if not client:
                click.echo("Error: Invalid CI session. Run 'criptenv ci login --token <token>' again.", err=True)
                return

            try:
                result = await client.push_vault(session.project_id, env_id, blobs)
                version = result.get("version", "unknown")
                click.echo(f"✓ Deployment complete (version {version})")
            except Exception as e:
                click.echo(f"Error pushing secrets: {e}", err=True)
                return

            # Optional provider sync
            if provider:
                click.echo(f"Syncing to {provider}...")
                try:
                    # Find integration for this provider
                    integrations = await client.list_integrations(session.project_id)
                    provider_integration = None
                    for integration in integrations:
                        if integration.get("provider") == provider:
                            provider_integration = integration
                            break

                    if not provider_integration:
                        click.echo(
                            f"Error: No {provider} integration found. "
                            f"Run 'criptenv integrations connect {provider}' first.",
                            err=True
                        )
                        return

                    await client.sync_integration(session.project_id, provider_integration["id"], direction="push")
                    click.echo(f"✓ Sync to {provider} complete")
                except Exception as e:
                    click.echo(f"Error syncing to {provider}: {e}", err=True)

    asyncio.run(_do_deploy())


# =============================================================================
# CI Tokens Management Subgroup
# =============================================================================

@ci.group("tokens")
def ci_tokens():
    """Manage CI tokens for this project.

    Requires admin access to the project.
    """
    pass


@ci_tokens.command("list")
@click.option("--include-revoked", is_flag=True, help="Include revoked tokens")
def ci_tokens_list(include_revoked: bool):
    """List CI tokens for the current project.

    Shows token name, scopes, environment restriction, last used,
    and creation date. The actual token value is never shown.

    Example:
        criptenv ci tokens list
    """
    async def _do_list():
        with cli_context() as (db, master_key, _):
            manager = CISessionManager(master_key, db)
            session = await manager.get_active_session()

            if not session:
                click.echo("Error: No active CI session. Run 'criptenv ci login --token <token>' first.", err=True)
                return

            client = await manager.get_authenticated_client()
            if not client:
                click.echo("Error: Invalid CI session.", err=True)
                return

            try:
                tokens = await client.list_ci_tokens(session.project_id, include_revoked)

                if not tokens:
                    click.echo("No CI tokens found.")
                    return

                click.echo(f"CI Tokens for project {session.project_id}:")
                click.echo("")

                for token in tokens:
                    name = token.get("name", "Unknown")
                    scopes = token.get("scopes", [])
                    env_scope = token.get("environment_scope") or "all"
                    last_used = token.get("last_used_at") or "never"
                    revoked = token.get("revoked_at")

                    status = "REVOKED" if revoked else "active"
                    status_color = "red" if revoked else "green"

                    click.echo(f"  {name}")
                    click.echo(f"    Scopes: {', '.join(scopes)}")
                    click.echo(f"    Environment: {env_scope}")
                    click.echo(f"    Last used: {last_used}")
                    click.echo(f"    Status: {status} ({status_color})")
                    click.echo("")

            except Exception as e:
                click.echo(f"Error listing tokens: {e}", err=True)

    asyncio.run(_do_list())


@ci_tokens.command("create")
@click.option("--name", required=True, help="Token name (e.g., 'GitHub Actions Deploy')")
@click.option("--scopes", default="read:secrets", help="Comma-separated scopes (default: read:secrets)")
@click.option("--environment", "environment_scope", help="Restrict to environment (e.g., production)")
@click.option("--expires-in", "expires_days", type=int, help="Days until expiration (default: no expiration)")
def ci_tokens_create(name: str, scopes: str, environment_scope: Optional[str], expires_days: Optional[int]):
    """Create a new CI token.

    Generates a new CI token with specified scopes. The token value
    is shown only ONCE at creation time - save it immediately!

    Example:
        criptenv ci tokens create --name "Deploy Bot" --scopes "read:secrets,write:secrets" --environment production
    """
    async def _do_create():
        with cli_context() as (db, master_key, _):
            manager = CISessionManager(master_key, db)
            session = await manager.get_active_session()

            if not session:
                click.echo("Error: No active CI session. Run 'criptenv ci login --token <token>' first.", err=True)
                return

            client = await manager.get_authenticated_client()
            if not client:
                click.echo("Error: Invalid CI session.", err=True)
                return

            # Parse scopes
            scope_list = [s.strip() for s in scopes.split(",")]

            try:
                result = await client.create_ci_token(
                    project_id=session.project_id,
                    name=name,
                    scopes=scope_list,
                    environment_scope=environment_scope,
                    expires_days=expires_days,
                )

                click.echo("✓ CI Token created successfully!")
                click.echo("")
                click.echo("  IMPORTANT: Save this token now! It will not be shown again.")
                click.echo("")
                click.echo(f"  Token: {result['token']}")
                click.echo(f"  Name: {result['token_info']['name']}")
                click.echo(f"  Scopes: {', '.join(result['token_info']['scopes'])}")
                if result['token_info'].get('environment_scope'):
                    click.echo(f"  Environment: {result['token_info']['environment_scope']}")

            except Exception as e:
                click.echo(f"Error creating token: {e}", err=True)

    asyncio.run(_do_create())


@ci_tokens.command("revoke")
@click.argument("token_id")
@click.option("--force", is_flag=True, help="Skip confirmation prompt")
def ci_tokens_revoke(token_id: str, force: bool):
    """Revoke a CI token.

    Revocation immediately invalidates the token. Any workflows
    using this token will fail.

    Example:
        criptenv ci tokens revoke 550e8400-e29b-41d4-a716-446655440000
    """
    async def _do_revoke():
        with cli_context() as (db, master_key, _):
            manager = CISessionManager(master_key, db)
            session = await manager.get_active_session()

            if not session:
                click.echo("Error: No active CI session.", err=True)
                return

            if not force:
                if not click.confirm(f"Revoke token {token_id}? This cannot be undone."):
                    click.echo("Aborted.")
                    return

            client = await manager.get_authenticated_client()
            if not client:
                click.echo("Error: Invalid CI session.", err=True)
                return

            try:
                await client.revoke_ci_token(session.project_id, token_id)
                click.echo("✓ Token revoked successfully.")

            except Exception as e:
                click.echo(f"Error revoking token: {e}", err=True)

    asyncio.run(_do_revoke())


# Export commands for registration
ci_group = ci
ci_login_command = ci_login
ci_logout_command = ci_logout
ci_secrets_command = ci_secrets
ci_deploy_command = ci_deploy
ci_tokens_group = ci_tokens
ci_tokens_list_command = ci_tokens_list
ci_tokens_create_command = ci_tokens_create
ci_tokens_revoke_command = ci_tokens_revoke
