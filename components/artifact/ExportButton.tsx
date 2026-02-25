'use client'
import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { downloadBlob } from '@/lib/utils';
import api from '@/lib/api';
import type { LessonArtifact } from '@/types';

interface ExportButtonProps {
  artifact: LessonArtifact;
}

export function ExportButton({ artifact }: ExportButtonProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const downloadMarkdown = () => {
    downloadBlob(artifact.markdown_content, `${artifact.title}.md`, 'text/markdown');
  };

  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      // If PDF URL already exists, open it
      if (artifact.pdf_url) {
        window.open(artifact.pdf_url, '_blank');
        return;
      }
      const { data } = await api.post<{ pdfUrl: string }>(`/api/artifacts/${artifact.id}/export/pdf`);
      window.open(data.pdfUrl, '_blank');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={downloadMarkdown} className="gap-2">
        <FileText className="h-4 w-4" />
        Markdown
      </Button>
      <Button variant="secondary" size="sm" onClick={downloadPDF} loading={pdfLoading} className="gap-2">
        <Download className="h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}
