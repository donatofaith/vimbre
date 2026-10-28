import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const selector = 'details.md-add-menu, details[data-menu]'
/** Shared dismissal for disclosure menus; content disclosures are unaffected. */
export function MenuLifecycle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const close = (restore = false) => document.querySelectorAll<HTMLDetailsElement>(`${selector.split(', ').map(s => `${s}[open]`).join(', ')}`).forEach(menu => {
      menu.open = false
      if (restore) menu.querySelector<HTMLElement>('summary')?.focus({preventScroll:true})
    })
    close()
    const toggle = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLDetailsElement) || !target.matches(selector) || !target.open) return
      document.querySelectorAll<HTMLDetailsElement>(selector).forEach(menu => { if (menu !== target) menu.open = false })
    }
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(selector)) close()
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true) }
    const scroll = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest(selector)) close()
    }
    document.addEventListener('toggle', toggle, true)
    document.addEventListener('pointerdown', pointer)
    document.addEventListener('keydown', key)
    document.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('toggle', toggle, true)
      document.removeEventListener('pointerdown', pointer)
      document.removeEventListener('keydown', key)
      document.removeEventListener('scroll', scroll, true)
    }
  }, [pathname])
  return null
}
