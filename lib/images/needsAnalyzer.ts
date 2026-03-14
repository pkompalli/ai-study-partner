/**
 * Image Needs Analyzer
 *
 * Determines whether a piece of educational content needs images,
 * and if so, where they should be inserted and what they should show.
 *
 * Two modes:
 * 1. Pre-generation: Analyzes topic/chapter context to tell the LLM upfront
 *    which images to embed (injected into the system prompt).
 * 2. Post-generation: Scans completed content and inserts image blocks
 *    where visual aids would significantly improve understanding.
 */

import { chatCompletion } from '@/lib/llm/client'

// ─── Topic categories that strongly benefit from images ─────────────────────

const VISUAL_DOMAINS: Record<string, string[]> = {
  biology: [
    'cell', 'organelle', 'mitochondri', 'chloroplast', 'nucleus', 'membrane',
    'tissue', 'organ', 'anatomy', 'histology', 'microscop', 'micrograph',
    'dna', 'rna', 'chromosome', 'gene', 'protein', 'enzyme',
    'ecosystem', 'biome', 'food chain', 'food web',
    'photosynthesis', 'respiration', 'mitosis', 'meiosis',
    'nervous system', 'brain', 'neuron', 'synapse',
    'heart', 'lung', 'kidney', 'liver', 'digestive',
    'bacteria', 'virus', 'fungi', 'parasite',
    'evolution', 'taxonomy', 'phylogen', 'species',
  ],
  chemistry: [
    'crystal', 'lattice', 'molecular structure', 'orbital', 'bond',
    'apparatus', 'titration', 'distillation', 'chromatography',
    'periodic table', 'electron config', 'lewis structure',
    'isomer', 'stereochem', 'enantiomer', 'conformation',
    'spectroscop', 'nmr', 'ir spectrum', 'mass spectrum',
    'reaction', 'catalyst', 'polymer', 'compound',
  ],
  physics: [
    'circuit', 'resistor', 'capacitor', 'inductor',
    'wave', 'interference', 'diffraction', 'spectrum',
    'lens', 'mirror', 'refraction', 'reflection',
    'pendulum', 'spring', 'pulley', 'inclined plane',
    'magnetic field', 'electric field', 'force diagram',
    'telescope', 'microscope', 'oscilloscope',
    'thermodynamic', 'entropy', 'quantum', 'atom',
  ],
  earth_science: [
    'rock', 'mineral', 'crystal', 'fossil', 'strata',
    'volcano', 'earthquake', 'tectonic', 'fault',
    'glacier', 'erosion', 'sediment', 'canyon',
    'weather', 'cloud', 'hurricane', 'tornado',
    'ocean', 'current', 'tide', 'coral reef',
  ],
  astronomy: [
    'planet', 'star', 'galaxy', 'nebula', 'constellation',
    'solar system', 'moon', 'eclipse', 'orbit',
    'telescope', 'spectrum', 'redshift',
    'black hole', 'supernova', 'white dwarf',
  ],
  medicine: [
    'x-ray', 'ct scan', 'mri', 'ultrasound',
    'surgery', 'surgical', 'procedure',
    'pathology', 'lesion', 'tumor', 'fracture',
    'dermatolog', 'rash', 'wound',
    'anatomy', 'dissection', 'cadaver',
    'disease', 'symptom', 'diagnos',
  ],
  geography: [
    'map', 'topograph', 'contour', 'elevation',
    'climate zone', 'biome', 'vegetation',
    'river', 'delta', 'estuary', 'watershed',
    'mountain', 'plateau', 'valley', 'fjord',
    'urbanization', 'population density', 'land use',
  ],
  engineering: [
    'engine', 'motor', 'turbine', 'generator',
    'bridge', 'beam', 'truss', 'arch',
    'gear', 'bearing', 'shaft', 'piston',
    'hydraulic', 'pneumatic', 'mechanical',
    'semiconductor', 'transistor', 'diode', 'chip',
    'architecture', 'blueprint', 'floor plan',
  ],
  computer_science: [
    'network', 'topology', 'architecture', 'hardware',
    'cpu', 'gpu', 'motherboard', 'server',
    'data center', 'cloud infrastructure',
  ],
  mathematics: [
    'graph', 'geometry', 'fractal', 'tessellation',
    'geometric', 'polyhedr', 'solid', 'surface',
    'curve', 'conic section', 'parabola', 'ellipse',
  ],
  history: [
    'artifact', 'monument', 'ruins', 'excavation',
    'manuscript', 'painting', 'sculpture', 'architecture',
    'battle', 'war', 'civilization', 'empire',
    'flag', 'coat of arms', 'insignia',
  ],
  arts: [
    'painting', 'sculpture', 'mosaic', 'fresco',
    'architecture', 'cathedral', 'temple', 'mosque',
    'instrument', 'notation', 'score',
    'photography', 'composition', 'perspective',
  ],
}

