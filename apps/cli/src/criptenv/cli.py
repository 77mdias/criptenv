"""CriptEnv CLI - Entry point"""

import click

from criptenv import __version__
from criptenv.commands.init import init_command
from criptenv.commands.login import login_command, logout_command
from criptenv.commands.secrets import set_command, get_command, list_command, delete_command
from criptenv.commands.sync import push_command, pull_command
from criptenv.commands.environments import env_group
from criptenv.commands.projects import projects_group
from criptenv.commands.doctor import doctor_command
from criptenv.commands.import_export import import_command, export_command


@click.group()
@click.version_option(version=__version__, prog_name="criptenv")
def main():
    """CriptEnv - Zero-Knowledge secret management.

    All secrets are encrypted client-side before storage.
    The server NEVER sees plaintext.
    """
    pass


# Register commands
main.add_command(init_command)
main.add_command(login_command)
main.add_command(logout_command)
main.add_command(set_command)
main.add_command(get_command)
main.add_command(list_command, name="list")
main.add_command(delete_command)
main.add_command(push_command)
main.add_command(pull_command)
main.add_command(env_group)
main.add_command(projects_group)
main.add_command(doctor_command)
main.add_command(import_command, name="import")
main.add_command(export_command)


if __name__ == "__main__":
    main()
