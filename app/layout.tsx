import type { Metadata } from 'next'
import './globals.css'
import { AuthInit } from '@/components/auth/AuthInit'

export const metadata: Metadata = {
  title: 'AI Study Partner',
  description: 'AI-powered study partner with spaced repetition',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthInit />
        {children}
      </body>
    </html>
  )
}
