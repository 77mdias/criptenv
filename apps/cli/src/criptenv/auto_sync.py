"""Auto-sync: after a save, send the environment to the hosting connections bound to it.

The server never holds the vault password, so "automatic" happens here, in the
client that just saved with the vault open. A failure never undoes the save and
never changes the command's exit code: it is reported with the manual command.
"""

from __future__ import annotations

from typing import Any, Sequence

import click

from criptenv.remote_vault import RemoteVault


async def auto_sync(
    client: Any,
    vault: RemoteVault,
    project_id: str,
    env_name: str | None,
    removed_keys: Sequence[str] = (),
) -> None:
    """Push ``env_name`` (as saved) to every connection bound to it; remove ``removed_keys`` there."""
    try:
        envelope = await client.integrations_envelope(project_id)
        bound = [item for item in envelope.get("integrations", []) if item.get("auto_sync_targets")]
        # The binding stays stored on any plan; it only applies while the owner's plan has auto_sync.
        if "auto_sync" not in envelope.get("features", []) or not bound:
            return

        state = await vault.load_state(env_name)
        targets = [
            (item, item["auto_sync_targets"][state.environment.id])
            for item in bound
            if state.environment.id in item["auto_sync_targets"]
        ]
        if not targets:
            return

        entries = await vault.decrypt_all(state)
        kinds = {blob["key_id"]: blob.get("kind") for blob in state.blobs}
        secrets = [
            {"key": key, "value": value, **({"kind": kinds[key]} if kinds.get(key) else {})}
            for key, value in entries.items()
        ]
    except Exception as e:  # noqa: BLE001 - the save already happened; nothing here may fail the command
        click.echo(f"⚠ Auto-sync skipped: {e or type(e).__name__}. Your secrets are saved.", err=True)
        return

    for integration, target in targets:
        name = integration.get("name") or integration.get("provider", "provider")
        result: dict[str, Any] = {}
        try:
            result = await client.sync_integration(
                project_id,
                integration["id"],
                direction="push",
                environment=target,
                secrets=secrets,
                delete_keys=list(removed_keys),
            )
            failure = None if result.get("success") else (result.get("message") or "unknown error")
        except Exception as e:  # noqa: BLE001
            failure = str(e) or type(e).__name__

        if failure:
            # The retry must carry the removals too, or a deleted secret would stay live at the host.
            not_removed = f" Not removed at {name}: {', '.join(removed_keys)}." if removed_keys else ""
            delete_flags = "".join(f" --delete {key}" for key in removed_keys)
            click.echo(
                f"⚠ Could not send to {name}: {failure}. Your secrets are saved.{not_removed} Retry with: "
                f"criptenv integrations sync --provider {integration.get('provider')} "
                f"--integration {integration['id']} --env {state.environment.name} --target {target}{delete_flags}",
                err=True,
            )
        else:
            deploy = " — deploy in about a minute" if result.get("deploy_scheduled") else ""
            click.echo(f"✓ Sent to {name} ({target}){deploy}")
