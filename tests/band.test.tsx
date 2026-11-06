import { describe, expect, mock, test } from 'claude-code/testing'

import { bar, formatReset, formatTokens, level, windowLabel } from '../hooks/register'

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

describe('formatting', () => {
  test('tokens read short', () => {
    expect(formatTokens(950)).toBe('950')
    expect(formatTokens(82_400)).toBe('82.4k')
    expect(formatTokens(200_000)).toBe('200k')
    expect(formatTokens(1_250_000)).toBe('1.3M')
  })

  test('bars fill to the percent', () => {
    expect(bar(0)).toEqual(['', '──────'])
    expect(bar(50)).toEqual(['━━━', '───'])
    expect(bar(140)).toEqual(['━━━━━━', ''])
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
    expect(formatReset('2026-11-06T10:42:00Z', now)).toBe('42m')
    expect(formatReset('2026-11-06T13:05:00Z', now)).toBe('3h05m')
    expect(formatReset(undefined, now)).toBe(undefined)
  })
})

test('the band draws the plan windows and context after a measurement', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
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
    expect((await ui.find({ type: 'Text', text: /ctx/ }))?.text).toContain('41%')
    await ui.unmount()
  }
})

test('without plan limits the band shows only the context row', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  mock.clock(on)

  await $.session.measure({
    context: { tokens: 10_000, window: 200_000, percent: 5 },
    rateLimits: [],
    changed: ['context'],
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Plan/ })).toBe(undefined)
  expect((await ui.find({ type: 'Text', text: /5%/ }))?.text).toContain('5%')
  await ui.unmount()
})

test('a narrow band drops the bars and keeps the numbers', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  mock.clock(on)

  await $.session.measure({
    context: { tokens: 10_000, window: 200_000, percent: 50 },
    rateLimits: [],
    changed: ['context'],
  })

  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 50 }, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /50%/ }))?.text).toContain('50%')
  expect(await ui.find({ type: 'Text', text: /━/ })).toBe(undefined)
  await ui.unmount()
})
