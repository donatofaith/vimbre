import { supabase } from './supabase'

export async function uploadValidated(bucket: string, path: string, file: Blob, filename: string) {
  const extension = filename.split('.').at(-1)?.toLowerCase() ?? ''
  const { error } = await supabase.functions.invoke('validated-upload', {
    body: file,
    headers: { 'Content-Type': 'application/octet-stream', 'x-upload-bucket': bucket,
      'x-upload-path': path, 'x-upload-type': extension },
  })
  if (!error) return { error: null }
  const status = 'context' in error && error.context instanceof Response ? error.context.status : 0
  const message = status === 415 ? 'This file does not match an allowed file type.' :
    status === 413 ? 'This file exceeds the upload size limit.' : 'This file could not be uploaded. Try again.'
  return { error: Object.assign(new Error(message), { statusCode: String(status) }) }
}
