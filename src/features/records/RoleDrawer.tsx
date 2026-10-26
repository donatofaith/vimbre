import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import './role-drawer.css'
export function RoleDrawer({ children, close, title, context = 'My role', className = '' }: { context?: string; children: ReactNode; close: () => void; title: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    element?.showModal()
    element?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <dialog className={`vr-drawer ${className}`.trim()} ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); close() }}>
    <div className="vr-drawer-bar"><span>{context}</span><Button variant="secondary" onClick={close}>Close panel</Button></div>
    {children}
  </dialog>
}
