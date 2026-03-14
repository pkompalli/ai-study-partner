/**
 * Multi-source educational image search.
 * Sources: Google Image Search, Wikimedia Commons, Wikipedia article images.
 * Each source returns a common ImageCandidate shape.
 */

import { env } from '@/lib/config/env'

export interface ImageCandidate {
  url: string           // Full-size URL
  thumbUrl: string      // Display-size URL (≤600px wide)
  title: string
  description: string
  source: 'google' | 'wikimedia' | 'wikipedia'
  attribution: string   // Artist / license
  license: string
}

// ─── Google Custom Search (Image) ───────────────────────────────────────────

async function searchGoogle(query: string): Promise<ImageCandidate[]> {
  const apiKey = env.google.customSearchKey
  const cx = env.google.customSearchCx
  if (!apiKey || !cx) return []

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', query)
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('num', '8')
  url.searchParams.set('safe', 'active')
  url.searchParams.set('imgSize', 'medium')

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) {
    console.warn(`[imageSources] Google search failed: ${res.status}`)
    return []
  }

  const data = await res.json()
  const items = data.items ?? []

  return items
    .map((item: {
      link?: string
      image?: { thumbnailLink?: string; contextLink?: string }
      title?: string
      snippet?: string
      displayLink?: string
    }) => {
      if (!item.link) return null
      return {
        url: item.link,
        thumbUrl: item.image?.thumbnailLink || item.link,
        title: item.title ?? '',
        description: item.snippet?.slice(0, 300) ?? '',
        source: 'google' as const,
        attribution: item.displayLink ?? '',
        license: 'Web',
      }
    })
    .filter((c: ImageCandidate | null): c is ImageCandidate => c !== null)
}

// ─── Wikimedia Commons ──────────────────────────────────────────────────────

async function searchWikimedia(query: string): Promise<ImageCandidate[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.searchParams.set('action', 'query')
  url.searchParams.set('generator', 'search')
  url.searchParams.set('gsrnamespace', '6')
  url.searchParams.set('gsrsearch', query)
  url.searchParams.set('gsrlimit', '6')
  url.searchParams.set('prop', 'imageinfo')
  url.searchParams.set('iiprop', 'url|extmetadata|mime')
  url.searchParams.set('iiurlwidth', '600')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'StudyMateApp/1.0 (educational; non-commercial)' },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) {
    console.warn(`[imageSources] Wikimedia search failed: ${res.status}`)
    return []
  }

  const data = await res.json()
  const pages = data.query?.pages
  if (!pages) return []

  const results: ImageCandidate[] = []
  for (const page of Object.values(pages)) {
    const p = page as {
      title?: string
      imageinfo?: Array<{
        thumburl?: string
        url?: string
        mime?: string
        extmetadata?: {
          ImageDescription?: { value?: string }
          Artist?: { value?: string }
          LicenseShortName?: { value?: string }
        }
      }>
    }
    const info = p.imageinfo?.[0]
    if (!info?.mime?.startsWith('image/')) continue
    // Allow SVG — many educational diagrams are SVG
    // Skip non-image types only

    const meta = info.extmetadata
    results.push({
      url: info.url!,
      thumbUrl: info.thumburl || info.url!,
      title: p.title?.replace('File:', '') ?? '',
      description: meta?.ImageDescription?.value?.replace(/<[^>]*>/g, '').slice(0, 300) ?? '',
      source: 'wikimedia',
      attribution: meta?.Artist?.value?.replace(/<[^>]*>/g, '').slice(0, 150) ?? '',
      license: meta?.LicenseShortName?.value ?? '',
    })
  }
  return results
}

// ─── Wikipedia article images ───────────────────────────────────────────────

