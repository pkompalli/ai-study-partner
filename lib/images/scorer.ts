/**
 * Image relevance scorer — lightweight heuristic only.
 * No LLM vision calls for speed. Relies on search engine ranking + keyword matching.
 */

import type { ImageCandidate } from './sources'

export interface ImageScore {
  relevance: number
  educationalValue: number
  clarity: number
  appropriateness: number
  total: number
  reasoning: string
}

export interface ScoredImage {
  candidate: ImageCandidate
  score: ImageScore
}

/** Score a candidate based on metadata keyword matching against the query */
function heuristicScore(candidate: ImageCandidate, query: string, alt: string): ScoredImage {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const altWords = alt.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const allKeywords = [...new Set([...queryWords, ...altWords])]

  const text = `${candidate.title} ${candidate.description}`.toLowerCase()

  // Keyword match: count how many query words appear in the image metadata
  let matches = 0
  for (const word of allKeywords) {
    if (text.includes(word)) matches++
  }
  const matchRatio = allKeywords.length > 0 ? matches / allKeywords.length : 0

  // Also check partial/stem matching — "mitochondri" should match "mitochondria"
  let stemMatches = 0
  for (const word of allKeywords) {
    const stem = word.slice(0, Math.min(word.length, 5))
    if (stem.length >= 4 && text.includes(stem)) stemMatches++
  }
  const stemRatio = allKeywords.length > 0 ? stemMatches / allKeywords.length : 0

  // Use the better of exact or stem matching
  const bestRatio = Math.max(matchRatio, stemRatio * 0.85)

  // Relevance: strict — must earn it through keyword matches
  let relevance = Math.round(bestRatio * 10)
  let educationalValue = 5
  let clarity = 7
  let appropriateness = 7

  // Bonus for educational sources
  if (candidate.source === 'wikimedia') { educationalValue += 2; appropriateness += 1 }
  if (candidate.source === 'wikipedia') { educationalValue += 1; appropriateness += 1 }

  // Bonus for educational keywords in metadata
  const eduKeywords = ['diagram', 'illustration', 'structure', 'anatomy', 'cross section',
    'labeled', 'schematic', 'setup', 'apparatus', 'chart', 'graph', 'micrograph',
    'image', 'photo', 'scan', 'view', 'section']
  for (const kw of eduKeywords) {
    if (text.includes(kw)) { educationalValue += 1; break }
  }

  // Penalize when keywords don't match — better to fall through to generation
  if (matches === 0 && stemMatches === 0) {
    relevance = 0
  }

  relevance = clamp(relevance)
  educationalValue = clamp(educationalValue)
  clarity = clamp(clarity)
  appropriateness = clamp(appropriateness)

  // Lower weight on relevance since heuristic can't truly judge visual content
  const total = Math.round(
    (relevance * 0.35 + educationalValue * 0.25 + clarity * 0.15 + appropriateness * 0.25) * 10,
  )

  return {
    candidate,
    score: {
      relevance,
      educationalValue,
      clarity,
      appropriateness,
      total,
      reasoning: `keyword match ${Math.round(bestRatio * 100)}% (${matches}/${allKeywords.length}), source: ${candidate.source}`,
    },
  }
}

/**
 * Score candidates using fast heuristic only — no LLM calls.
 * Returns sorted best-first.
 */
export async function scoreImages(
  candidates: ImageCandidate[],
  query: string,
  alt: string,
): Promise<ScoredImage[]> {
  const scored = candidates.map(c => heuristicScore(c, query, alt))
  scored.sort((a, b) => b.score.total - a.score.total)

  console.log(`[imageScorer] scores: ${scored.slice(0, 5).map(s =>
    `${s.score.total}:"${s.candidate.title.slice(0, 40)}"`).join(', ')}`)

  return scored
}

function clamp(v: number): number {
  return Math.max(0, Math.min(10, Math.round(v)))
}
