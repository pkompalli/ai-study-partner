'use client'
import ReactMarkdown from 'react-markdown';
import type { LessonArtifact } from '@/types';

interface ArtifactViewerProps {
  artifact: LessonArtifact;
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <article className="prose prose-gray max-w-none p-6">
        <ReactMarkdown>{artifact.markdown_content}</ReactMarkdown>
      </article>
    </div>
  );
}
