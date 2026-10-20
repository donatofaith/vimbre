import { animate, scroll } from 'motion'
import type { AnimationSequence } from 'motion'
const ease: [number, number, number, number] = [.22, 1, .36, 1]
export function createLandingMotion(root: HTMLElement, shell: HTMLElement, onState: (state: { paused: boolean; ready: boolean }) => void) {
  delete shell.dataset.storyComplete
  const disposers: (() => void)[] = []
  const all = new Set<ReturnType<typeof animate>>()
  let disposed = false, userPaused = false, heroVisible = false, complete = false
  const mobile = window.matchMedia('(max-width: 767px)')
  const elements = (selector: string, within: ParentNode = root) => Array.from(within.querySelectorAll<HTMLElement>(selector))
  const timeline: AnimationSequence = []
  const duration = mobile.matches ? 7.6 : 8.6
  const at = (time: number) => time * duration / 8.6
  const frame = (selector: string, frames: Record<string, number[] | string[]>, time = 0, length = .5) => {
    elements(selector, shell).forEach(el => timeline.push([el, frames, { at: at(time), duration: at(length), ease }]))
  }
  elements('[data-story-source]', shell).forEach((el, i) => {
    timeline.push([el, { opacity: [0, 1, 1, .6, .6, 0], transform: ['translateY(16px)', 'translateY(0)', 'translateY(0)', 'translateY(0)', 'translateY(0)', 'translateY(0)'] }, { at: at(i * .12), duration: at(8.6 - i * .12), times: [0, .08, .18, .32, .93, 1], ease }])
  })
  frame('[data-story-chip]', { opacity: [0, 1], transform: ['scale(.96)', 'scale(1)'] }, .8, .6)
  if (!mobile.matches) elements('[data-story-dot]', shell).forEach((el, i) => timeline.push([el, { opacity: [0, 1, 1, 0], transform: ['translate(0px,0px)', `translate(35px,${(1 - i) * 15}px)`, `translate(80px,${(1 - i) * 45}px)`, `translate(120px,${110 - i * 90}px)`] }, { at: 1.6 + i * .1, duration: 1, ease }]))
  frame('[data-story-record]', { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0)'] }, 2.8, .5)
  elements('[data-story-row]', shell).forEach((el, i) => timeline.push([el, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] }, { at: at(2.9 + i * .1), duration: at(.4), ease }]))
  frame('[data-story-ring]', { opacity: [0, .4, 0] }, 3.3, .7)
  frame('[data-story-sam]', { opacity: [0, 1, .6] }, 4, 1)
  frame('[data-story-alex]', { opacity: [0, 1], transform: ['translateX(24px)', 'translateX(0)'] }, 5, .8)
  frame('[data-story-line]', { transform: ['scaleY(0)', 'scaleY(1)'] }, 5.5, .5)
  frame('[data-story-resolution]', { opacity: [0, 1] }, 6.4, .4)
  frame('.rs-story-stage', { opacity: [1, 0] }, 8, .6)
  const hero = animate(timeline, { repeat: 2 })
  hero.pause()
  all.add(hero)
  const restore = () => {
    shell.dataset.storyComplete = 'true'
    hero.cancel()
    shell.querySelectorAll<HTMLElement>('.rs-story-stage, [data-story-source], [data-story-chip], [data-story-dot], [data-story-record], [data-story-row], [data-story-ring], [data-story-sam], [data-story-alex], [data-story-line], [data-story-resolution]').forEach(el => {
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
  revealRows('.rs-day-panel', '[data-day-row]', 'X')
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
