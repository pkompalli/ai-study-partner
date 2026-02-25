import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/utils';
import { InlineMermaid } from './InlineMermaid';
import { InlineQuiz } from './InlineQuiz';
import { InlineFlashcards } from './InlineFlashcards';

/**
 * Normalise LaTeX delimiters so remark-math can process everything:
 *  - \[...\]  →  $$...$$  (display math)
 *  - \(...\)  →  $...$    (inline math)
 *  - bare \begin{env}...\end{env}  →  wrapped in $$...$$
 * Existing $...$ / $$...$$ blocks are protected from double-processing.
 */
function preprocessLatex(content: string): string {
  if (!content) return content;

  // Step 1: convert \[...\] and \(...\) BEFORE markdown can strip the backslashes
  let s = content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body}$`);

  // Step 2: protect already-valid $...$ / $$...$$ blocks
  const saved: string[] = [];
  s = s.replace(
    /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g,
    (m) => { saved.push(m); return `\x02${saved.length - 1}\x03`; },
  );

  // Step 3: wrap bare \begin{env}...\end{env} in $$...$$
  s = s.replace(
    /\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g,
    (_, env, body) => `\n$$\n\\begin{${env}}${body}\\end{${env}}\n$$\n`,
  );

  // Step 4: restore protected blocks
  return s.replace(/\x02(\d+)\x03/g, (_, i) => saved[+i]);
}

function makeComponents(invert?: boolean): Components {
  return {
    code(props) {
      const { className, children } = props;
      const match = /language-(\w+)/.exec(className || '');
      const lang = match?.[1];

      if (!lang) {
        // Inline code
        return (
          <code className={cn('text-xs bg-gray-100 rounded px-1 py-0.5 font-mono', invert && 'bg-white/20')}>
            {children}
          </code>
        );
      }

      const raw = String(children).trim();

      if (lang === 'mermaid') {
        return <InlineMermaid code={raw} />;
      }

      if (lang === 'quiz') {
        try {
          const data = JSON.parse(raw);
          return <InlineQuiz questions={data.questions ?? []} />;
        } catch {
          return <pre className="text-xs overflow-x-auto"><code>{raw}</code></pre>;
        }
      }

      if (lang === 'flashcards') {
        try {
          const data = JSON.parse(raw);
          return <InlineFlashcards cards={data.cards ?? []} />;
        } catch {
          return <pre className="text-xs overflow-x-auto"><code>{raw}</code></pre>;
        }
      }

      // Standard code block
      return (
        <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto my-2">
          <code className={className}>{children}</code>
        </pre>
      );
    },
  };
}

interface Props {
  content: string;
  invert?: boolean;
}

export function RichMessageContent({ content, invert }: Props) {
  return (
    <div className={cn('prose prose-sm max-w-none', invert && 'prose-invert')}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={makeComponents(invert)}
      >{preprocessLatex(content)}</ReactMarkdown>
    </div>
  );
}
