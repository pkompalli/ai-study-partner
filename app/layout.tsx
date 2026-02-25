import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Study Partner',
  description: 'AI-powered study partner with spaced repetition',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
