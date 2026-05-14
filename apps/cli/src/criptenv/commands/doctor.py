"""Diagnostic command for troubleshooting."""

import click

from criptenv.config import CONFIG_DIR, DB_FILE, API_BASE_URL
from criptenv.context import local_vault, run_async
from criptenv.vault import queries


@click.command()
@click.option("--verbose", "-v", is_flag=True, help="Show detailed output")
def doctor_command(verbose: bool):
    """Check CriptEnv configuration and connectivity.

    Runs diagnostics to verify that everything is set up correctly.

    \b
    Checks:
      • Configuration directory exists
      • Local metadata database is accessible
      • Session is valid
      • API server is reachable

    \b
    Examples:
        criptenv doctor
        criptenv doctor --verbose
    """
    click.echo("CriptEnv Doctor")
    click.echo("=" * 40)
    click.echo("")

    checks_passed = 0
    checks_failed = 0

    # Check 1: Config directory
    if CONFIG_DIR.exists():
        click.echo("  ✓ Configuration directory exists")
        if verbose:
            click.echo(f"    Path: {CONFIG_DIR}")
        checks_passed += 1
    else:
        click.echo("  ✗ Configuration directory missing")
        click.echo("    Run 'criptenv init' to create it")
        checks_failed += 1

    # Check 2: Metadata database file
    if DB_FILE.exists():
        click.echo("  ✓ Local metadata database exists")
        if verbose:
            import os
            size = os.path.getsize(DB_FILE)
            click.echo(f"    Path: {DB_FILE} ({size} bytes)")
        checks_passed += 1
    else:
        click.echo("  ✗ Local metadata database missing")
        click.echo("    Run 'criptenv init' to create it")
        checks_failed += 1

    # Check 3: Session and lightweight metadata
    try:
        with local_vault() as db:
            session = run_async(queries.get_active_session(db))
            if session:
                if session.is_expired:
                    click.echo("  ✗ Session expired")
                    click.echo("    Run 'criptenv login' to re-authenticate")
                    checks_failed += 1
                else:
                    click.echo(f"  ✓ Active session ({session.email})")
                    if verbose:
                        import time
                        expires = time.strftime("%Y-%m-%d %H:%M", time.localtime(session.expires_at))
                        click.echo(f"    Expires: {expires}")
                    checks_passed += 1
            else:
                click.echo("  ⚠ No active session")
                click.echo("    Run 'criptenv login' to authenticate")
                # Not a failure for local-only usage

            if verbose:
                current_project = run_async(queries.get_config(db, "current_project_id"))
                if current_project:
                    click.echo(f"  ℹ Current project: {current_project}")

    except Exception as e:
        click.echo(f"  ✗ Database error: {e}")
        checks_failed += 1

    # Check 4: API connectivity
    try:
        import httpx
        response = httpx.get(f"{API_BASE_URL}/health", timeout=5.0)
        if response.status_code == 200:
            click.echo(f"  ✓ API server reachable ({API_BASE_URL})")
            checks_passed += 1
        else:
            click.echo(f"  ⚠ API server responded with {response.status_code}")
    except Exception:
        click.echo(f"  ⚠ API server not reachable ({API_BASE_URL})")
        if verbose:
            click.echo("    This is OK for local-only usage")

    # Summary
    click.echo("")
    click.echo("─" * 40)
    if checks_failed == 0:
        click.echo(f"✓ All checks passed ({checks_passed})")
    else:
        click.echo(f"✗ {checks_failed} check(s) failed, {checks_passed} passed")
