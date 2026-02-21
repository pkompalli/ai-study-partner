import { useCallback, useState } from 'react';
import { Upload, FileText, Image, FileJson, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onFile: (file: File) => void;
  onFiles?: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}

const icons: Record<string, React.ReactNode> = {
  'application/pdf': <FileText className="h-8 w-8 text-red-500" />,
  'image/jpeg': <Image className="h-8 w-8 text-blue-500" />,
  'image/png': <Image className="h-8 w-8 text-blue-500" />,
  'image/webp': <Image className="h-8 w-8 text-blue-500" />,
  'application/json': <FileJson className="h-8 w-8 text-yellow-500" />,
};

export function FileDropzone({
  onFile,
  onFiles,
  accept = '.pdf,.png,.jpg,.jpeg,.json',
  multiple = false,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  const handleFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    if (multiple && onFiles) {
      setDroppedFiles(files);
      onFiles(files);
    } else {
      setDroppedFiles([files[0]]);
      onFile(files[0]);
    }
  }, [multiple, onFile, onFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }, [handleFiles]);

  const removeFile = (idx: number) => {
    const next = droppedFiles.filter((_, i) => i !== idx);
    setDroppedFiles(next);
    if (multiple && onFiles) onFiles(next);
    else if (next[0]) onFile(next[0]);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors',
          dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={e => handleFiles(Array.from(e.target.files ?? []))}
        />
        <Upload className="h-8 w-8 text-gray-400" />
        {multiple ? (
          <>
            <p className="text-sm font-medium text-gray-700">Drop images here or click to select</p>
            <p className="text-xs text-gray-500">Select multiple JPG/PNG images — max 20 MB each</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">Drop file here or click to upload</p>
            <p className="text-xs text-gray-500">PDF, PNG, JPG, JSON — max 20 MB</p>
          </>
        )}
      </div>

      {droppedFiles.length > 0 && (
        <ul className="space-y-1.5">
          {droppedFiles.map((f, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
              {icons[f.type] ?? <Upload className="h-4 w-4 text-gray-400" />}
              <span className="flex-1 text-sm text-gray-800 truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={e => { e.stopPropagation(); removeFile(i); }} className="text-gray-400 hover:text-red-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
