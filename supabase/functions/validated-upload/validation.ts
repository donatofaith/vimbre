const office = 'application/vnd.openxmlformats-officedocument.'
const mime = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', vtt: 'text/vtt', srt: 'application/x-subrip',
  zip: 'application/zip', docx: office + 'wordprocessingml.document',
  xlsx: office + 'spreadsheetml.sheet', pptx: office + 'presentationml.presentation',
}
type Extension = keyof typeof mime
const mb = 1024 * 1024
export const rules = {
  'role-documents': { bytes: 10 * mb, types: ['pdf', 'txt', 'png', 'jpg', 'jpeg', 'docx', 'xlsx'], parts: 2 },
  'task-files': { bytes: 10 * mb, types: ['pdf', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'docx', 'xlsx'], parts: 4 },
  'capture-originals': { bytes: 10 * mb, types: ['pdf', 'docx', 'txt', 'vtt', 'srt'], parts: 4 },
  'chat-attachments': { bytes: 5 * mb, types: ['jpg', 'jpeg', 'pdf', 'txt', 'csv', 'docx', 'xlsx', 'pptx', 'zip'], parts: 4 },
  'company-logos': { bytes: 256 * 1024, types: ['webp'], parts: 2 },
  'member-avatars': { bytes: 1024 * 1024, types: ['jpg', 'jpeg'], parts: 3 },
}
export type Bucket = keyof typeof rules
const decoder = new TextDecoder('utf-8', { fatal: true })
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i

export function uploadTarget(bucket: string, path: string, extension: string) {
  if (!Object.hasOwn(rules, bucket)) return null
  const rule = rules[bucket as Bucket]
  if (!rule.types.includes(extension)) return null
  const pieces = path.split('/')
  if (pieces.length !== rule.parts) return null
  const last = pieces.pop()!
  if (!pieces.every(piece => uuid.test(piece))) return null
  if (bucket === 'capture-originals' ? last !== 'original' :
      !uuid.test(last.split('.')[0]) || (last.includes('.') && last.split('.').slice(1).join('.') !== extension)) return null
  return { bucket: bucket as Bucket, rule, extension: extension as Extension }
}

function archive(bytes: Uint8Array, extension: Extension) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.length - 22
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === bytes.length) break
  }
  if (end < 0 || end < bytes.length - 65557) return false
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  if (!count || count > (extension === 'zip' ? 100 : 2048) || offset + view.getUint32(end + 12, true) !== end ||
      view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count) return false
  const names = new Set<string>()
  let expanded = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) return false
    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const size = view.getUint32(offset + 24, true)
    const length = view.getUint16(offset + 28, true)
    const next = offset + 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
    const local = view.getUint32(offset + 42, true)
    if (next > end || flags & 1 || ![0, 8].includes(method) || local + 30 > end || view.getUint32(local, true) !== 0x04034b50) return false
    const localLength = view.getUint16(local + 26, true)
    const localData = local + 30 + localLength + view.getUint16(local + 28, true)
    if (localLength !== length || localData + view.getUint32(offset + 20, true) > end ||
        bytes.subarray(offset + 46, offset + 46 + length).some((byte, j) => byte !== bytes[local + 30 + j])) return false
    const mode = view.getUint32(offset + 38, true) >>> 16
    if ((mode & 0xf000) === 0xa000) return false
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + length))
    if (!name || name.length > 240 || /[\\:\x00-\x1f]/.test(name) ||
        name.replace(/\/$/, '').split('/').some(part => !part || part.startsWith('.')) ||
        names.has(name.toLowerCase()) || /vbaproject\.bin$/i.test(name)) return false
    if (extension === 'zip' && !name.endsWith('/') && !/\.(jpe?g|pdf|txt|csv|docx|xlsx|pptx)$/i.test(name)) return false
    names.add(name.toLowerCase())
    expanded += size
    if (expanded > (extension === 'zip' ? 20 : 80) * mb) return false
    offset = next
  }
  if (offset !== end) return false
  if (extension === 'zip') return true
  const main = { docx: 'word/document.xml', xlsx: 'xl/workbook.xml', pptx: 'ppt/presentation.xml' }[extension as 'docx' | 'xlsx' | 'pptx']
  return names.has('[content_types].xml') && names.has(main)
}

export function validatedMime(bytes: Uint8Array, extension: Extension): string | null {
  if (!bytes.length) return null
  try {
    let valid: boolean
    switch (extension) {
      case 'jpg': case 'jpeg':
        valid = bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217; break
      case 'png':
        valid = bytes.length >= 45 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v) &&
          ascii(bytes, 12, 16) === 'IHDR' && ascii(bytes, bytes.length - 8, bytes.length - 4) === 'IEND'; break
      case 'webp':
        valid = bytes.length >= 20 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP' &&
          new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 === bytes.length &&
          ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(bytes, 12, 16)); break
      case 'pdf':
        valid = ascii(bytes, 0, 5) === '%PDF-' && /%%EOF\s*$/.test(ascii(bytes, Math.max(0, bytes.length - 1024), bytes.length)); break
      case 'docx': case 'xlsx': case 'pptx': case 'zip':
        valid = archive(bytes, extension); break
      default: {
        const content = decoder.decode(bytes)
        valid = !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(content) &&
          (extension !== 'vtt' || /^WEBVTT(?:[ \t\r\n]|$)/.test(content)) &&
          (extension !== 'srt' || /\d\d:\d\d:\d\d,\d{3}\s+-->\s+\d\d:\d\d:\d\d,\d{3}/.test(content))
      }
    }
    return valid ? mime[extension] : null
  } catch { return null }
}
