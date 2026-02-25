import axios from 'axios';
import { chatCompletion } from '@/lib/llm/client';
import { buildYouTubeQueryPrompt } from '@/lib/llm/prompts';
import { env } from '@/lib/config/env';
import type { VideoLink } from '@/types';

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

export async function fetchVideoLinks(topicName: string, chapterName?: string): Promise<VideoLink[]> {
  // Step 1: LLM generates optimised queries
  const queryResponse = await chatCompletion([
    { role: 'user', content: buildYouTubeQueryPrompt(topicName, chapterName) },
  ], { temperature: 0.4 });

  const cleaned = queryResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const { queries } = JSON.parse(cleaned) as { queries: string[] };

  // Step 2: Execute searches
  const results: VideoLink[] = [];
  const seen = new Set<string>();

  for (const query of queries.slice(0, 3)) {
    try {
      const { data } = await axios.get(YT_SEARCH_URL, {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: 2,
          key: env.youtube.apiKey,
          relevanceLanguage: 'en',
          safeSearch: 'strict',
        },
      });

      for (const item of (data.items ?? []) as YouTubeItem[]) {
        const videoId = item.id.videoId;
        if (!seen.has(videoId)) {
          seen.add(videoId);
          results.push({
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            channelTitle: item.snippet.channelTitle,
            description: item.snippet.description,
          });
        }
      }
    } catch (err) {
      console.error('YouTube search error:', err);
    }
  }

  return results.slice(0, 5);
}

interface YouTubeItem {
  id: { videoId: string };
  snippet: { title: string; channelTitle: string; description: string };
}
