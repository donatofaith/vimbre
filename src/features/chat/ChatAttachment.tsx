import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fileSize } from './chat-files'

export type ChatFile = { id: string; name: string; path: string; size: number; mime: string }

export function ChatAttachment({ file }: { file: ChatFile }) {
  const isImage = file.mime.startsWith('image/')
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [thumbnail, setThumbnail] = useState<{ path: string; url: string } | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageError, setImageError] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isImage) return
    let active = true
    void supabase.storage.from('chat-attachments').createSignedUrl(file.path, 300).then(({ data }) => {
      if (active && data) setThumbnail({ path: file.path, url: data.signedUrl })
    }).catch(() => { /* The preview button can request a fresh URL. */ })
    return () => { active = false }
  }, [file.path, isImage])

  async function openAttachment() {
    setBusy(true)
    setError('')
    const bucket = supabase.storage.from('chat-attachments')
    try {
      if (isImage) {
        const { data, error } = await bucket.createSignedUrl(file.path, 300)
        if (error || !data) throw new Error('This image could not be opened. Try again.')
        if (!dialog.current?.isConnected) return
        setImageUrl(data.signedUrl)
        dialog.current.showModal()
        return
      }
      const { data, error } = await bucket.download(file.path)
      if (error || !data) throw new Error('This file could not be downloaded. Try again.')
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'This attachment could not be opened. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="chat-attachment">
    <button ref={trigger} type="button" aria-disabled={busy} aria-haspopup={isImage ? 'dialog' : undefined} onClick={() => { if (!busy) void openAttachment() }}>
      {isImage && thumbnail?.path === file.path && <img src={thumbnail.url} alt="" loading="lazy" />}
      <span>{file.name}<small>{fileSize(file.size)} · {isImage ? (busy ? 'Opening…' : 'View image') : (busy ? 'Downloading…' : 'Download')}</small></span>
    </button>
    {error && <p role="alert">{error}</p>}
    {isImage && <dialog ref={dialog} className="chat-image-viewer" aria-label={file.name} onClose={() => { setImageUrl(''); setImageError(false); trigger.current?.focus() }}>
      <header><strong>{file.name}</strong><button type="button" className="button button-secondary" onClick={() => dialog.current?.close()}>Close</button></header>
      {imageUrl && <img src={imageUrl} alt={file.name} onError={() => { setImageUrl(''); setImageError(true) }} />}
      {imageError && <p role="alert">This image could not be displayed. Close it and try again.</p>}
    </dialog>}
  </div>
}