async function searchWikipedia(query: string): Promise<ImageCandidate[]> {
  // Step 1: find matching articles
  const searchUrl = new URL('https://en.wikipedia.org/w/api.php')
  searchUrl.searchParams.set('action', 'query')
  searchUrl.searchParams.set('list', 'search')
  searchUrl.searchParams.set('srsearch', query)
  searchUrl.searchParams.set('srlimit', '3')
  searchUrl.searchParams.set('format', 'json')
  searchUrl.searchParams.set('origin', '*')

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { 'User-Agent': 'StudyMateApp/1.0 (educational; non-commercial)' },
    signal: AbortSignal.timeout(6000),
  })
  if (!searchRes.ok) return []

  const searchData = await searchRes.json()
  const titles = (searchData.query?.search ?? [])
    .map((r: { title: string }) => r.title)
    .slice(0, 3)

  if (titles.length === 0) return []

  // Step 2: get images from those articles
  const imageUrl = new URL('https://en.wikipedia.org/w/api.php')
  imageUrl.searchParams.set('action', 'query')
  imageUrl.searchParams.set('titles', titles.join('|'))
  imageUrl.searchParams.set('prop', 'pageimages|images')
  imageUrl.searchParams.set('piprop', 'thumbnail|original')
  imageUrl.searchParams.set('pithumbsize', '600')
  imageUrl.searchParams.set('format', 'json')
  imageUrl.searchParams.set('origin', '*')

  const imgRes = await fetch(imageUrl.toString(), {
    headers: { 'User-Agent': 'StudyMateApp/1.0 (educational; non-commercial)' },
    signal: AbortSignal.timeout(6000),
  })
  if (!imgRes.ok) return []

  const imgData = await imgRes.json()
  const pages = imgData.query?.pages
  if (!pages) return []

  const results: ImageCandidate[] = []
  for (const page of Object.values(pages)) {
    const p = page as {
      title?: string
      thumbnail?: { source?: string }
      original?: { source?: string }
    }
    const thumb = p.thumbnail?.source
    const full = p.original?.source
    if (!thumb && !full) continue

    results.push({
      url: full || thumb!,
      thumbUrl: thumb || full!,
      title: p.title ?? '',
      description: `From Wikipedia article: ${p.title}`,
      source: 'wikipedia',
      attribution: 'Wikipedia',
      license: 'CC BY-SA',
    })
  }
  return results
}

// ─── Combined search ────────────────────────────────────────────────────────

export async function searchImages(query: string): Promise<ImageCandidate[]> {
  // Race strategy: start all sources in parallel, but resolve early if Google
  // returns enough results (saves waiting for slower Wikipedia 2-step fetch)
  const googleP = searchGoogle(query)
  const wikimediaP = searchWikimedia(query)
  const wikipediaP = searchWikipedia(query)

  // Wait for Google first — if it has ≥3 results, return immediately
  // while letting other sources settle in the background
  const googleResult = await googleP.catch(() => [] as ImageCandidate[])
  if (googleResult.length >= 3) {
    console.log(`[imageSources] Google returned ${googleResult.length} — fast path`)
    // Still collect whatever else has already resolved
    const [wm, wp] = await Promise.allSettled([
      Promise.race([wikimediaP, new Promise<ImageCandidate[]>(r => setTimeout(() => r([]), 500))]),
      Promise.race([wikipediaP, new Promise<ImageCandidate[]>(r => setTimeout(() => r([]), 500))]),
    ])
    const results = [...googleResult]
    if (wm.status === 'fulfilled') results.push(...wm.value)
    if (wp.status === 'fulfilled') results.push(...wp.value)
    return dedup(results)
  }

  // Slow path: wait for all sources
  const [wikimedia, wikipedia] = await Promise.allSettled([wikimediaP, wikipediaP])

  const results: ImageCandidate[] = [...googleResult]
  if (wikimedia.status === 'fulfilled') results.push(...wikimedia.value)
  if (wikipedia.status === 'fulfilled') results.push(...wikipedia.value)

  return dedup(results)
}

function dedup(candidates: ImageCandidate[]): ImageCandidate[] {
  const seen = new Set<string>()
  return candidates.filter(c => {
    if (seen.has(c.url)) return false
    seen.add(c.url)
    return true
  })
}
