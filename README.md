# status-band

A Claude Code mod that keeps a one-line summary of your repository beside the prompt:

```
⎇ main · 3 changed · ✓ typecheck+lint+test at 14:02
```

- **Branch and changed files**: read from git when the session starts, after every Bash or PowerShell call, and when each turn ends. Shows `clean` when nothing has changed.
- **Last check result**: any shell command that runs `pnpm typecheck`, `pnpm lint` or `pnpm test` is recorded as ✓ passed or ✗ failed, with the time it finished. Until one runs, it shows `checks not run`.

In the terminal and the desktop app it draws as a band above the prompt. The same text is also pinned as a status line under the prompt, so it shows in VS Code too.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install status-band --marketplace basilnewagesmb/claude-status-band
```

Answer `y` to add the marketplace, then press Enter to pick the user scope.

From a shell:

```
claude plugin install status-band --marketplace basilnewagesmb/claude-status-band
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `basilnewagesmb/claude-status-band`, then **Add plugin**.

## Develop

```
claude plugin validate .
claude plugin test .
```
