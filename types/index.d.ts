export type GitInfo = { branch: string; dirty: number }

export type CheckRun = {
  /** Which checks the command ran, e.g. ["typecheck", "lint", "test"]. */
  steps: string[]
  isPassed: boolean
  /** Epoch milliseconds when the command finished. */
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'status-band': { git: GitInfo | null; check: CheckRun | null }
  }
}
