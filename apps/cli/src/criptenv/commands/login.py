"""Authentication commands with browser-based OAuth, device flow, and API key support."""

import asyncio
import getpass
import http.server
import socket
import socketserver
import threading
import time
import webbrowser
from urllib.parse import urlparse, parse_qs

import click

from criptenv.context import local_vault, run_async
from criptenv.crypto.keys import derive_master_key
from criptenv.vault import queries
from criptenv.session import SessionManager
from criptenv.api.client import CriptEnvClient


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _find_free_port() -> int:
    """Find a free TCP port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _open_browser(url: str):
    """Open the system default browser."""
    try:
        webbrowser.open(url, new=2)  # new=2 -> new tab
    except Exception:
        pass


def _prompt_master_password() -> tuple[bytes, str]:
    """Prompt for master password and return (master_key, salt_hex)."""
    with local_vault() as db:
        salt_hex = run_async(queries.get_config(db, "master_salt"))
        if not salt_hex:
            click.echo("Error: Run 'criptenv init' first", err=True)
            raise SystemExit(1)

        master_password = getpass.getpass("Master password: ")
        master_key = derive_master_key(master_password, bytes.fromhex(salt_hex))
        return master_key, salt_hex


# ─── Browser Login Flow ──────────────────────────────────────────────────────

class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler that captures the auth code from browser redirect."""

    auth_code: str | None = None
    error: str | None = None
    event: threading.Event = threading.Event()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if "code" in params:
            _CallbackHandler.auth_code = params["code"][0]
            self._send_success()
        elif "error" in params:
            _CallbackHandler.error = params["error"][0]
            self._send_error(params["error"][0])
        else:
            self._send_error("Missing authorization code")

        _CallbackHandler.event.set()

    def _send_success(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write("""<!DOCTYPE html>
<html>
<head><title>CriptEnv CLI - Authorized</title></head>
<body style="font-family: system-ui; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #e5e5e5;">
  <div style="text-align: center;">
    <div style="font-size: 48px; margin-bottom: 16px;">&#10003;</div>
    <h1 style="margin: 0 0 8px;">Authentication successful!</h1>
    <p style="color: #888;">You can close this window and return to the terminal.</p>
  </div>
</body>
</html>""".encode('utf-8'))

    def _send_error(self, message: str):
        self.send_response(400)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        html = f"""<!DOCTYPE html>
<html>
<head><title>CriptEnv CLI - Error</title></head>
<body style="font-family: system-ui; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #e5e5e5;">
  <div style="text-align: center;">
    <div style="font-size: 48px; margin-bottom: 16px;">&#10007;</div>
    <h1 style="margin: 0 0 8px;">Authentication failed</h1>
    <p style="color: #888;">{message}</p>
  </div>
</body>
</html>""".encode('utf-8')
        self.wfile.write(html)

    def log_message(self, format, *args):
        # Suppress default HTTP server logging
        pass


async def _browser_login(master_key: bytes, db) -> dict:
    """Perform browser-based login via localhost redirect."""
    port = _find_free_port()
    callback_url = f"http://127.0.0.1:{port}/callback"

    # Reset handler state
    _CallbackHandler.auth_code = None
    _CallbackHandler.error = None
    _CallbackHandler.event.clear()

    # Start temporary HTTP server in a thread
    server = socketserver.TCPServer(("127.0.0.1", port), _CallbackHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    client = CriptEnvClient()

    try:
        # Initiate CLI auth flow
        click.echo("Initiating browser login...")
        init_data = await client.cli_initiate(callback_url)
        auth_url = init_data["auth_url"]

        click.echo("")
        click.echo("A browser window will open for authentication.")
        click.echo("If it doesn't, open this URL manually:")
        click.echo(f"  {auth_url}")
        click.echo("")

        _open_browser(auth_url)

        # Wait for callback (max 5 minutes)
        click.echo("Waiting for authorization...")
        got_callback = _CallbackHandler.event.wait(timeout=300)

        if not got_callback:
            raise click.ClickException("Timeout waiting for browser authorization.")

        if _CallbackHandler.error:
            raise click.ClickException(f"Browser authorization failed: {_CallbackHandler.error}")

        if not _CallbackHandler.auth_code:
            raise click.ClickException("No authorization code received.")

        # Exchange code for token
        click.echo("Authenticating...")
        token_data = await client.cli_token(_CallbackHandler.auth_code)
        token = token_data["token"]
        user = token_data["user"]

        # Store session
        manager = SessionManager(master_key, db)
        await manager.login_with_token(token, user)

        return user

    finally:
        server.shutdown()
        server.server_close()


# ─── Device Flow ─────────────────────────────────────────────────────────────

async def _device_login(master_key: bytes, db) -> dict:
    """Perform device authorization grant login."""
    client = CriptEnvClient()

    click.echo("Starting device authorization flow...")
    device_data = await client.device_code()

    device_code = device_data["device_code"]
    user_code = device_data["user_code"]
    verification_uri = device_data["verification_uri"]
    interval = device_data.get("interval", 5)

    click.echo("")
    click.echo("=" * 50)
    click.echo("Device Authorization")
    click.echo("=" * 50)
    click.echo("")
    click.echo(f"User code: {click.style(user_code, fg='yellow', bold=True)}")
    click.echo("")
    click.echo("Open this URL in your browser:")
    click.echo(f"  {click.style(verification_uri, fg='cyan', underline=True)}")
    click.echo("")
    click.echo("Or go to your account settings and enter the code above.")
    click.echo("")
    click.echo("Waiting for authorization...")
    click.echo("")

    _open_browser(verification_uri)

    # Poll until authorized or expired
    start_time = time.time()
    max_wait = 600  # 10 minutes

    while time.time() - start_time < max_wait:
        await asyncio.sleep(interval)

        poll_data = await client.device_poll(device_code)
        status = poll_data.get("status")

        if status == "authorized":
            token = poll_data["access_token"]
            user = poll_data["user"]

            manager = SessionManager(master_key, db)
            await manager.login_with_token(token, user)
            return user

        elif status == "expired":
            raise click.ClickException("Device code expired. Please try again.")

        # Still pending — show a spinner-like indicator
        click.echo(".", nl=False)

    raise click.ClickException("Timeout waiting for device authorization.")


# ─── API Key Login ───────────────────────────────────────────────────────────

async def _api_key_login(master_key: bytes, db, api_key: str) -> dict:
    """Login using an API key."""
    client = CriptEnvClient()
    client.set_token(api_key)

    # Validate the API key by fetching session
    try:
        user = await client.get_session()
    except Exception as e:
        raise click.ClickException(f"Invalid API key: {e}")

    # Store the API key as the session token
    manager = SessionManager(master_key, db)
    await manager.login_with_token(api_key, user)

    return user


# ─── Commands ────────────────────────────────────────────────────────────────

@click.command()
@click.option("--email", "email_flag", is_flag=True, help="Use email/password login (legacy)")
@click.option("--device", "device_flag", is_flag=True, help="Use device authorization flow")
@click.option("--api-key", "api_key_value", default=None, help="Login with an API key")
@click.option("--email-address", "email_address", default=None, help="Email for legacy login")
@click.option("--password", default=None, help="Password for legacy login")
def login_command(
    email_flag: bool,
    device_flag: bool,
    api_key_value: str | None,
    email_address: str | None,
    password: str | None,
):
    """Login to CriptEnv.

    By default, opens a browser for OAuth/web authentication.
    Falls back to email/password with --email.

    \b
    Examples:
        criptenv login                      # Browser-based OAuth login
        criptenv login --email              # Email/password login
        criptenv login --device             # Device code flow (for SSH/headless)
        criptenv login --api-key cek_xxx    # Login with API key
    """
    master_key, _ = _prompt_master_password()

    with local_vault() as db:
        manager = SessionManager(master_key, db)

        try:
            if api_key_value:
                user = run_async(_api_key_login(master_key, db, api_key_value))
            elif device_flag:
                user = run_async(_device_login(master_key, db))
            elif email_flag or email_address:
                # Legacy email/password login
                email = email_address or click.prompt("Email")
                password = password or getpass.getpass("Password: ")
                user = run_async(manager.login(email, password))
            else:
                # Default: browser-based login
                user = run_async(_browser_login(master_key, db))

        except click.ClickException:
            raise
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)

    click.echo(f"✓ Logged in as {user.get('email', 'unknown')}")
    if user.get('name') and user['name'] != user.get('email'):
        click.echo(f"  Name: {user['name']}")
    click.echo(f"  User ID: {user.get('id', 'unknown')}")


@click.command()
def logout_command():
    """Logout and clear local session.

    \b
    Examples:
        criptenv logout
    """
    with local_vault() as db:
        salt_hex = run_async(queries.get_config(db, "master_salt"))
        if not salt_hex:
            click.echo("Error: Run 'criptenv init' first", err=True)
            raise SystemExit(1)

        master_password = getpass.getpass("Master password: ")
        master_key = derive_master_key(master_password, bytes.fromhex(salt_hex))

        manager = SessionManager(master_key, db)

        try:
            run_async(manager.logout())
        except Exception as e:
            click.echo(f"Warning: {e}", err=True)

    click.echo("✓ Logged out successfully")
