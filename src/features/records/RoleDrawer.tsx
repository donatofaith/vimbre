import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
export function RoleDrawer({ children, close, title }: { children: ReactNode; close: () => void; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    element?.showModal()
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <dialog className="vr-drawer" ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); close() }}>
    <div className="vr-drawer-bar"><span>My role</span><Button variant="secondary" onClick={close}>Close panel</Button></div>
    {children}
  </dialog>
}
