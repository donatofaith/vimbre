import { useEffect, useRef, useState } from 'react'

type Turnstile = {
  render(element: HTMLElement, options: {
    sitekey: string
    size: 'normal' | 'compact'
    callback: (token: string) => void
    'expired-callback': () => void
    'error-callback': () => void
  }): string
  remove(widget: string): void
}

const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const widgetApi = () => (window as Window & { turnstile?: Turnstile }).turnstile
let loading: Promise<Turnstile> | undefined

function loadTurnstile() {
  const api = widgetApi()
  if (api) return Promise.resolve(api)
  return loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = window.setTimeout(fail, 15000)
    function fail() {
      window.clearTimeout(timeout)
      script.remove()
      reject(new Error('Turnstile unavailable'))
    }
    script.src = scriptUrl
    script.async = true
    script.onload = () => {
      const api = widgetApi()
      if (!api) return fail()
      window.clearTimeout(timeout)
      resolve(api)
    }
    script.onerror = fail
    document.head.appendChild(script)
  }).catch(error => {
    loading = undefined
    throw error
  })
}

export function AuthChallenge({ siteKey, onToken }: {
  siteKey: string
  onToken: (token: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let api: Turnstile | undefined
    let widget: string | undefined
    void loadTurnstile().then(loaded => {
      if (!active || !container.current) return
      api = loaded
      widget = api.render(container.current, {
        sitekey: siteKey,
        size: container.current.clientWidth < 300 ? 'compact' : 'normal',
        callback: token => { if (active) { setFailed(false); onToken(token) } },
        'expired-callback': () => { if (active) onToken('') },
        'error-callback': () => { if (active) { onToken(''); setFailed(true) } },
      })
    }).catch(() => { if (active) setFailed(true) })
    return () => {
      active = false
      if (widget !== undefined) api?.remove(widget)
    }
  }, [attempt, onToken, siteKey])

  return <div>
    <div ref={container} aria-label="Security verification" />
    {failed && <p role="alert">
      Security verification could not load.{' '}
      <button type="button" onClick={() => { onToken(''); setFailed(false); setAttempt(value => value + 1) }}>Try again</button>
    </p>}
  </div>
}
