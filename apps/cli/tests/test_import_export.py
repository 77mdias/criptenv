"""Tests for import/export and doctor commands."""

import pytest
import tempfile
import os
from pathlib import Path
from click.testing import CliRunner

from criptenv.cli import main


@pytest.fixture
def runner():
    return CliRunner()


MASTER_PASSWORD = "testpass123"


class TestImportExport:
    """Test import/export .env file flow."""

    def _init(self, runner, mock_config_dir):
        """Helper: initialize CriptEnv."""
        result = runner.invoke(
            main, ["init"],
            input=f"{MASTER_PASSWORD}\n{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0

    def test_import_env_file(self, runner, mock_config_dir, tmp_path):
        """Should import secrets from a .env file."""
        self._init(runner, mock_config_dir)

        # Create a .env file
        env_file = tmp_path / "test.env"
        env_file.write_text(
            "# Comment line\n"
            "API_KEY=secret123\n"
            "DB_HOST=localhost\n"
            "DB_PORT=5432\n"
            "\n"  # empty line
            "QUOTED_VALUE=\"hello world\"\n"
        )

        # Import
        result = runner.invoke(
            main, ["import", str(env_file)],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "Imported 4 secret(s)" in result.output

        # Verify they were imported
        result = runner.invoke(
            main, ["list"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "API_KEY" in result.output
        assert "DB_HOST" in result.output
        assert "DB_PORT" in result.output
        assert "QUOTED_VALUE" in result.output

    def test_import_skip_existing(self, runner, mock_config_dir, tmp_path):
        """Should skip existing secrets without --overwrite."""
        self._init(runner, mock_config_dir)

        # Set a secret first
        runner.invoke(
            main, ["set", "API_KEY=original"],
            input=f"{MASTER_PASSWORD}\n"
        )

        # Create .env with same key
        env_file = tmp_path / "test.env"
        env_file.write_text("API_KEY=overwritten\nDB_HOST=localhost\n")

        # Import without --overwrite
        result = runner.invoke(
            main, ["import", str(env_file)],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "Skipped 1" in result.output
        assert "Imported 1" in result.output

        # Verify original value preserved
        result = runner.invoke(
            main, ["get", "API_KEY"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert "original" in result.output

    def test_import_overwrite(self, runner, mock_config_dir, tmp_path):
        """Should overwrite with --overwrite flag."""
        self._init(runner, mock_config_dir)

        runner.invoke(
            main, ["set", "API_KEY=original"],
            input=f"{MASTER_PASSWORD}\n"
        )

        env_file = tmp_path / "test.env"
        env_file.write_text("API_KEY=new_value\n")

        result = runner.invoke(
            main, ["import", str(env_file), "--overwrite"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "Imported 1" in result.output

        result = runner.invoke(
            main, ["get", "API_KEY"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert "new_value" in result.output

    def test_export_env_format(self, runner, mock_config_dir, tmp_path):
        """Should export secrets in .env format."""
        self._init(runner, mock_config_dir)

        # Set some secrets
        runner.invoke(main, ["set", "KEY_A=val_a"], input=f"{MASTER_PASSWORD}\n")
        runner.invoke(main, ["set", "KEY_B=val_b"], input=f"{MASTER_PASSWORD}\n")

        # Export to file
        output_file = tmp_path / "exported.env"
        result = runner.invoke(
            main, ["export", "-o", str(output_file)],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "Exported 2 secret(s)" in result.output

        # Verify file content
        content = output_file.read_text()
        assert "KEY_A=val_a" in content
        assert "KEY_B=val_b" in content

    def test_export_json_format(self, runner, mock_config_dir, tmp_path):
        """Should export secrets in JSON format."""
        self._init(runner, mock_config_dir)

        runner.invoke(main, ["set", "KEY_A=val_a"], input=f"{MASTER_PASSWORD}\n")

        output_file = tmp_path / "exported.json"
        result = runner.invoke(
            main, ["export", "--format", "json", "-o", str(output_file)],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0

        import json
        data = json.loads(output_file.read_text())
        assert data["KEY_A"] == "val_a"

    def test_export_empty(self, runner, mock_config_dir):
        """Should handle export with no secrets."""
        self._init(runner, mock_config_dir)

        result = runner.invoke(
            main, ["export"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "No secrets" in result.output

    def test_import_empty_file(self, runner, mock_config_dir, tmp_path):
        """Should handle empty .env file."""
        self._init(runner, mock_config_dir)

        env_file = tmp_path / "empty.env"
        env_file.write_text("# Only comments\n\n")

        result = runner.invoke(
            main, ["import", str(env_file)],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "No entries" in result.output


class TestDoctor:
    """Test doctor diagnostic command."""

    def test_doctor_not_initialized(self, runner, mock_config_dir):
        """Doctor should report missing config when not initialized."""
        result = runner.invoke(main, ["doctor"])
        assert result.exit_code == 0
        assert "CriptEnv Doctor" in result.output
        assert "missing" in result.output.lower() or "not configured" in result.output.lower()

    def test_doctor_initialized(self, runner, mock_config_dir):
        """Doctor should pass checks when initialized."""
        # Initialize
        runner.invoke(
            main, ["init"],
            input=f"{MASTER_PASSWORD}\n{MASTER_PASSWORD}\n"
        )

        result = runner.invoke(main, ["doctor"])
        assert result.exit_code == 0
        assert "Configuration directory exists" in result.output
        assert "vault database exists" in result.output
        assert "Master password configured" in result.output

    def test_doctor_verbose(self, runner, mock_config_dir):
        """Doctor --verbose should show extra details."""
        runner.invoke(
            main, ["init"],
            input=f"{MASTER_PASSWORD}\n{MASTER_PASSWORD}\n"
        )

        result = runner.invoke(main, ["doctor", "--verbose"])
        assert result.exit_code == 0
        assert "Path:" in result.output
