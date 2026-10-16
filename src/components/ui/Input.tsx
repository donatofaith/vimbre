import { useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
export function Input({ label, error, id, type, ...props }: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const input = <input {...props} type={isPassword && visible ? 'text' : type} id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : props['aria-describedby']} />
  return <div className="field">
    <label htmlFor={inputId}>{label}</label>
    {isPassword ? <div className="password-control">{input}<button type="button" className="password-toggle" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-controls={inputId} aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible(value => !value)}>{visible ? 'Hide' : 'Show'}</button></div> : input}
    {error && <p id={`${inputId}-error`} className="field-error" role="alert">{error}</p>}
  </div>
}
