"""Shell completion command."""

import click


@click.command("completion")
@click.argument("shell", type=click.Choice(["bash", "zsh", "fish"]))
def completion_command(shell: str):
    """Generate shell completion script.

    Add the output to your shell configuration file:

    \b
    Bash:
        criptenv completion bash >> ~/.bashrc
    Zsh:
        criptenv completion zsh >> ~/.zshrc
    Fish:
        criptenv completion fish > ~/.config/fish/completions/criptenv.fish
    """
    from click.shell_completion import ShellComplete
    from criptenv.cli import main

    comp = ShellComplete(main, {}, shell, "criptenv")
    click.echo(comp.source())
