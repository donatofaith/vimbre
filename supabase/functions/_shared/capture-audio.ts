export const recordingBytes = 16 * 1024 * 1024

export function audioFile(type: string, header: Uint8Array) {
  switch (type.split(';')[0].trim().toLowerCase()) {
    case 'audio/webm':
      return header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3 ? 'meeting.webm' : null
    case 'audio/mp4':
      return String.fromCharCode(...header.slice(4, 8)) === 'ftyp' ? 'meeting.mp4' : null
    case 'audio/ogg':
      return String.fromCharCode(...header.slice(0, 4)) === 'OggS' ? 'meeting.ogg' : null
    default:
      return null
  }
}
