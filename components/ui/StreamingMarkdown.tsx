'use client'
import React, { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import { cn } from '@/lib/utils'
import { InlineMermaid } from '@/components/session/InlineMermaid'
import { InlineQuiz } from '@/components/session/InlineQuiz'
import { InlineFlashcards } from '@/components/session/InlineFlashcards'

/**
 * Normalise LaTeX delimiters so remark-math can process everything.
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

  s = s.replace(/\\ce\{([^}]*)\}/g, match => `$${match}$`)

  s = s.replace(
    /\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g,
    (_, env, body) => `\n$$\n\\begin{${env}}${body}\\end{${env}}\n$$\n`,
  )

  return s.replace(/\x02(\d+)\x03/g, (_, i) => saved[+i])
}

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

/**
 * Split markdown into paragraph-level blocks.
 *
 * Blocks are separated by one or more blank lines. Code fences (```) and
 * math display blocks ($$) are treated as atomic units so we never cut
 * inside them — a mid-fence split would produce broken markdown.
 */
function splitIntoBlocks(content: string): string[] {
  const lines = content.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let inFence = false
  let inMathBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Toggle fenced code block
    if (trimmed.startsWith('```')) {
      inFence = !inFence
      current.push(line)
      continue
    }

    // Toggle display math block
    if (trimmed === '$$') {
      inMathBlock = !inMathBlock
      current.push(line)
      continue
    }

    // Inside a protected region — accumulate without splitting
    if (inFence || inMathBlock) {
      current.push(line)
      continue
    }

    // Blank line outside a protected region — flush block
    if (trimmed === '') {
      if (current.length > 0) {
        blocks.push(current.join('\n'))
        current = []
      }
    } else {
      current.push(line)
    }
  }

  // Flush any trailing content
  if (current.length > 0) {
    blocks.push(current.join('\n'))
  }

  return blocks.length > 0 ? blocks : ['']
}

interface BlockProps {
  content: string
  invert?: boolean
}

/**
 * A single memoized block — only re-renders when its `content` string changes.
 * Because all completed blocks have a stable key in StreamingMarkdown, React
 * never re-renders them even when the parent receives new props.
 */
const MarkdownBlock = memo(function MarkdownBlock({ content, invert }: BlockProps) {
  const components = useMemo(() => makeComponents(invert), [invert])
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
      components={components}
    >
      {preprocessLatex(content)}
    </ReactMarkdown>
  )
})

interface Props {
  content: string
  isStreaming?: boolean
  invert?: boolean
  className?: string
}

/**
 * StreamingMarkdown — flicker-free markdown renderer for SSE streams.
 *
 * Strategy:
 *   - Split content into paragraph-level blocks (blank-line boundaries,
 *     respecting code fences and math blocks).
 *   - All blocks except the LAST one are rendered with a stable numeric key
 *     so React never unmounts/remounts them between re-renders.
 *   - The last block gets a `streaming-<i>` key during streaming so it
 *     re-renders as new characters arrive, but becomes stable once streaming
 *     ends and is committed as a regular block.
 *   - A blinking cursor is appended only while isStreaming is true.
 *
 * The result: only the actively-growing last block re-renders on every chunk;
 * all previous blocks are memoized and stay untouched.
 */
export function StreamingMarkdown({ content, isStreaming, invert, className }: Props) {
  const blocks = useMemo(() => splitIntoBlocks(content), [content])

  return (
    <div className={cn('prose prose-sm max-w-none', invert && 'prose-invert', className)}>
      {blocks.map((block, i) => {
        const isLastBlock = i === blocks.length - 1
        // Stable key for completed blocks prevents React from touching them.
        // Unstable key for the last block while streaming forces it to update.
        const key = isStreaming && isLastBlock ? `streaming-${i}` : i
        return <MarkdownBlock key={key} content={block} invert={invert} />
      })}
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  )
}
