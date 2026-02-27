'use client'
import { useMemo } from 'react'
import { Streamdown } from 'streamdown'
import { createMathPlugin } from '@streamdown/math'
import type { Components } from 'streamdown'
import { cn } from '@/lib/utils'
import { InlineMermaid } from '@/components/session/InlineMermaid'
import { InlineQuiz } from '@/components/session/InlineQuiz'
import { InlineFlashcards } from '@/components/session/InlineFlashcards'
import 'katex/contrib/mhchem'

/**
 * Normalise LaTeX delimiters so @streamdown/math can process everything.
 * Kept in sync with RichMessageContent.tsx — both must preprocess identically.
 */
function preprocessLatex(content: string): string {
  if (!content) return content

  let s = content
    .replace(/\\cdotp/g, '\\cdot')
    .replace(/\\boldsymbol\{/g, '\\mathbf{')

  s = s
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body}$`)

  const saved: string[] = []
  s = s.replace(
    /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g,
    (m) => { saved.push(m); return `\x02${saved.length - 1}\x03` },
  )

  s = s.replace(/\\ce\{([^}]*)}/g, match => `$${match}$`)

  s = s.replace(
    /\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g,
    (_, env, body) => `\n$$\n\\begin{${env}}${body}\\end{${env}}\n$$\n`,
  )

  return s.replace(/\x02(\d+)\x03/g, (_, i) => saved[+i])
}

// Allow single-$ inline math because the tutor prompts intentionally use $...$.
const PLUGINS = { math: createMathPlugin({ singleDollarTextMath: true }) }

function makeComponents(invert?: boolean): Components {
  return {
    code(props) {
      const { className, children } = props
      const match = /language-(\w+)/.exec(className || '')
      const lang = match?.[1]

      if (!lang) {
        return (
          <code className={cn('text-xs bg-gray-100 text-gray-800 rounded px-1.5 py-0.5 font-mono', invert && 'bg-white/20')}>
            {children}
          </code>
        )
      }

      const raw = String(children).trim()

      if (lang === 'mermaid') {
        return <InlineMermaid code={raw} />
      }

      if (lang === 'quiz') {
        try {
          const data = JSON.parse(raw)
          return <InlineQuiz questions={data.questions ?? []} />
        } catch {
          return <pre className="text-xs overflow-x-auto"><code>{raw}</code></pre>
        }
      }

      if (lang === 'flashcards') {
        try {
          const data = JSON.parse(raw)
          return <InlineFlashcards cards={data.cards ?? []} />
        } catch {
          return <pre className="text-xs overflow-x-auto"><code>{raw}</code></pre>
        }
      }

      return (
        <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto my-2">
          <code className={className}>{children}</code>
        </pre>
      )
    },
  }
}

interface Props {
  content: string
  isStreaming?: boolean
  invert?: boolean
  className?: string
}

/**
 * StreamingMarkdown — flicker-free markdown renderer for SSE streams.
 *
 * Uses streamdown's native streaming mode which handles incomplete markdown
 * syntax (unclosed bold, partial code fences) without the block-memoization
 * workaround. The `caret` prop shows a blinking cursor while streaming.
 */
export function StreamingMarkdown({ content, isStreaming, invert, className }: Props) {
  const components = useMemo(() => makeComponents(invert), [invert])

  return (
    <div className={cn('prose prose-sm max-w-none', invert && 'prose-invert', className)}>
      <Streamdown
        mode={isStreaming ? 'streaming' : 'static'}
        caret={isStreaming ? 'block' : undefined}
        plugins={PLUGINS}
        components={components}
      >
        {preprocessLatex(content)}
      </Streamdown>
    </div>
  )
}
