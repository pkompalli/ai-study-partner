'use client'
import { FileText } from 'lucide-react';
import { downloadBlob } from '@/lib/utils';
import { ExportPDFButton } from '@/components/artifact/ExportPDFButton';
import type { LessonArtifact } from '@/types';

interface ExportButtonProps {
  artifact: LessonArtifact;
}

export function ExportButton({ artifact }: ExportButtonProps) {
  const downloadMarkdown = () => {
    downloadBlob(artifact.markdown_content, `${artifact.title}.md`, 'text/markdown');
  };

  return (
    <div className="flex gap-2">
      <button onClick={downloadMarkdown} className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors">
        <FileText className="h-4 w-4" />
        Markdown
      </button>
      <ExportPDFButton title={artifact.title} content={artifact.markdown_content} />
    </div>
  );
}
