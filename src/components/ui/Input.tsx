import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
export function Input({ label, error, id, ...props }: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return <div className="field"><label htmlFor={inputId}>{label}</label><input {...props} id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : props['aria-describedby']} />{error && <p id={`${inputId}-error`} className="field-error" role="alert">{error}</p>}</div>
}
