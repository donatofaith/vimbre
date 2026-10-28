import { animate } from 'motion'
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
  const { reset } = timing
  const frame = (selector: string, frames: Record<string, number[] | string[]>, at: number, length: number = .5, times?: number[]) => {
    elements(selector, shell).forEach(el => timeline.push([el, frames, { at, duration: length, ease, times }]))
  }
  frame('[data-scene="email"]',{opacity:[1,1,0],transform:['translateY(0)','translateY(0)','translateY(-12px)']},0,2.5,[0,.8,1])
  frame('[data-scene="draft"]',{opacity:[0,1,1,0]},2,4.5,[0,.12,.88,1])
  frame('[data-signature-paper]',{opacity:[0,1],transform:['scaleY(.92)','scaleY(1)']},6,.5)
  frame('[data-scene="cover"]',{opacity:[0,1],transform:['translateY(8px)','translateY(0)']},6.5,.5)
  elements('[data-draft-row]',shell).forEach((el,i)=>{
    timeline.push([el,{opacity:[0,1],transform:[`translate(${(i-1)*24}px,${16+i*8}px) rotate(${(i-1)*2}deg)`,'translate(0,0) rotate(0deg)']},{at:2.5+i*.06,duration:.5,ease}])
    timeline.push([el,{transform:['perspective(700px) rotateX(0deg) translateY(0)','perspective(700px) rotateX(65deg) translateY(-8px)','perspective(700px) rotateX(0deg) translateY(0)']},{at:6+i*.06,duration:.5,ease}])
    timeline.push([el,{opacity:[1,0],transform:['translateY(0)','translateY(8px)']},{at:reset,duration:.5,ease}])
  })
  frame('[data-scene="confirmed"]',{opacity:[0,1,1,0],transform:['translateY(-16px) scale(.96)','translateY(0) scale(1)','translateY(0) scale(1)','translateY(0) scale(1)']},4.5,2,[0,.25,.75,1])
  frame('[data-scene="cover"],[data-signature-paper]',{opacity:[1,0]},reset,.5)
  frame('[data-scene="email"]',{opacity:[0,1],transform:['translateY(8px)','translateY(0)']},reset,.5)
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
  const resize = () => { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(() => { splitHeadings() }) }
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

  const visibility = () => { sync(); if (document.hidden) all.forEach(a => a.pause()); else all.forEach(a => { if (a !== hero) a.play() }) }
  document.addEventListener('visibilitychange', visibility)
  disposers.push(() => document.removeEventListener('visibilitychange', visibility))
  return {
    toggle: () => { if (!complete) { userPaused = !userPaused; sync() } },
    dispose: () => { disposed = true; disposers.forEach(dispose => dispose()); all.forEach(a => a.cancel()); root.querySelectorAll('.rs-pending').forEach(el => el.classList.remove('rs-pending')); restore() },
  }
}

