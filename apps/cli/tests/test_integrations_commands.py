from click.testing import CliRunner

from criptenv.cli import main


def test_integrations_commands_are_registered():
    runner = CliRunner()

    result = runner.invoke(main, ["integrations", "--help"])

    assert result.exit_code == 0
    assert "list" in result.output
    assert "connect" in result.output
    assert "disconnect" in result.output
    assert "sync" in result.output


def test_railway_connect_reports_provider_gap():
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

    assert result.exit_code == 0
    assert "Railway provider is not implemented yet" in result.output


def test_ci_deploy_without_session_reports_login_hint(mock_config_dir, monkeypatch):
    runner = CliRunner()
    monkeypatch.setenv("CRIPTENV_MASTER_PASSWORD", "password")

    init = runner.invoke(main, ["init"], input="password\npassword\n")
    assert init.exit_code == 0

    result = runner.invoke(main, ["ci", "deploy", "--env", "production"])

    assert result.exit_code == 0
    assert "No active CI session" in result.output
