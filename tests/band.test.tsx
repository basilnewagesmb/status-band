import { describe, expect, mock, test } from 'claude-code/testing'

import { bar, formatReset, formatTokens, level, summary, windowLabel } from '../hooks/register'

const BAND = {
  plugin: 'status-band',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 5 },
    view: {},
  },
} as const

const NO_TOKENS = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0 }

describe('formatting', () => {
  test('tokens read short', () => {
    expect(formatTokens(950)).toBe('950')
    expect(formatTokens(82_400)).toBe('82.4k')
    expect(formatTokens(200_000)).toBe('200k')
    expect(formatTokens(1_250_000)).toBe('1.3M')
  })

  test('bars fill to the percent', () => {
    expect(bar(0)).toBe('░░░░░░░░░░')
    expect(bar(62)).toBe('██████░░░░')
    expect(bar(140)).toBe('██████████')
  })

  test('colors step at 50 and 80', () => {
    expect(level(49)).toBe('success')
    expect(level(50)).toBe('warning')
    expect(level(80)).toBe('error')
  })

  test('window names', () => {
    expect(windowLabel('five_hour')).toBe('5h')
    expect(windowLabel('seven_day')).toBe('7d')
    expect(windowLabel('seven_day_opus')).toBe('seven day opus')
  })

  test('reset times count down within a day', () => {
    const now = Date.parse('2026-11-06T10:00:00Z')
    expect(formatReset('2026-11-06T10:42:00Z', now)).toBe('in 42m')
    expect(formatReset('2026-11-06T13:10:00Z', now)).toBe('in 3h 10m')
    expect(formatReset(undefined, now)).toBe(undefined)
  })
})

describe('summary', () => {
  test('says nothing before any measurement', () => {
    expect(summary(null, NO_TOKENS)).toBe(undefined)
  })

  test('lists plan windows, context, tokens and cost', () => {
    expect(
      summary(
        {
          plan: [
            { kind: 'five_hour', percentUsed: 62.4 },
            { kind: 'seven_day', percentUsed: 18 },
          ],
          contextTokens: 82_400,
          contextWindow: 200_000,
          contextPercent: 41,
          costUsd: 1.844,
        },
        { input: 2_000, output: 45_000, cacheRead: 1_100_000, cacheWrite: 50_000, requests: 9 },
      ),
    ).toBe('5h 62% · 7d 18% · ctx 41% (82.4k/200k) · 1.2M tok · $1.84')
  })
})

test('the band draws the plan windows and context after a measurement', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.status', () => ({ value: undefined }))
  mock.clock(on)

  await $.session.measure({
    context: { tokens: 82_400, window: 200_000, percent: 41 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 62 },
      { kind: 'seven_day', percentUsed: 18 },
    ],
    cost: { usd: 1.84 },
    changed: ['context', 'rateLimits', 'cost'],
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /62%/ }))?.text).toContain('62%')
    expect((await ui.find({ type: 'Text', text: /18%/ }))?.text).toContain('18%')
    expect((await ui.find({ type: 'Text', text: /82\.4k/ }))?.text).toContain('200k')
    await ui.unmount()
  }
})

test('without a subscription the band says plan limits are not reported yet', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.status', () => ({ value: undefined }))
  mock.clock(on)

  await $.session.measure({
    context: { tokens: 10_000, window: 200_000, percent: 5 },
    rateLimits: [],
    changed: ['context'],
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /limits show/ }))?.text).toContain('first reply')
  await ui.unmount()
})
