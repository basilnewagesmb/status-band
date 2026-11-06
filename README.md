# status-band

A Claude Code mod that shows how much of your Claude usage you've spent, in a band above the prompt:

```
Plan    5h ██████░░░░ 62% ↻ in 1h 12m   7d ██░░░░░░░░ 18% ↻ Fri 09:00
Context ████░░░░░░ 41% 82.4k / 200k   Session 1.2M tokens (45k out) · $1.84
```

- **Plan**: each rate-limit window of your subscription (5-hour, 7-day), how full it is and when it resets. Reported by the API after the first reply; API-key sessions have no plan windows.
- **Context**: how much of the model's context window the conversation fills.
- **Session**: tokens summed over every model request this session (input, cache and output), and the session cost.

Bars turn amber at 50% and red at 80%. The figures update after each turn and whenever a plan window moves.

In the terminal and the desktop app it draws as a band above the prompt. A one-line version is also pinned as the status line, so it shows in VS Code too:

```
5h 62% · 7d 18% · ctx 41% (82.4k/200k) · 1.2M tok · $1.84
```

## Install

From a shell:

```
claude plugin marketplace add basilnewagesmb/status-band
claude plugin install status-band@claude-status-band
```

Or at the prompt of a Claude Code terminal session (the `claude` CLI; `/plugin` is not available in the VS Code chat panel, so use the shell commands above there):

```
/plugin marketplace add basilnewagesmb/status-band
/plugin install status-band@claude-status-band
```

`basilnewagesmb/status-band` is the GitHub repository; `claude-status-band` is the marketplace name it declares. Then reload the VS Code window or start a new session so the band loads.

### In VS Code

The Claude chat panel in VS Code has no `/plugin` command, so install from VS Code's terminal:

1. Open a terminal: `` Ctrl+` `` (or **Terminal → New Terminal**).
2. Add the marketplace and install the plugin:

   ```
   claude plugin marketplace add basilnewagesmb/status-band
   claude plugin install status-band@claude-status-band
   ```

   If the terminal says `claude` is not recognized, the CLI is not on your PATH. On Windows, use its full path instead (PowerShell):

   ```powershell
   & "$env:USERPROFILE\.local\bin\claude.exe" plugin marketplace add basilnewagesmb/status-band
   & "$env:USERPROFILE\.local\bin\claude.exe" plugin install status-band@claude-status-band
   ```

3. Reload VS Code: `Ctrl+Shift+P` → **Developer: Reload Window**.
4. Open the Claude panel and send a message. After the first reply, the usage line shows under the prompt:

   ```
   5h 62% · 7d 18% · ctx 41% (82.4k/200k) · 1.2M tok · $1.84
   ```

   VS Code shows this one-line status; the two-row band with bars draws in the terminal CLI and the desktop app.

To update to a newer version later, run these in the terminal, then reload the window:

```
claude plugin marketplace update claude-status-band
claude plugin update status-band@claude-status-band
```

### In the desktop app

Where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `basilnewagesmb/status-band`, then **Add plugin**.

## Develop

```
claude plugin validate .
claude plugin test .
```
