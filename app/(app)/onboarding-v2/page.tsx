'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { useOnboardingStore } from '@/store/onboardingStore'
import { OnboardingChat } from '@/components/onboarding-v2/OnboardingChat'

export default function OnboardingV2Page() {
  const router = useRouter()
  const { sessionId, collectedData, currentLayer, startOnboarding, startFresh } = useOnboardingStore()
  const mounted = useRef(false)

  // Start onboarding only on initial mount (not on startFresh resets)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      if (!sessionId) {
        startOnboarding()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to dashboard when complete
  useEffect(() => {
    if (currentLayer >= 8 && collectedData.courseId) {
      const timer = setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [currentLayer, collectedData.courseId, router])

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">Set up your course</h1>
          <p className="text-xs text-gray-500">Let&apos;s get you started in 2 minutes</p>
        </div>
        {sessionId && (
          <button
            onClick={startFresh}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Start over
          </button>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <OnboardingChat />
      </div>
    </div>
  )
}
