import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import 'katex/dist/katex.min.css'
import 'streamdown/styles.css'
import { AuthInit } from '@/components/auth/AuthInit'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'StudyMate by OnCourse',
  description: 'AI-powered study companion by OnCourse',
  icons: {
    icon: '/oncourse-icon.png',
    apple: '/oncourse-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <AuthInit />
        {children}
      </body>
    </html>
  )
}
