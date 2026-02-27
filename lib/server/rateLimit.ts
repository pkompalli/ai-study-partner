type RateLimitConfig = {
  limit: number
  windowMs: number
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  limited: boolean
  retryAfterSeconds: number
}

declare global {
  // eslint-disable-next-line no-var
  var __aiStudyPartnerRateLimitStore: Map<string, RateLimitEntry> | undefined
}

const store = globalThis.__aiStudyPartnerRateLimitStore ?? new Map<string, RateLimitEntry>()
globalThis.__aiStudyPartnerRateLimitStore = store

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const existing = store.get(key)

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return { limited: false, retryAfterSeconds: 0 }
  }

  existing.count += 1
  store.set(key, existing)

  if (existing.count > config.limit) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  if (store.size > 10_000) {
    for (const [entryKey, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(entryKey)
    }
  }

  return { limited: false, retryAfterSeconds: 0 }
}
