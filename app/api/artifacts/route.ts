import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getArtifactsByUser,
  getArtifactsBySession,
} from '@/lib/db/artifacts'

// GET /api/artifacts — list artifacts (optionally filtered by sessionId query param)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessionId = req.nextUrl.searchParams.get('sessionId')

    const artifacts = sessionId
      ? await getArtifactsBySession(sessionId, user.id)
      : await getArtifactsByUser(user.id)

    return NextResponse.json(artifacts)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
