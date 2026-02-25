'use client'
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
      <Button variant="secondary" size="sm" onClick={downloadMarkdown} className="gap-2">
        <FileText className="h-4 w-4" />
        Markdown
      </Button>
      <ExportPDFButton title={artifact.title} content={artifact.markdown_content} />
    </div>
  );
}
