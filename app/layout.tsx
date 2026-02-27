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
  title: 'AI Study Partner',
  description: 'AI-powered study partner with spaced repetition',
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
