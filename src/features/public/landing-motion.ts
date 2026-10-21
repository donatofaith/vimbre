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
  const { duration, capture, draft, saved, away, cover, resolve, reset } = timing
  const transition = heroStoryTiming.transition
  const frame = (selector: string, frames: Record<string, number[] | string[]>, at: number, length: number = transition, times?: number[]) => {
    elements(selector, shell).forEach(el => timeline.push([el, frames, { at, duration: length, ease, times }]))
  }
  const scene = (name: string, start: number, end: number, first = false) => {
    frame(`[data-scene="${name}"]`, {
      opacity: [0, 1, 1, 0],
      transform: first ? ['translateY(24px)', 'translateY(0)', 'translateY(0)', 'translateY(0)'] : ['translateX(16px)', 'translateX(0)', 'translateX(0)', 'translateX(0)'],
    }, start, end - start, [0, (first ? .6 : transition) / (end - start), 1 - transition / (end - start), 1])
  }
  scene('email', 0, capture + transition, true)
  scene('capture', capture, draft + transition)
  scene('draft', draft, saved + transition)
  scene('saved', saved, away + transition)
  scene('away', away, cover + transition)
  frame('[data-scene="cover"]', { opacity: [0, 1], transform: ['translateX(16px)', 'translateX(0)'] }, cover)
  frame('[data-capture-dot]', { opacity: [0, 1] }, .6)
  if (!mobile.matches) elements('[data-phrase]', shell).forEach((el, i) => timeline.push([el, { transform: ['scaleX(0)', 'scaleX(1)'] }, { at: capture + .45 + i * .12, duration: .35, ease }]))
  elements('[data-draft-row]', shell).forEach((el, i) => timeline.push([el, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] }, { at: draft + .1 + i * heroStoryTiming.rowStagger, duration: .4, ease }]))
  frame('[data-save-toast]', { opacity: [0, 1, 1, 0], transform: ['translateY(16px)', 'translateY(0)', 'translateY(0)', 'translateY(0)'] }, saved, away - saved + transition)
  elements('[data-cover-row]', shell).forEach((el, i) => timeline.push([el, { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0)'] }, { at: cover + i * heroStoryTiming.coverStagger, duration: .5, ease }]))
  frame('[data-cover-highlight]', { opacity: [0, 1] }, cover + 1, .5)
  frame('[data-story-resolution]', { opacity: [0, 1] }, resolve, .5)
  frame('.rs-story-stage', { opacity: [1, 0] }, reset, duration - reset)
  if (!mobile.matches) {
    frame('.rs-demo-camera', { transform: ['scale(1)', 'scale(1.05) translate(-4px,-6px)'] }, draft, heroStoryTiming.camera)
    frame('.rs-demo-camera', { transform: ['scale(1.05) translate(-4px,-6px)', 'scale(1)'] }, away, heroStoryTiming.camera)
    frame('.rs-demo-camera', { transform: ['scale(1)', 'scale(1.04) translate(-3px,-4px)'] }, cover, heroStoryTiming.camera)
    const viewport = shell.querySelector<HTMLElement>('.rs-demo-viewport')!
    const cursor = shell.querySelector<HTMLElement>('[data-demo-cursor]')!
    const cursorTo = (targetSelector: string, at: number, startX: number, startY: number, ring?: string) => {
      const bounds = viewport.getBoundingClientRect()
      const target = shell.querySelector<HTMLElement>(targetSelector)!.getBoundingClientRect()
      const x = target.left + target.width * .65 - bounds.left
      const y = target.top + target.height * .5 - bounds.top
      const click = ring ? shell.querySelector<HTMLElement>(ring) : null
      if (click) { click.style.left = `${x - 12}px`; click.style.top = `${y - 12}px` }
      timeline.push([cursor, { opacity: [0, 1, 1, 1], transform: [`translate(${startX}px,${startY}px)`, `translate(${startX + (x - startX) * .35}px,${startY - 16}px)`, `translate(${x - 12}px,${y - 10}px)`, `translate(${x}px,${y}px)`] }, { at, duration: heroStoryTiming.cursor, ease }])
      if (ring) {
        frame(ring, { opacity: [0, .8, 0], transform: ['scale(.6)', 'scale(1)', 'scale(1.4)'] }, at + heroStoryTiming.cursor, heroStoryTiming.click)
        frame('[data-demo-cursor]', { opacity: [1, 0] }, at + heroStoryTiming.cursor + .15, .3)
      }
    }
    cursorTo('.rs-demo-capture-button', capture - 1.05, 35, 140, '[data-click-capture]')
    cursorTo('.rs-demo-save', saved - 1.05, 70, 210, '[data-click-save]')
    cursorTo('.rs-demo-recent', cover + .5, 48, 185)
  } else {
    frame('[data-click-capture]', { opacity: [0, .8, 0], transform: ['scale(.6)', 'scale(1)', 'scale(1.4)'] }, capture - .3, .4)
    frame('[data-click-save]', { opacity: [0, .8, 0], transform: ['scale(.6)', 'scale(1)', 'scale(1.4)'] }, saved - .3, .4)
  }
  const hero = animate(timeline, { repeat: heroStoryTiming.plays - 1 })
  hero.pause()
  all.add(hero)
  const restore = () => {
    shell.dataset.storyComplete = 'true'
    hero.cancel()
    shell.querySelectorAll<HTMLElement>('.rs-story-stage, .rs-demo-camera, [data-scene], [data-phrase], [data-draft-row], [data-cover-row], [data-capture-dot], [data-demo-cursor], [data-click-capture], [data-click-save], [data-save-toast], [data-cover-highlight], [data-story-resolution]').forEach(el => {
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
  const pointerMedia = window.matchMedia('(hover: hover) and (pointer: fine)')
  const depth = shell.querySelector<HTMLElement>('.rs-demo-depth')!
  let pointerFrame = 0
  const resetDepth = () => { cancelAnimationFrame(pointerFrame); depth.style.removeProperty('transform') }
  const pointerMove = (event: PointerEvent) => {
    if (!pointerMedia.matches || mobile.matches || document.hidden || !heroVisible || userPaused || complete) return
    const bounds = shell.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width * 16 - 8
    const y = (event.clientY - bounds.top) / bounds.height * 16 - 8
    cancelAnimationFrame(pointerFrame)
    pointerFrame = requestAnimationFrame(() => { depth.style.transform = `translate(${x}px,${y}px)` })
  }
  shell.addEventListener('pointermove', pointerMove)
  shell.addEventListener('pointerleave', resetDepth)
  disposers.push(() => { shell.removeEventListener('pointermove', pointerMove); shell.removeEventListener('pointerleave', resetDepth); resetDepth() })
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

