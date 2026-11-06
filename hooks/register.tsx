import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CheckRun, GitInfo } from '../types'

const git = atom({ plugin: 'status-band', key: 'git' } as const, null)
const check = atom({ plugin: 'status-band', key: 'check' } as const, null)

const CHECK_STEP = /\bpnpm\s+(?:run\s+)?(typecheck|lint|test)\b/g

/** The pnpm checks a shell command runs, in order; empty when it runs none. */
export function checkSteps(command: string): string[] {
  return [...command.matchAll(CHECK_STEP)].map(m => m[1] ?? '')
}

export function formatTime(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** One plain line for the status line (the band's words, for surfaces without a band). */
export function summary(info: GitInfo | null, last: CheckRun | null): string | undefined {
  const parts: string[] = []
  if (info !== null) {
    parts.push(`⎇ ${info.branch}`, info.dirty === 0 ? 'clean' : `${info.dirty} changed`)
  }
  if (last !== null) {
    parts.push(`${last.isPassed ? '✓' : '✗'} ${last.steps.join('+')} at ${formatTime(last.at)}`)
  } else if (info !== null) {
    parts.push('checks not run')
  }
  return parts.length === 0 ? undefined : parts.join(' · ')
}

async function readGit($: EngineInterface): Promise<GitInfo | null> {
  try {
    const head = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
    if (head.exitCode !== 0) return null
    const status = await $.process.run(['git', 'status', '--porcelain'])
    const dirty = status.stdout.split('\n').filter(line => line.trim() !== '').length
    return { branch: head.stdout.trim(), dirty }
  } catch {
    return null
  }
}

async function refreshGit($: EngineInterface): Promise<void> {
  const info = await readGit($)
  await update($, git, () => info)
  $.ui.status(summary(info, await read($, check)))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refreshGit($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refreshGit($)
    return result
  })

  // A shell call may switch branches, commit, or run the checks.
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    const ran = await next(e)
    const steps = checkSteps(e.command)

    if (steps.length > 0 && ran.deny === undefined) {
      const run: CheckRun = {
        steps,
        isPassed: ran.isError !== true,
        at: await $.clock.now(),
      }
      await update($, check, () => run)
    }

    await refreshGit($)
    return ran
  }).catch(($, e, next) => next(e)) // never let the band block a shell call

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const info = await read($, git)
    const last = await read($, check)

    if (e.props.hasSurvey || (info === null && last === null)) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        {info !== null && (
          <Text>
            <Text color="suggestion">⎇ {info.branch}</Text>
            <Text dimColor> · </Text>
            {info.dirty === 0 ? (
              <Text color="success">clean</Text>
            ) : (
              <Text color="warning">
                {info.dirty} changed
              </Text>
            )}
          </Text>
        )}
        {info !== null && last !== null && <Text dimColor> · </Text>}
        {last !== null && (
          <Text>
            <Text color={last.isPassed ? 'success' : 'error'}>
              {last.isPassed ? '✓' : '✗'} {last.steps.join('+')}
            </Text>
            <Text dimColor> at {formatTime(last.at)}</Text>
          </Text>
        )}
        {last === null && <Text dimColor> · checks not run</Text>}
      </Box>
    )
  })
}
