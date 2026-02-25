'use client'
import { ExternalLink, Youtube } from 'lucide-react';
import type { VideoLink } from '@/types';

interface VideoLinkListProps {
  videos: VideoLink[];
}

export function VideoLinkList({ videos }: VideoLinkListProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Youtube className="h-4 w-4 text-red-600" />
        Suggested Videos
      </p>
      {videos.map((video, idx) => (
        <a
          key={idx}
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg hover:border-primary-300 hover:bg-primary-50/30 transition-all cursor-pointer group"
        >
          <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <Youtube className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 line-clamp-2 group-hover:text-primary-700">
              {video.title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{video.channelTitle}</p>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
        </a>
      ))}
    </div>
  );
}
