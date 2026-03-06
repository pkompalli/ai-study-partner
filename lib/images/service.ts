/**
 * Image service orchestrator.
 *
 * Pipeline: Search (multi-source) → Score (LLM vision) → Threshold (90%) → Generate (AI fallback)
 */

import { searchImages, type ImageCandidate } from './sources'
import { scoreImages, type ScoredImage } from './scorer'
import { generateEducationalImage, type GeneratedImage } from './generator'

const SCORE_THRESHOLD = 90 // Out of 100 — only images scoring ≥90% are accepted

export type ImageResult =
  | { type: 'found'; url: string; thumbUrl: string; title: string; attribution: string; license: string; score: number }
  | { type: 'generated'; base64: string; mimeType: string; alt: string }
  | { type: 'none' }

export async function resolveImage(query: string, alt: string): Promise<ImageResult> {
  console.log(`[imageService] resolving image for: "${query}"`)

  // Step 1: Multi-source search
  const candidates = await searchImages(query)
  console.log(`[imageService] found ${candidates.length} candidates`)

  if (candidates.length > 0) {
    // Step 2: Score candidates with LLM vision
    const scored = await scoreImages(candidates, query, alt)
    logScores(scored)

    // Step 3: Check threshold
    const best = scored[0]
    if (best && best.score.total >= SCORE_THRESHOLD) {
      console.log(`[imageService] accepted: "${best.candidate.title}" (score: ${best.score.total})`)
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

  // Step 4: AI generation fallback
  console.log('[imageService] falling back to AI generation')
  const generated = await generateEducationalImage(query, alt)
  if (generated) {
    console.log('[imageService] AI generation succeeded')
    return {
      type: 'generated',
      base64: generated.base64,
      mimeType: generated.mimeType,
      alt: generated.alt,
    }
  }

  console.log('[imageService] no image resolved')
  return { type: 'none' }
}

function logScores(scored: ScoredImage[]): void {
  for (const s of scored) {
    console.log(
      `[imageService]   score=${s.score.total} ` +
      `[rel=${s.score.relevance} edu=${s.score.educationalValue} ` +
      `clr=${s.score.clarity} app=${s.score.appropriateness}] ` +
      `"${s.candidate.title.slice(0, 60)}" — ${s.score.reasoning}`,
    )
  }
}
