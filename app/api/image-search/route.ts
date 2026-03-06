import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveImage } from '@/lib/images/service'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ type: 'none' }, { status: 401 })

  const query = req.nextUrl.searchParams.get('q')
  const alt = req.nextUrl.searchParams.get('alt') ?? query ?? ''

  if (!query) {
    return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 })
  }

  try {
    const result = await resolveImage(query, alt)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[image-search] error:', err)
    return NextResponse.json({ type: 'none' }, { status: 200 })
  }
}
