import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionCost, SessionRateLimit } from 'claude-code'

import type { Measure, PlanWindow, TokenTotals } from '../types'

const EMPTY: TokenTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0 }

const measure = atom({ plugin: 'status-band', key: 'measure' } as const, null)
const tokens = atom({ plugin: 'status-band', key: 'tokens' } as const, EMPTY)

const BAR_WIDTH = 10

// ---------------------------------------------------------------- formatting

/** `five_hour` → `5h`, `seven_day` → `7d`; anything else as a short word. */
export function windowLabel(kind: string): string {
  const known: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }
  return known[kind] ?? kind.replace(/_/g, ' ')
}

/** 1234 → `1.2k`, 1234567 → `1.2M`. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (n >= 1_000) return `${trim(n / 1_000)}k`
  return String(n)
}

function trim(n: number): string {
  return n >= 100 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, '')
}

/** A bar of BAR_WIDTH cells, filled to `percent`. */
export function bar(percent: number, width = BAR_WIDTH): string {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/** Green under 50%, amber under 80%, red from there. */
export function level(percent: number): 'success' | 'warning' | 'error' {
  return percent < 50 ? 'success' : percent < 80 ? 'warning' : 'error'
}

/** When a window resets: `in 42m`, `in 3h 10m`, or `Fri 09:00` past a day. */
export function formatReset(iso: string | undefined, now: number): string | undefined {
  if (iso === undefined) return undefined
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return undefined
  const mins = Math.max(0, Math.round((at - now) / 60_000))
  if (mins < 60) return `in ${mins}m`
  if (mins < 24 * 60) return `in ${Math.floor(mins / 60)}h ${mins % 60}m`
  const d = new Date(at)
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function totalTokens(t: TokenTotals): number {
  return t.input + t.output + t.cacheRead + t.cacheWrite
}

/** One plain line for the status line (VS Code shows only this). */
export function summary(m: Measure | null, t: TokenTotals): string | undefined {
  const parts: string[] = []
  for (const w of m?.plan ?? []) parts.push(`${windowLabel(w.kind)} ${Math.round(w.percentUsed)}%`)
  if (m?.contextPercent !== undefined) {
    parts.push(
      `ctx ${m.contextPercent}%` +
        (m.contextTokens !== undefined ? ` (${formatTokens(m.contextTokens)}/${formatTokens(m.contextWindow)})` : ''),
    )
  }
  if (t.requests > 0) parts.push(`${formatTokens(totalTokens(t))} tok`)
  if (m?.costUsd !== undefined && m.costUsd > 0) parts.push(`$${m.costUsd.toFixed(2)}`)
  return parts.length === 0 ? undefined : parts.join(' · ')
}

// ---------------------------------------------------------------- measuring

function toMeasure(context: SessionContextUsage, rateLimits: readonly SessionRateLimit[], cost?: SessionCost): Measure {
  return {
    plan: rateLimits.map(
      (r): PlanWindow => ({ kind: r.kind, percentUsed: r.percentUsed, ...(r.resetsAt ? { resetsAt: r.resetsAt } : {}) }),
    ),
    contextWindow: context.window,
    ...(context.tokens !== undefined ? { contextTokens: context.tokens } : {}),
    ...(context.percent !== undefined ? { contextPercent: context.percent } : {}),
    ...(cost !== undefined ? { costUsd: cost.usd } : {}),
  }
}

async function save($: EngineInterface, m: Measure): Promise<void> {
  await update($, measure, () => m)
  $.ui.status(summary(m, await read($, tokens)))
}

// ---------------------------------------------------------------- hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    try {
      const u = await $.session.usage()
      await save($, toMeasure(u.context, u.rateLimits, u.cost))
    } catch {
      // no figures yet; session.measure fills them in after the first turn
    }
    return result
  })

  // Pushed by the engine after each turn and whenever a plan window moves a point.
  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await save($, toMeasure(e.context, e.rateLimits, e.cost))
    return result
  })

  // Every model request (main loop and subagents): add its tokens to the session total.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const u = r.usage
    if (u !== null) {
      await update($, tokens, t => ({
        input: t.input + u.input_tokens,
        output: t.output + u.output_tokens,
        cacheRead: t.cacheRead + u.cache_read_input_tokens,
        cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
        requests: t.requests + 1,
      }))
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const m = await read($, measure)
    const t = await read($, tokens)

    if (e.props.hasSurvey || (m === null && t.requests === 0)) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const plan = m?.plan ?? []

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>Plan   </Text>
          {plan.length === 0 ? (
            <Text dimColor>limits show after the first reply (subscription only)</Text>
          ) : (
            plan.map((w, i) => {
              const reset = formatReset(w.resetsAt, now)
              return (
                <Text key={w.kind}>
                  {i > 0 && <Text dimColor>   </Text>}
                  <Text dimColor>{windowLabel(w.kind)} </Text>
                  <Text color={level(w.percentUsed)}>{bar(w.percentUsed)}</Text>
                  <Text color={level(w.percentUsed)} bold> {Math.round(w.percentUsed)}%</Text>
                  {reset !== undefined && <Text dimColor> ↻ {reset}</Text>}
                </Text>
              )
            })
          )}
        </Box>
        <Box>
          <Text bold>Context</Text>
          {m?.contextPercent !== undefined ? (
            <Text>
              <Text> </Text>
              <Text color={level(m.contextPercent)}>{bar(m.contextPercent)}</Text>
              <Text color={level(m.contextPercent)} bold> {m.contextPercent}%</Text>
              {m.contextTokens !== undefined && (
                <Text dimColor>
                  {' '}
                  {formatTokens(m.contextTokens)} / {formatTokens(m.contextWindow)}
                </Text>
              )}
            </Text>
          ) : (
            <Text dimColor> empty</Text>
          )}
          {t.requests > 0 && (
            <Text>
              <Text dimColor>   Session </Text>
              <Text color="claude">{formatTokens(totalTokens(t))}</Text>
              <Text dimColor> tokens ({formatTokens(t.output)} out)</Text>
            </Text>
          )}
          {m?.costUsd !== undefined && m.costUsd > 0 && <Text dimColor> · ${m.costUsd.toFixed(2)}</Text>}
        </Box>
      </Box>
    )
  })
}
