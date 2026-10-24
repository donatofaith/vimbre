import { animate, scroll } from 'motion'
import type { AnimationSequence } from 'motion'
import { heroStoryTiming } from './hero-story-timing'
const ease: [number, number, number, number] = [.22, 1, .36, 1]
export function createLandingMotion(root: HTMLElement, shell: HTMLElement, onState: (state: { paused: boolean; ready: boolean }) => void) {
  delete shell.dataset.storyComplete
  const disposers: (() => void)[] = []
  const all = new Set<ReturnType<typeof animate>>()
  let disposed = false, userPaused = false, heroVisible = false, complete = false
  const mobile = window.matchMedia('(max-width: 767px)')
  const elements = (selector: string, within: ParentNode = root) => Array.from(within.querySelectorAll<HTMLElement>(selector))
  const timeline: AnimationSequence = []
  const timing = mobile.matches ? heroStoryTiming.mobile : heroStoryTiming.desktop
  const { duration, capture, draft, confirmed, saved, away, cover, resolve, reset } = timing
  const transition = heroStoryTiming.transition
  const frame = (selector: string, frames: Record<string, number[] | string[]>, at: number, length: number = transition, times?: number[]) => {
    elements(selector, shell).forEach(el => timeline.push([el, frames, { at, duration: length, ease, times }]))
  }
  const scene = (name: string, start: number, end: number) => {
    const length = end - start
    frame(`[data-scene="${name}"]`, { opacity: [0, 1, 1, 0], transform: ['translateX(12px)', 'translateX(0)', 'translateX(0)', 'translateX(0)'] }, start, length, [0, transition / length, 1 - transition / length, 1])
  }
  scene('email', 0, capture + transition)
  scene('capture', capture, draft + transition)
  scene('draft', draft, confirmed + transition)
  scene('confirmed', confirmed, saved + transition)
  scene('saved', saved, away + transition)
  scene('away', away, cover + transition)
  frame('[data-scene="cover"]', { opacity: [0, 1], transform: ['translateX(12px)', 'translateX(0)'] }, cover)
  frame('[data-capture-dot]', { opacity: [0, 1, 1, 0] }, capture, saved - capture)
  elements('[data-phrase]', shell).forEach((el, i) => timeline.push([el, { transform: ['scaleX(0)', 'scaleX(1)'] }, { at: capture + .4 + i * .12, duration: .35, ease }]))
  elements('[data-draft-row]', shell).forEach((el, i) => timeline.push([el, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] }, { at: draft + .1 + i * heroStoryTiming.rowStagger, duration: .4, ease }]))
  elements('[data-cover-row]', shell).forEach((el, i) => timeline.push([el, { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0)'] }, { at: cover + i * heroStoryTiming.coverStagger, duration: .5, ease }]))
  frame('[data-cover-highlight]', { opacity: [0, 1] }, cover + .8, .5)
  frame('[data-story-resolution]', { opacity: [0, 1] }, resolve, .4)
  frame('.rs-story-stage', { opacity: [1, 0] }, reset, duration - reset)
  // Measure real controls on both layouts. A decorative pointer never dispatches DOM clicks.
  const layout = shell.querySelector<HTMLElement>('.rs-demo-layout')!
  const bounds = layout.getBoundingClientRect()
  let previousX = bounds.width * .75, previousY = 60
  const clicks = [
    ['capture', '.rs-demo-capture-button', capture], ['review', '.rs-demo-review', draft],
    ['save', '.rs-demo-save', confirmed], ['role', '.rs-demo-role', saved],
    ['handovers', '.rs-demo-handovers', away], ['cover', '.rs-demo-cover-button', cover],
  ] as const
  for (const [name, selector, time] of clicks) {
    const target = shell.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
    const x = target.left + target.width * .55 - bounds.left
    const y = target.top + target.height * .5 - bounds.top
    const ring = shell.querySelector<HTMLElement>(`[data-demo-click="${name}"]`)!
    ring.style.left = `${x - 12}px`; ring.style.top = `${y - 12}px`
    frame('[data-demo-cursor]', { opacity: [0, 1, 1, 0], transform: [`translate(${previousX}px,${previousY}px)`, `translate(${x}px,${y}px)`, `translate(${x}px,${y}px)`, `translate(${x}px,${y}px)`] }, time - .8, 1, [0, .65, .85, 1])
    frame(`[data-demo-click="${name}"]`, { opacity: [0, .85, 0], transform: ['scale(.6)', 'scale(1)', 'scale(1.5)'] }, time - .1, .4)
    frame(selector, { transform: ['scale(1)', 'scale(.97)', 'scale(1)'] }, time - .1, .25)
    previousX = x; previousY = y
  }
  const hero = animate(timeline, { repeat: heroStoryTiming.plays - 1 })
  hero.pause()
  all.add(hero)
  const restore = () => {
    shell.dataset.storyComplete = 'true'
    hero.cancel()
    shell.querySelectorAll<HTMLElement>('.rs-story-stage, [data-scene], [data-phrase], [data-draft-row], [data-cover-row], [data-capture-dot], [data-demo-cursor], [data-demo-click], [data-cover-highlight], [data-story-resolution], .rs-demo-next, .rs-demo-save, .rs-demo-capture-button, .rs-demo-cover-button').forEach(el => {
      el.style.removeProperty('opacity')
      el.style.removeProperty('transform')
    })
  }
  const sync = () => {
    if (disposed || complete) return
    if (heroVisible && !document.hidden && !userPaused) hero.play()
    else hero.pause()
    onState({ paused: userPaused, ready: true })
  }
  void hero.then(() => { if (!disposed) { complete = true; restore(); onState({ paused: true, ready: false }) } })
  const heroObserver = new IntersectionObserver(entries => { heroVisible = entries[0].intersectionRatio >= .4; sync() }, { threshold: [0, .4] })
  heroObserver.observe(shell)
  disposers.push(() => heroObserver.disconnect())

  const headings = elements('[data-reveal] h2')
  const originals = new Map(headings.map(el => [el, el.textContent ?? '']))
  const splitHeadings = () => {
    for (const [heading, text] of originals) {
      const words = text.split(/\s+/)
      heading.replaceChildren(...words.map((word, i) => {
        const span = document.createElement('span'); span.textContent = word + (i === words.length - 1 ? '' : ' '); return span
      }))
      const lines: string[] = []
      let previous = -Infinity
      Array.from(heading.children).forEach(word => {
        const top = word.getBoundingClientRect().top
        if (Math.abs(top - previous) > 3) { lines.push(''); previous = top }
        lines[lines.length - 1] += word.textContent
      })
      heading.replaceChildren(...lines.map((line, i) => {
        const clip = document.createElement('span'); clip.className = 'rs-headline-line'
        const inner = document.createElement('span'); inner.textContent = line; inner.style.setProperty('--line-delay', `${i * 80}ms`)
        clip.append(inner); return clip
      }))
    }
  }
  splitHeadings()
  void document.fonts.ready.then(() => { if (!disposed) splitHeadings() })
  let layoutFrame = 0
  const resize = () => { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(() => { splitHeadings(); setupProblem() }) }
  window.addEventListener('resize', resize, { passive: true })
  disposers.push(() => { window.removeEventListener('resize', resize); cancelAnimationFrame(layoutFrame); originals.forEach((text, heading) => { heading.textContent = text }) })
  const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting || entry.intersectionRatio < .2) return
    entry.target.classList.add('rs-visible')
    reveal.unobserve(entry.target)
  }), { threshold: .2 })
  elements('[data-reveal]').forEach(el => {
    const bounds = el.getBoundingClientRect()
    if (bounds.top < innerHeight && bounds.bottom > 0) el.classList.add('rs-visible')
    else el.classList.add('rs-pending')
    reveal.observe(el)
  })
  disposers.push(() => reveal.disconnect())
  const revealRows = (selector: string, rowSelector: string, axis: string) => {
    const container = root.querySelector(selector)
    if (!container) return
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      elements(rowSelector, container).forEach((row, i) => all.add(animate(row, { opacity: [0, 1], transform: [`translate${axis}(${axis === 'X' ? '-12' : '16'}px)`, `translate${axis}(0)`] }, { duration: .5, delay: i * .06, ease })))
      container.classList.add('rs-why-emphasis')
      observer.disconnect()
    }, { threshold: .2 })
    observer.observe(container)
    disposers.push(() => observer.disconnect())
  }
  revealRows('.rs-why-visual', '[data-record-row]', 'Y')

  let cleanupProblem = () => {}
  const setupProblem = () => {
    cleanupProblem()
    const problem = root.querySelector<HTMLElement>('[data-problem]')
    if (!problem || mobile.matches) return
    const cards = elements('[data-problem-source]')
    const target = root.querySelector<HTMLElement>('[data-problem-record]')!
    const b = target.getBoundingClientRect()
    const moves = cards.map((el, i) => { const a = el.getBoundingClientRect(); return { el, x: b.left + b.width / 2 - a.left - a.width / 2, y: b.top + b.height / 2 - a.top - a.height / 2, angle: [-4, 5, 3, -3][i] } })
    const detach = scroll((progress: number) => {
      if (document.hidden) return
      moves.forEach(({ el, x, y, angle }) => { el.style.transform = `translate(${x * progress}px,${y * progress}px) rotate(${angle * (1 - progress)}deg)`; el.style.opacity = String(1 - progress) })
      target.style.opacity = String(Math.min(1, progress * 1.5))
      target.style.transform = `translateY(${16 * (1 - progress)}px)`
    }, { target: problem, offset: ['start 80%', 'start 20%'] })
    cleanupProblem = () => { detach(); [...cards, target].forEach(el => { el.style.removeProperty('transform'); el.style.removeProperty('opacity') }) }
  }
  setupProblem()
  mobile.addEventListener('change', setupProblem)
  disposers.push(() => { mobile.removeEventListener('change', setupProblem); cleanupProblem() })
  const motif = root.querySelector<HTMLElement>('.rs-hero-motif')
  if (motif) {
    const detach = scroll((progress: number) => { if (!document.hidden) motif.style.transform = `translateY(${progress * -24}px) rotate(-20deg)` }, { target: shell, offset: ['start start', 'end start'] })
    disposers.push(() => { detach(); motif.style.removeProperty('transform') })
  }
  const final = root.querySelector<HTMLElement>('[data-final-section]')
  let finalVisible = false
  const driftTarget = final?.querySelector<HTMLElement>('.rs-stream-motif')
  const drift = driftTarget ? animate(driftTarget, { transform: ['translateY(0) rotate(-20deg)', 'translateY(24px) rotate(-20deg)'] }, { duration: 20, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', autoplay: false }) : null
  if (drift) all.add(drift)
  if (final && drift) {
    const observer = new IntersectionObserver(entries => { finalVisible = entries[0].isIntersecting; if (finalVisible && !document.hidden) drift.play(); else drift.pause() })
    observer.observe(final)
    disposers.push(() => observer.disconnect())
  }
  const visibility = () => { sync(); if (document.hidden) all.forEach(a => a.pause()); else { if (finalVisible) drift?.play(); all.forEach(a => { if (a !== hero && a !== drift) a.play() }) } }
  document.addEventListener('visibilitychange', visibility)
  disposers.push(() => document.removeEventListener('visibilitychange', visibility))
  return {
    toggle: () => { if (!complete) { userPaused = !userPaused; sync() } },
    dispose: () => { disposed = true; disposers.forEach(dispose => dispose()); all.forEach(a => a.cancel()); root.querySelectorAll('.rs-pending').forEach(el => el.classList.remove('rs-pending')); restore() },
  }
}

