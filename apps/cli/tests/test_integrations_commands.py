from click.testing import CliRunner
from unittest.mock import patch, AsyncMock, MagicMock

from criptenv.cli import main


def _make_mock_db():
    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock())
    return db


def test_integrations_commands_are_registered():
    runner = CliRunner()

    result = runner.invoke(main, ["integrations", "--help"])

    assert result.exit_code == 0
    assert "list" in result.output
    assert "connect" in result.output
    assert "disconnect" in result.output
    assert "sync" in result.output
    assert "validate" in result.output


def test_railway_connect_rejected_as_invalid_choice():
    runner = CliRunner()

    result = runner.invoke(
        main,
        [
            "integrations",
            "connect",
            "railway",
            "--token",
            "railway-token",
            "--project-id",
            "railway-project",
        ],
    )

    assert result.exit_code == 2
    assert "Invalid value" in result.output


@patch("criptenv.commands.integrations.cli_context")
def test_integrations_validate(mock_ctx):
    runner = CliRunner()
    mock_client = AsyncMock()
    mock_client.validate_integration = AsyncMock(return_value={"status": "valid", "message": "OK"})
    mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
    mock_ctx.return_value.__exit__ = lambda s, *a: None

    result = runner.invoke(main, ["integrations", "validate", "int_123", "--project", "prj_123"])
    assert result.exit_code == 0
    assert "valid" in result.output


@patch("criptenv.commands.integrations.cli_context")
def test_integrations_validate_invalid(mock_ctx):
    runner = CliRunner()
    mock_client = AsyncMock()
    mock_client.validate_integration = AsyncMock(return_value={"status": "invalid", "message": "Token expired"})
    mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
    mock_ctx.return_value.__exit__ = lambda s, *a: None

    result = runner.invoke(main, ["integrations", "validate", "int_123", "--project", "prj_123"])
    assert result.exit_code == 0
    assert "invalid" in result.output


def test_ci_deploy_without_session_reports_login_hint(mock_config_dir, monkeypatch):
    runner = CliRunner()
    monkeypatch.setenv("CRIPTENV_MASTER_PASSWORD", "password")

    init = runner.invoke(main, ["init"], input="password\npassword\n")
    assert init.exit_code == 0

    result = runner.invoke(main, ["ci", "deploy", "--env", "production"])

    assert result.exit_code == 0
    assert "No active CI session" in result.output
