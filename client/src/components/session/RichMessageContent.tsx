import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/utils';
import { InlineMermaid } from './InlineMermaid';
import { InlineQuiz } from './InlineQuiz';
import { InlineFlashcards } from './InlineFlashcards';

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
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={makeComponents(invert)}
      >{content}</ReactMarkdown>
    </div>
  );
}