export interface ImageNeed {
  query: string     // Search query for the image
  alt: string       // Accessible description
  placement: string // Where in the content: 'after_intro' | 'with_concept:X' | 'before_summary'
  priority: number  // 1-10, how important this image is
  reason: string    // Why this image helps
}

export interface ImageNeedsResult {
  needsImages: boolean
  imageNeeds: ImageNeed[]
  domainHint: string | null
}

// ─── Fast heuristic pre-check ───────────────────────────────────────────────

/**
 * Quick keyword-based check: does this topic/chapter likely benefit from images?
 * Returns the matching domain or null.
 */
export function quickVisualCheck(topicName: string, chapterName?: string): string | null {
  const text = `${topicName} ${chapterName ?? ''}`.toLowerCase()

  for (const [domain, keywords] of Object.entries(VISUAL_DOMAINS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) return domain
    }
  }
  return null
}

// ─── LLM-based deep analysis ────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are an educational content specialist deciding whether a topic needs visual images (photographs, micrographs, diagrams of real objects, scientific illustrations) to be properly understood.

You are NOT deciding about flowcharts, process diagrams, or mathematical diagrams — those are handled separately via mermaid. You are ONLY deciding about real-world images: photographs, electron micrographs, anatomical illustrations, apparatus diagrams, geological photographs, astronomical images, etc.

Topic: "{topic}"
{chapterLine}
Course: "{course}"
Content depth: {depth}/5

Analyze whether this specific topic genuinely REQUIRES images for a student to understand it properly. Consider:
1. Does the topic describe physical structures the student has never seen? (e.g. organelles, crystal lattices, geological formations)
2. Does understanding depend on visual recognition? (e.g. identifying cell types, reading spectra, recognizing apparatus)
3. Would a textbook covering this topic always include photographs or illustrations?
4. Is this a topic where "seeing" the real thing is fundamentally different from reading a description?

Return ONLY valid JSON — no markdown, no code fences:
{
  "needsImages": true,
  "imageNeeds": [
    {
      "query": "electron micrograph mitochondria cristae",
      "alt": "Electron micrograph showing the internal cristae structure of a mitochondrion",
      "placement": "with_concept:mitochondria structure",
      "priority": 9,
      "reason": "Students cannot understand cristae folding without seeing the actual structure"
    }
  ]
}

Rules:
- Return needsImages: false with empty imageNeeds if images are NOT genuinely needed
- Maximum 3 image needs per topic (pick the highest-value ones)
- query must be specific enough to find the exact right image (include modifiers like "diagram", "micrograph", "cross section", "labeled")
- priority 8-10: essential (topic is incomprehensible without it), 5-7: valuable (significantly aids understanding), 1-4: nice-to-have
- Only include images with priority >= 6
- Do NOT suggest images for abstract mathematical concepts, pure theory, or topics where a mermaid diagram would work better
- Do NOT suggest generic/decorative images — every image must teach something specific`

/**
 * Deep LLM-based analysis of whether a topic needs images.
 * Only called when the quick heuristic suggests it might.
 */
export async function analyzeImageNeeds(
  topicName: string,
  chapterName: string | undefined,
  courseName: string,
  depth: number,
): Promise<ImageNeedsResult> {
  const domainHint = quickVisualCheck(topicName, chapterName)

  // Always attempt LLM analysis — the domain hint just provides context
  try {
    const prompt = ANALYSIS_PROMPT
      .replace('{topic}', topicName)
      .replace('{chapterLine}', chapterName ? `Chapter: "${chapterName}"` : '')
      .replace('{course}', courseName)
      .replace('{depth}', String(depth))

    const raw = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, maxTokens: 800 },
    )

    const cleaned = raw.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (!parsed.needsImages || !Array.isArray(parsed.imageNeeds)) {
      return { needsImages: false, imageNeeds: [], domainHint }
    }

    // Filter to only high-priority needs and validate shape
    const imageNeeds: ImageNeed[] = parsed.imageNeeds
      .filter((n: Record<string, unknown>) =>
        typeof n.query === 'string' &&
        typeof n.alt === 'string' &&
        typeof n.priority === 'number' &&
        n.priority >= 6,
      )
      .slice(0, 3)
      .map((n: Record<string, unknown>) => ({
        query: n.query as string,
        alt: n.alt as string,
        placement: typeof n.placement === 'string' ? n.placement : 'after_intro',
        priority: n.priority as number,
        reason: typeof n.reason === 'string' ? n.reason : '',
      }))

    return {
      needsImages: imageNeeds.length > 0,
      imageNeeds,
      domainHint,
    }
  } catch (err) {
    console.warn('[imageNeedsAnalyzer] analysis failed:', err)
    return { needsImages: false, imageNeeds: [], domainHint }
  }
}

// ─── Prompt injection helper ────────────────────────────────────────────────

/**
 * Generates a system prompt fragment that tells the LLM exactly which images
 * to include and where. This is injected into the study mate/summary system prompt.
 */
export function buildImageDirective(needs: ImageNeedsResult): string {
  if (!needs.needsImages || needs.imageNeeds.length === 0) {
    return ''
  }

  const imageInstructions = needs.imageNeeds.map((need, i) => {
    return `${i + 1}. ${need.placement}: Include this image block:
