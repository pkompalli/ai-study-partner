'use client'
import { useState } from 'react';
import { FileText, Image, FileJson, AlignLeft } from 'lucide-react';
import { FileDropzone } from './FileDropzone';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type SourceType = 'text' | 'pdf' | 'image' | 'json';

interface CourseInputStepProps {
  onNext: (data: { sourceType: SourceType; rawInput?: string; file?: File; files?: File[] }) => void;
}

const sourceOptions: { type: SourceType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Paste Text', icon: <AlignLeft className="h-5 w-5" /> },
  { type: 'pdf', label: 'Upload PDF', icon: <FileText className="h-5 w-5" /> },
  { type: 'image', label: 'Upload Image', icon: <Image className="h-5 w-5" /> },
  { type: 'json', label: 'Upload JSON', icon: <FileJson className="h-5 w-5" /> },
];

export function CourseInputStep({ onNext }: CourseInputStepProps) {
  const [sourceType, setSourceType] = useState<SourceType>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [files, setFiles] = useState<File[]>([]);

  const canSubmit = sourceType === 'text'
    ? text.length > 20
    : sourceType === 'image'
      ? files.length > 0
      : !!file;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Add your course content</h2>
        <p className="text-sm text-gray-600 mt-1">Paste text, or upload a PDF, image, or JSON file.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sourceOptions.map(opt => (
          <button
            key={opt.type}
            onClick={() => { setSourceType(opt.type); setFile(undefined); }}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors',
              sourceType === opt.type
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {sourceType === 'text' ? (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your course syllabus, notes, or any educational content here..."
          className="w-full h-48 px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      ) : sourceType === 'image' ? (
        <FileDropzone
          onFile={f => setFiles([f])}
          onFiles={setFiles}
          accept=".png,.jpg,.jpeg,.webp"
          multiple
        />
      ) : (
        <FileDropzone
          onFile={setFile}
          accept={sourceType === 'pdf' ? '.pdf' : '.json'}
        />
      )}

      <Button
        onClick={() => onNext({ sourceType, rawInput: text || undefined, file, files: files.length ? files : undefined })}
        disabled={!canSubmit}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}
