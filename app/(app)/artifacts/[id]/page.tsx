'use client'
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { ArtifactViewer } from '@/components/artifact/ArtifactViewer';
import { ExportButton } from '@/components/artifact/ExportButton';
import { Spinner } from '@/components/ui/Spinner';
import type { LessonArtifact } from '@/types';
import { formatDate } from '@/lib/utils';

export default function Page() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [artifact, setArtifact] = useState<LessonArtifact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get<LessonArtifact>(`/api/artifacts/${id}`)
      .then(r => setArtifact(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-600">Artifact not found.</p>
        <Link href="/dashboard" className="text-primary-600 hover:underline text-sm mt-2 block">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{artifact.title}</h1>
            <p className="text-xs text-gray-400 mt-1">{formatDate(artifact.created_at)}</p>
          </div>
          <ExportButton artifact={artifact} />
        </div>
      </div>

      {/* Content */}
      <ArtifactViewer artifact={artifact} />
    </div>
  );
}
