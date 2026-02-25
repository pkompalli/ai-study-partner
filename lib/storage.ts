import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'artifacts'

/**
 * Upload a file to Supabase Storage.
 *
 * The first parameter `_bucket` is accepted for drop-in compatibility with the
 * original local-disk storage service (server/src/services/storage.ts) whose
 * callers always pass a bucket name as the first argument. The value is
 * ignored — all files go into the `artifacts` bucket.
 */
export async function uploadFile(
  _bucket: string,
  filePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType, upsert: true })
  if (error) throw error
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return urlData.publicUrl
}

/**
 * Delete a file from Supabase Storage.
 *
 * The first parameter `_bucket` is accepted for drop-in compatibility with the
 * original local-disk storage service.
 */
export async function deleteFile(_bucket: string, filePath: string): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase.storage.from(BUCKET).remove([filePath])
  if (error) throw error
}
