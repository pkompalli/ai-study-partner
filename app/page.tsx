'use client'
import { BookOpen, Brain, FileText, Youtube } from 'lucide-react'
import Link from 'next/link'

const features = [
  { icon: <Brain className="h-6 w-6 text-primary-500" />, title: 'AI Tutor', desc: 'Interactive sessions with a smart AI that adapts to your pace' },
  { icon: <FileText className="h-6 w-6 text-purple-500" />, title: 'Quizzes & Flashcards', desc: 'Auto-generated quizzes and spaced-repetition flashcards' },
  { icon: <Youtube className="h-6 w-6 text-red-500" />, title: 'Video Links', desc: 'Curated YouTube videos matched to your study topic' },
  { icon: <BookOpen className="h-6 w-6 text-green-500" />, title: 'Lesson Artifacts', desc: 'Export your sessions as polished PDF or Markdown documents' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-gray-900">AI Study Partner</span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md w-full space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
              Learn smarter with your AI study partner
            </h1>
            <p className="text-gray-600 text-lg">
              Upload any course content and get an AI tutor, quizzes, flashcards, and curated videos — all in one place.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/signup"
              className="w-full bg-blue-600 text-white p-2 rounded text-center font-medium hover:bg-blue-700 transition-colors">
              Get started free
            </Link>
            <Link href="/login"
              className="w-full border border-gray-300 text-gray-700 p-2 rounded text-center font-medium hover:bg-gray-50 transition-colors">
              Sign in
            </Link>
          </div>

          <p className="text-xs text-gray-400">Free to start · No credit card required</p>
        </div>

        {/* Features grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl w-full">
          {features.map(f => (
            <div key={f.title} className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-left">
              <div className="flex-shrink-0 mt-0.5">{f.icon}</div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
