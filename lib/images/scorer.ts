/**
 * LLM-based image relevance scorer.
 * Uses a vision-capable model to evaluate candidate images against the request.
 */

import { generateText } from 'ai'
import { resolveModel } from '@/lib/llm/registry'
import type { ImageCandidate } from './sources'

export interface ImageScore {
  relevance: number       // 0-10: How well the image matches the requested concept
  educationalValue: number // 0-10: How useful for learning (clear labels, good detail)
  clarity: number         // 0-10: Image quality, resolution, readability
  appropriateness: number // 0-10: Suitable for academic context (not misleading, not decorative)
  total: number           // 0-100 normalized score
  reasoning: string       // Brief explanation
}

export interface ScoredImage {
  candidate: ImageCandidate
  score: ImageScore
}

const SCORING_PROMPT = `You are an educational image quality evaluator. Score this image on how suitable it is for teaching the specified concept to a student.

Concept being taught: "{query}"
Desired image: "{alt}"

Score the image on these criteria (0-10 each):
1. **relevance**: Does it directly show the requested concept? (10 = exact match, 5 = tangentially related, 0 = unrelated)
2. **educationalValue**: Is it useful for learning? Clear labels, annotations, proper detail level? (10 = textbook-quality diagram, 0 = decorative/uninformative)
3. **clarity**: Image quality — sharp, readable text/labels, good resolution? (10 = crisp and clear, 0 = blurry/pixelated)
4. **appropriateness**: Suitable for an academic setting? Accurate, not misleading, not a meme or irrelevant? (10 = perfect, 0 = inappropriate)

Return ONLY valid JSON — no markdown, no code fences:
{"relevance":8,"educationalValue":7,"clarity":9,"appropriateness":10,"reasoning":"Brief 1-sentence explanation"}`

export async function scoreImage(
  candidate: ImageCandidate,
  query: string,
  alt: string,
): Promise<ScoredImage> {
  try {
    // Fetch the image and convert to base64
    const imgRes = await fetch(candidate.thumbUrl, {
      signal: AbortSignal.timeout(10000),
    })
    if (!imgRes.ok) {
      return makeFailScore(candidate, 'Image fetch failed')
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const base64 = buffer.toString('base64')

    const prompt = SCORING_PROMPT
      .replace('{query}', query)
      .replace('{alt}', alt)

    const { text } = await generateText({
      model: resolveModel(),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: `data:${contentType};base64,${base64}` },
          ],
        },
      ],
      temperature: 0.1,
      maxOutputTokens: 300,
    })

    const cleaned = text.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)

    const relevance = clamp(parsed.relevance ?? 0)
    const educationalValue = clamp(parsed.educationalValue ?? 0)
    const clarity = clamp(parsed.clarity ?? 0)
    const appropriateness = clamp(parsed.appropriateness ?? 0)

    // Weighted total: relevance matters most, then educational value
    const total = Math.round(
      (relevance * 0.35 + educationalValue * 0.30 + clarity * 0.15 + appropriateness * 0.20) * 10,
    )

    return {
      candidate,
      score: {
        relevance,
        educationalValue,
        clarity,
        appropriateness,
        total,
        reasoning: parsed.reasoning ?? '',
      },
    }
  } catch (err) {
    console.warn('[imageScorer] scoring failed:', err)
    return makeFailScore(candidate, 'Scoring error')
  }
}

/** Score multiple candidates, return sorted best-first */
export async function scoreImages(
  candidates: ImageCandidate[],
  query: string,
  alt: string,
  maxToScore = 4,
): Promise<ScoredImage[]> {
  // Only score top N to limit LLM calls
  const toScore = candidates.slice(0, maxToScore)
  const results = await Promise.allSettled(
    toScore.map(c => scoreImage(c, query, alt)),
  )

  return results
    .filter((r): r is PromiseFulfilledResult<ScoredImage> => r.status === 'fulfilled')
    .map(r => r.value)
    .sort((a, b) => b.score.total - a.score.total)
}

function clamp(v: number): number {
  return Math.max(0, Math.min(10, Math.round(v)))
}

function makeFailScore(candidate: ImageCandidate, reason: string): ScoredImage {
  return {
    candidate,
    score: {
      relevance: 0,
      educationalValue: 0,
      clarity: 0,
      appropriateness: 0,
      total: 0,
      reasoning: reason,
    },
  }
}
