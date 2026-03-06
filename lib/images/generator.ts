/**
 * AI image generation fallback using Google Gemini / Imagen.
 * Used when no search result passes the quality threshold.
 */

import { env } from '@/lib/config/env'

export interface GeneratedImage {
  base64: string
  mimeType: string
  alt: string
}

/**
 * Generate an educational image using Gemini's image generation API.
 * Falls back gracefully if the API key is missing or generation fails.
 */
export async function generateEducationalImage(
  query: string,
  alt: string,
): Promise<GeneratedImage | null> {
  const apiKey = env.google.apiKey
  if (!apiKey) {
    console.warn('[imageGenerator] No Google API key configured, skipping generation')
    return null
  }

  try {
    // Use Gemini 2.0 Flash with image generation via REST API directly
    // since the AI SDK's generateText doesn't natively return image files
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate a clear, educational diagram or illustration for a student studying this concept.

Concept: ${query}
Description: ${alt}

Requirements:
- Scientific accuracy is paramount — no incorrect details
- Clean, textbook-style illustration with clear labels
- White or light background for readability
- Appropriate level of detail for a university student
- Include labels and annotations where helpful
- No watermarks, logos, or decorative elements
- Style: clean educational diagram, not photorealistic

Generate the image now.`,
            }],
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
        signal: AbortSignal.timeout(30000),
      },
    )

    if (!res.ok) {
      console.warn('[imageGenerator] API returned', res.status)
      return null
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
          alt,
        }
      }
    }

    console.warn('[imageGenerator] No image in Gemini response')
    return null
  } catch (err) {
    console.warn('[imageGenerator] Generation failed:', err)
    return null
  }
}
