export function buildSessionStartRoute(params: {
  courseId: string;
  topicId: string;
  chapterId?: string;
}): string {
  const search = new URLSearchParams({
    courseId: params.courseId,
    topicId: params.topicId,
  });

  if (params.chapterId) {
    search.set('chapterId', params.chapterId);
  }

  return `/sessions/new?${search.toString()}`;
}
