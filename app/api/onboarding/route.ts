import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOnboardingSession, getActiveOnboardingSession } from '@/lib/db/onboarding'

// POST /api/onboarding — create or resume an onboarding session
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { fresh?: boolean }

    // If not forcing fresh, check for existing active session
    if (!body.fresh) {
      const existing = await getActiveOnboardingSession(user.id)
      if (existing) {
        return NextResponse.json({ id: existing.id, resumed: true })
      }
    }

    // Creates new session (and abandons any existing active ones)
    const session = await createOnboardingSession(user.id)
    return NextResponse.json({ id: session.id, resumed: false }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
