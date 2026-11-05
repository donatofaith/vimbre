import {useEffect, useState} from 'react'
import {headline} from './public-content'
import {walkthrough} from './walkthrough.config'

export function HeroHeadline() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: number | undefined
    function sync() {
      window.clearTimeout(timer)
      if (motion.matches || document.hidden) return
      timer = window.setTimeout(() => setIndex((index + 1) % walkthrough.length), index === 0 ? 1700 : 2600)
    }
    sync()
    motion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.clearTimeout(timer)
      motion.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [index])

  return <h1 id="hero-title" tabIndex={-1}>
    <span className="sr-only">{headline}</span>
    <span aria-hidden="true" className="rf-headline-fixed">Declutter your</span>
    <span aria-hidden="true" className="rf-rotating-word">
      {walkthrough.map((step, position) => (
        <span key={step.id} className={position === index ? 'public-headline-current' : undefined}>
          {step.title.toLowerCase() + '.'}
        </span>
      ))}
    </span>
  </h1>
}
