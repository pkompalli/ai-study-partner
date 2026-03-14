/**
 * Image service orchestrator.
 *
 * Pipeline: Search (multi-source) → Score (fast heuristic) → Threshold → Generate (AI fallback)
 * Includes in-memory cache to avoid redundant lookups.
 */

import { searchImages } from './sources'
import { scoreImages, type ScoredImage } from './scorer'
import { generateEducationalImage } from './generator'

const SCORE_THRESHOLD = 60 // Strict — prefer showing nothing over a wrong image; generation fills the gap

export type ImageResult =
  | { type: 'found'; url: string; thumbUrl: string; title: string; attribution: string; license: string; score: number }
  | { type: 'generated'; base64: string; mimeType: string; alt: string }
  | { type: 'none' }

// ─── In-memory cache (survives across requests within the same server process) ─

const cache = new Map<string, { result: ImageResult; ts: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const MAX_CACHE_SIZE = 200

function getCached(key: string): ImageResult | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.result
}

function setCache(key: string, result: ImageResult): void {
  // Evict oldest if full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { result, ts: Date.now() })
}

// ─── Dedup in-flight requests ────────────────────────────────────────────────

const inflight = new Map<string, Promise<ImageResult>>()

// ─── Main resolver ───────────────────────────────────────────────────────────

export async function resolveImage(query: string, alt: string): Promise<ImageResult> {
  const cacheKey = `${query}|||${alt}`

  // Check cache first
  const cached = getCached(cacheKey)
  if (cached) {
    console.log(`[imageService] cache hit for: "${query}"`)
    return cached
  }

  // Dedup concurrent requests for the same query
  const existing = inflight.get(cacheKey)
  if (existing) {
    console.log(`[imageService] dedup in-flight for: "${query}"`)
    return existing
  }

  const promise = _resolveImage(query, alt)
  inflight.set(cacheKey, promise)

  try {
    const result = await promise
    // Don't cache failures — allow retries on next request
    if (result.type !== 'none') {
      setCache(cacheKey, result)
    }
    return result
  } finally {
    inflight.delete(cacheKey)
  }
}

async function _resolveImage(query: string, alt: string): Promise<ImageResult> {
  const start = Date.now()
  console.log(`[imageService] resolving image for: "${query}"`)

  // Step 1: Multi-source search
  let candidates = await searchImages(query)
  console.log(`[imageService] found ${candidates.length} candidates (${Date.now() - start}ms)`)

  // If no results, try a simplified query
  if (candidates.length === 0) {
    const simplified = query.split(/\s+/).filter(w => w.length > 2).slice(0, 3).join(' ')
    if (simplified !== query && simplified.length > 3) {
      console.log(`[imageService] retrying with simplified query: "${simplified}"`)
      candidates = await searchImages(simplified)
      console.log(`[imageService] retry found ${candidates.length} candidates`)
    }
  }

  if (candidates.length > 0) {
    // Step 2: Fast heuristic scoring (no LLM calls — instant)
    const scored = await scoreImages(candidates, query, alt)
    logScores(scored)

    // Step 3: Check threshold
    const best = scored[0]
    if (best && best.score.total >= SCORE_THRESHOLD) {
      console.log(`[imageService] accepted: "${best.candidate.title}" (score: ${best.score.total}, ${Date.now() - start}ms)`)
      return {
        type: 'found',
        url: best.candidate.url,
        thumbUrl: best.candidate.thumbUrl,
        title: best.candidate.title,
        attribution: best.candidate.attribution,
        license: best.candidate.license,
        score: best.score.total,
      }
    }

    console.log(`[imageService] best score ${best?.score.total ?? 0} < ${SCORE_THRESHOLD} threshold`)
  }

  // Step 4: AI generation fallback — always try, with retry on failure
  console.log(`[imageService] falling back to AI generation (${Date.now() - start}ms)`)
  let generated = await generateEducationalImage(query, alt)
  if (!generated) {
    // Retry with simplified query
    const simpleQuery = query.split(/\s+/).filter(w => w.length > 2).slice(0, 4).join(' ')
    console.log(`[imageService] generation failed, retrying with: "${simpleQuery}" (${Date.now() - start}ms)`)
    generated = await generateEducationalImage(simpleQuery, alt)
  }
  if (generated) {
    console.log(`[imageService] AI generation succeeded (${Date.now() - start}ms)`)
    return {
      type: 'generated',
      base64: generated.base64,
      mimeType: generated.mimeType,
      alt: generated.alt,
    }
  }

  console.log(`[imageService] no image resolved (${Date.now() - start}ms)`)
  return { type: 'none' }
}

function logScores(scored: ScoredImage[]): void {
  for (const s of scored.slice(0, 5)) {
    console.log(
      `[imageService]   score=${s.score.total} ` +
      `[rel=${s.score.relevance} edu=${s.score.educationalValue} ` +
      `clr=${s.score.clarity} app=${s.score.appropriateness}] ` +
      `"${s.candidate.title.slice(0, 60)}" — ${s.score.reasoning}`,
    )
  }
}
