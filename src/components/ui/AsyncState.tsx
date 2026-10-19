import { Button } from './Button'
export function LoadingState() {
  return <div role="status" aria-live="polite"><span className="sr-only">Loading</span><div className="skeleton" aria-hidden="true" /></div>
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert"><h2>Something needs attention</h2><p>{message}</p>{onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}</div>
}
