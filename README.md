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

Or at the prompt of a Claude Code terminal session:

```
/plugin marketplace add basilnewagesmb/status-band
/plugin install status-band@claude-status-band
```

`basilnewagesmb/status-band` is the GitHub repository; `claude-status-band` is the marketplace name it declares. Then reload the VS Code window or start a new session so the band loads.

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `basilnewagesmb/status-band`, then **Add plugin**.

## Develop

```
claude plugin validate .
claude plugin test .
```
