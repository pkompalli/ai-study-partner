import { createServiceClient } from '@/lib/supabase/server'

export async function getCoursesByUser(userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      subjects (
        *,
        topics (
          *,
          chapters (*)
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getCourseById(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function createCourse(
  userId: string,
  input: {
    name: string
    description?: string
    goal: 'exam_prep' | 'classwork'
    exam_name?: string
    year_of_study?: string
    source_type?: string
    source_file_url?: string
    raw_input?: string
    structure?: unknown
  },
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCourse(
  id: string,
  userId: string,
  input: Partial<{
    name: string
    description: string
    goal: string
    exam_name: string
    year_of_study: string
    is_active: boolean
  }>,
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCourse(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getCourseWithTree(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      subjects (
        *,
        topics (
          *,
          chapters (*)
        )
      )
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function getCourseContext(courseId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .select('name, goal, year_of_study, exam_name')
    .eq('id', courseId)
    .maybeSingle()
  if (error) throw error
  if (!data) return undefined
  return data
    ? {
        name: data.name,
        goal: data.goal,
        yearOfStudy: data.year_of_study ?? undefined,
        examName: data.exam_name ?? undefined,
      }
    : undefined
}
