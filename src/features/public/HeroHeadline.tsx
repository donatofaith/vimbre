import { useEffect, useState } from 'react'
const words = ['Why', 'Decisions', 'Priorities', 'Progress', 'Work', 'bigger picture', 'context']
export function HeroHeadline() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: ReturnType<typeof setInterval> | undefined
    function sync() {
      clearInterval(timer)
      if (!paused && !media.matches && !document.hidden) timer = setInterval(() => setIndex(i => (i + 1) % words.length), 3000)
    }
    sync(); media.addEventListener('change', sync); document.addEventListener('visibilitychange', sync)
    return () => { clearInterval(timer); media.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync) }
  }, [paused])
  return <div className="rf-headline-wrap"><h1 id="hero-title" tabIndex={-1}><span className="sr-only">Understand the Why</span><span aria-hidden="true" className="rf-headline-fixed">Understand the</span><span aria-hidden="true" className="rf-rotating-word"><span key={index}>“{words[index]}”</span></span></h1><button type="button" className="rf-word-pause" aria-label={paused?'Resume rotating headline':'Pause rotating headline'} aria-pressed={paused} onClick={()=>setPaused(p=>!p)}>{paused?'▶':'Ⅱ'}</button></div>
}
