"""Vault API endpoint wrappers."""

from criptenv.api.client import CriptEnvClient


async def push_blobs(
    client: CriptEnvClient,
    project_id: str,
    env_id: str,
    blobs: list[dict],
) -> dict:
    """
    Push encrypted blobs to cloud vault.

    Args:
        client: Authenticated API client
        project_id: Project UUID
        env_id: Environment UUID
        blobs: List of encrypted blob dicts with keys:
            key_id, iv (base64), ciphertext (base64),
            auth_tag (base64), version, checksum

    Returns:
        Response with pushed blobs and version
    """
    return await client.push_vault(project_id, env_id, blobs)


async def pull_blobs(
    client: CriptEnvClient,
    project_id: str,
    env_id: str,
) -> dict:
    """
    Pull encrypted blobs from cloud vault.

    Returns:
        Response with blobs list and version
    """
    return await client.pull_vault(project_id, env_id)


async def get_version(
    client: CriptEnvClient,
    project_id: str,
    env_id: str,
) -> dict:
    """
    Get current vault version for an environment.

    Returns:
        Dict with 'version' and 'blob_count'
    """
    return await client.get_vault_version(project_id, env_id)
