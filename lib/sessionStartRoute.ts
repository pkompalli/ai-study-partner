export function buildSessionStartRoute(params: {
  courseId: string;
  subjectId?: string;
  topicId?: string;
  chapterId?: string;
}): string {
  const search = new URLSearchParams({
    courseId: params.courseId,
  });

  if (params.subjectId) {
    search.set('subjectId', params.subjectId);
  }

  if (params.topicId) {
    search.set('topicId', params.topicId);
  }

  if (params.chapterId) {
    search.set('chapterId', params.chapterId);
  }

  return `/sessions/new?${search.toString()}`;
}
