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
    from click.shell_completion import get_completion_class
    from criptenv.cli import main

    completion_class = get_completion_class(shell)
    if completion_class is None:
        raise click.ClickException(f"Unsupported shell: {shell}")

    comp = completion_class(main, {}, "criptenv", "_CRIPTENV_COMPLETE")
    click.echo(comp.source())
