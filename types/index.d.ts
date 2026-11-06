/** One rate-limit window of the plan, as the last API response reported it. */
export type PlanWindow = {
  /** `five_hour`, `seven_day`, a gateway's `spend_limit`, ... */
  kind: string
  /** 0 to 100; past 100 on an exceeded spend limit. */
  percentUsed: number
  /** ISO 8601 time the window resets. */
  resetsAt?: string
}

/** What the engine last measured: plan windows, context fill and cost. */
export type Measure = {
  plan: PlanWindow[]
  /** Input tokens of the last response (uncached + cache read + cache write). */
  contextTokens?: number
  /** The model's context window, in tokens. */
  contextWindow: number
  /** contextTokens / contextWindow, 0 to 100. */
  contextPercent?: number
  /** US dollars this session. */
  costUsd?: number
}

/** Tokens summed over every model request this session. */
export type TokenTotals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  requests: number
}

declare module 'claude-code' {
  interface PluginState {
    'status-band': { measure: Measure | null; tokens: TokenTotals }
  }
}
