import { describe, expect, mock, test } from 'claude-code/testing'

import { checkSteps, summary } from '../hooks/register'

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

describe('checkSteps', () => {
  test('finds the pnpm checks a command runs', () => {
    expect(checkSteps('pnpm typecheck && pnpm lint && pnpm test')).toEqual([
      'typecheck',
      'lint',
      'test',
    ])
    expect(checkSteps('pnpm run test -- --watch=false')).toEqual(['test'])
    expect(checkSteps('git status')).toEqual([])
  })
})

describe('summary', () => {
  test('says nothing when there is nothing to say', () => {
    expect(summary(null, null)).toBe(undefined)
  })

  test('names branch, changes and a check not yet run', () => {
    expect(summary({ branch: 'main', dirty: 0 }, null)).toBe('⎇ main · clean · checks not run')
    expect(summary({ branch: 'feat/x', dirty: 3 }, null)).toBe('⎇ feat/x · 3 changed · checks not run')
  })
})

test('the band shows the branch and the last check after a shell call', async ($, on) => {
  // Nothing sits beneath the plugin: these hooks stand for the engine.
  on('process.run', (_, e) =>
    e.argv.includes('rev-parse')
      ? { value: { exitCode: 0, stdout: 'main\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
      : { value: { exitCode: 0, stdout: ' M a.ts\n?? b.ts\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } },
  )
  mock.clock(on)
  on('tool.call', () => ({ result: {}, isError: true }))

  await $.tool.call({ tool: 'Bash', command: 'pnpm typecheck && pnpm lint' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /main/ }))?.text).toContain('main')
  expect((await ui.find({ type: 'Text', text: /2 changed/ }))?.text).toContain('2 changed')
  expect((await ui.find({ type: 'Text', text: /✗/ }))?.text).toContain('typecheck+lint')
  await ui.unmount()
})