\`\`\`image
{"query":"${need.query}","alt":"${need.alt}"}
\`\`\`
   Reason: ${need.reason}`
  }).join('\n\n')

  return `
IMAGE EMBED REQUIREMENTS FOR THIS TOPIC:
This topic requires specific visual aids. You MUST include the following image code-fence embeds (language tag "image") at the indicated points in your response.
CRITICAL: These are machine-readable code fences, NOT section headings. Do NOT create a heading called "Image". Just place the code fence inline after the relevant content paragraph.

${imageInstructions}

Place each image code fence naturally within your explanation — after introducing the relevant concept, not at the very beginning or end. The code fence must appear on its own line, not inside a paragraph.`
}

// ─── Post-generation image insertion ────────────────────────────────────────

/**
 * Scans completed content and inserts image blocks where the needs analyzer
 * determined they should go, if the LLM didn't include them.
 */
export function insertMissingImages(content: string, needs: ImageNeedsResult): string {
  if (!needs.needsImages || needs.imageNeeds.length === 0) return content

  // Strip bare "image" headings the LLM may have emitted instead of code fences
  content = content
    .replace(/^#{1,4}\s+[Ii]mage\s*$/gm, '')
    .replace(/^\s*[Ii]mage\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')

  // Check which image blocks are already present
  const existingImageBlocks = content.match(/```image\n[\s\S]*?```/g) ?? []
  const existingQueries = existingImageBlocks.map(block => {
    try {
      const json = block.replace(/```image\n/, '').replace(/\n?```/, '')
      return JSON.parse(json).query?.toLowerCase() ?? ''
    } catch { return '' }
  })

  let result = content
  for (const need of needs.imageNeeds) {
    // Skip if a similar image block already exists
    const queryLower = need.query.toLowerCase()
    if (existingQueries.some(eq => eq && (eq.includes(queryLower.slice(0, 20)) || queryLower.includes(eq.slice(0, 20))))) {
      continue
    }

    const imageBlock = `\n\n\`\`\`image\n{"query":"${need.query}","alt":"${need.alt}"}\n\`\`\`\n\n`

    // Try to find a good insertion point based on placement hint
    if (need.placement.startsWith('with_concept:')) {
      const conceptName = need.placement.replace('with_concept:', '').toLowerCase()
      // Find the paragraph that first mentions this concept
      const paragraphs = result.split('\n\n')
      let inserted = false
      for (let i = 0; i < paragraphs.length; i++) {
        if (paragraphs[i].toLowerCase().includes(conceptName)) {
          paragraphs.splice(i + 1, 0, imageBlock.trim())
          inserted = true
          break
        }
      }
      if (inserted) {
        result = paragraphs.join('\n\n')
        continue
      }
    }

    if (need.placement === 'after_intro') {
      // Insert after the first heading + first paragraph
      const firstHeadingEnd = result.indexOf('\n\n')
      if (firstHeadingEnd > 0) {
        const secondBreak = result.indexOf('\n\n', firstHeadingEnd + 2)
        if (secondBreak > 0) {
          result = result.slice(0, secondBreak) + imageBlock + result.slice(secondBreak)
          continue
        }
      }
    }

    if (need.placement === 'before_summary') {
      // Insert before the last heading
      const lastHeading = result.lastIndexOf('\n## ')
      if (lastHeading > 0) {
        result = result.slice(0, lastHeading) + imageBlock + result.slice(lastHeading)
        continue
      }
    }

    // Fallback: insert after the second paragraph
    const breaks = [...result.matchAll(/\n\n/g)]
    if (breaks.length >= 2) {
      const pos = breaks[1].index! + 2
      result = result.slice(0, pos) + imageBlock + result.slice(pos)
    }
  }

  return result
}
