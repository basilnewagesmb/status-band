import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionCost, SessionRateLimit } from 'claude-code'

import type { Measure, PlanWindow, TokenTotals } from '../types'

const EMPTY: TokenTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0 }

const measure = atom({ plugin: 'status-band', key: 'measure' } as const, null)
const tokens = atom({ plugin: 'status-band', key: 'tokens' } as const, EMPTY)

const BAR_WIDTH = 6
/** Below this many columns the band drops its bars and keeps the numbers. */
const BARS_MIN_COLUMNS = 76

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

/** A thin bar of `width` cells: the filled part and the rest, drawn in two colors. */
export function bar(percent: number, width = BAR_WIDTH): [filled: string, rest: string] {
  const n = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return ['━'.repeat(n), '─'.repeat(width - n)]
}

/** Green under 50%, amber under 80%, red from there. */
export function level(percent: number): 'success' | 'warning' | 'error' {
  return percent < 50 ? 'success' : percent < 80 ? 'warning' : 'error'
}

/** When a window resets, short: `42m`, `3h10m`, or the weekday past a day. */
export function formatReset(iso: string | undefined, now: number): string | undefined {
  if (iso === undefined) return undefined
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return undefined
  const mins = Math.max(0, Math.round((at - now) / 60_000))
  if (mins < 60) return `${mins}m`
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}m`
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(at).getDay()]
}

export function totalTokens(t: TokenTotals): number {
  return t.input + t.output + t.cacheRead + t.cacheWrite
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
}

// ---------------------------------------------------------------- hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    $.ui.status(undefined) // clear the status line an earlier version pinned
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
    const hasBars = e.props.bodyColumns >= BARS_MIN_COLUMNS

    const gauge = (key: string, label: string, percent: number, reset?: string) => {
      const [filled, rest] = bar(percent)
      return (
        <Text key={key}>
          <Text dimColor>{label} </Text>
          {hasBars && (
            <Text>
              <Text color={level(percent)}>{filled}</Text>
              <Text dimColor>{rest} </Text>
            </Text>
          )}
          <Text color={level(percent)}>{Math.round(percent)}%</Text>
          {reset !== undefined && <Text dimColor> ↻{reset}</Text>}
        </Text>
      )
    }

    const parts = [
      ...(m?.plan ?? []).map(w => gauge(w.kind, windowLabel(w.kind), w.percentUsed, formatReset(w.resetsAt, now))),
      ...(m?.contextPercent !== undefined ? [gauge('ctx', 'ctx', m.contextPercent)] : []),
      ...(t.requests > 0
        ? [
            <Text key="tok">
              {formatTokens(totalTokens(t))}
              <Text dimColor> tok</Text>
            </Text>,
          ]
        : []),
      ...(m?.costUsd !== undefined && m.costUsd > 0
        ? [
            <Text key="usd" dimColor>
              ${m.costUsd.toFixed(2)}
            </Text>,
          ]
        : []),
    ]

    return (
      <Box>
        <Text>
          {parts.map((part, i) => (
            <Text key={`p${i}`}>
              {i > 0 && <Text dimColor> · </Text>}
              {part}
            </Text>
          ))}
        </Text>
      </Box>
    )
  })
}
