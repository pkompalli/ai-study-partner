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
  url.searchParams.set('q', `${query} educational diagram`)
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('num', '5')
  url.searchParams.set('safe', 'active')
  url.searchParams.set('imgType', 'photo')
  url.searchParams.set('rights', 'cc_publicdomain|cc_attribute|cc_sharealike')

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return []

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
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return []

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
    if (info.mime === 'image/svg+xml') continue

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
    signal: AbortSignal.timeout(8000),
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
    signal: AbortSignal.timeout(8000),
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
  const [google, wikimedia, wikipedia] = await Promise.allSettled([
    searchGoogle(query),
    searchWikimedia(query),
    searchWikipedia(query),
  ])

  const results: ImageCandidate[] = []
  // Google first (highest quality), then Wikimedia, then Wikipedia
  if (google.status === 'fulfilled') results.push(...google.value)
  if (wikimedia.status === 'fulfilled') results.push(...wikimedia.value)
  if (wikipedia.status === 'fulfilled') results.push(...wikipedia.value)

  // Deduplicate by URL
  const seen = new Set<string>()
  return results.filter(c => {
    if (seen.has(c.url)) return false
    seen.add(c.url)
    return true
  })
}
