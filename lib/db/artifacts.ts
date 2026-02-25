import { createServiceClient } from '@/lib/supabase/server'

export async function getArtifactsBySession(sessionId: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('lesson_artifacts')
    .select('id, session_id, course_id, topic_id, title, pdf_url, created_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getArtifactsByUser(userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('lesson_artifacts')
    .select('id, session_id, course_id, topic_id, title, pdf_url, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getArtifactById(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('lesson_artifacts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function createArtifact(
  userId: string,
  input: {
    session_id: string
    course_id: string
    topic_id?: string
    title: string
    markdown_content: string
  },
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('lesson_artifacts')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateArtifact(
  id: string,
  userId: string,
  input: Partial<{
    title: string
    markdown_content: string
    pdf_url: string
  }>,
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('lesson_artifacts')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateArtifactPdfUrl(id: string, pdfUrl: string) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('lesson_artifacts')
    .update({ pdf_url: pdfUrl })
    .eq('id', id)
  if (error) throw error
}

export async function deleteArtifact(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('lesson_artifacts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}
