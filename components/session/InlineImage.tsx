'use client'

import { useState, useEffect } from 'react'

type ImageData =
  | { type: 'found'; thumbUrl: string; title: string; attribution: string; license: string; score: number }
  | { type: 'generated'; base64: string; mimeType: string; alt: string }
  | { type: 'none' }

interface Props {
  query: string
  alt: string
}

export function InlineImage({ query, alt }: Props) {
  const [data, setData] = useState<ImageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchImage() {
      try {
        const params = new URLSearchParams({ q: query, alt })
        const res = await fetch(`/api/image-search?${params}`)
        if (!res.ok) throw new Error('fetch failed')
        const result: ImageData = await res.json()
        if (!cancelled) setData(result)
      } catch {
        if (!cancelled) setData({ type: 'none' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchImage()
    return () => { cancelled = true }
  }, [query, alt])

  if (loading) {
    return (
      <div className="my-4 rounded-xl bg-slate-50 animate-pulse flex items-center justify-center h-48">
        <span className="text-sm text-slate-400">Finding image...</span>
      </div>
    )
  }

  if (!data || data.type === 'none') return null

  if (data.type === 'generated') {
    return (
      <figure className="my-4 not-prose">
        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <img
            src={`data:${data.mimeType};base64,${data.base64}`}
            alt={data.alt || alt}
            className="w-full max-h-[400px] object-contain"
          />
        </div>
        <figcaption className="mt-2 text-xs text-slate-500 text-center space-y-0.5">
          <p className="font-medium">{data.alt || alt}</p>
          <p>AI-generated illustration</p>
        </figcaption>
      </figure>
    )
  }

  return (
    <figure className="my-4 not-prose">
      <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
        <img
          src={data.thumbUrl}
          alt={alt || data.title}
          className="w-full max-h-[400px] object-contain"
          loading="lazy"
        />
      </div>
      <figcaption className="mt-2 text-xs text-slate-500 text-center space-y-0.5">
        <p className="font-medium">{alt || data.title}</p>
        {data.attribution && (
          <p>
            {data.attribution}
            {data.license && <span> ({data.license})</span>}
          </p>
        )}
      </figcaption>
    </figure>
  )
}
