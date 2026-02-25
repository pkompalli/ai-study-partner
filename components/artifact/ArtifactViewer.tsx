'use client'
import ReactMarkdown from 'react-markdown';
import type { LessonArtifact } from '@/types';

interface ArtifactViewerProps {
  artifact: LessonArtifact;
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  return (
    <article className="prose prose-sm sm:prose max-w-none">
      <ReactMarkdown>{artifact.markdown_content}</ReactMarkdown>
    </article>
  );
}
