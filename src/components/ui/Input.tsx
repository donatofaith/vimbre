import { useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { fieldExamples } from './field-examples'
type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }
export function Input({ label, error, hint, placeholder, id, type, ...props }: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const example = fieldExamples[label]
  const helper = hint ?? example?.hint
  const suggested = placeholder ?? (isPassword ? (label === 'Confirm password' ? 'Type the same password again' : props.autoComplete === 'new-password' ? 'At least 12 characters' : 'Enter your password') : example?.placeholder)
  const describedBy = [props['aria-describedby'], helper && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined
  const input = <input {...props} placeholder={suggested} type={isPassword && visible ? 'text' : type} id={inputId} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
  return <div className="field">
    <label htmlFor={inputId}>{label}</label>
    {isPassword ? <div className="password-control">{input}<button type="button" className="password-toggle" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-controls={inputId} aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible(value => !value)}>{visible ? 'Hide' : 'Show'}</button></div> : input}
    {helper && <p id={`${inputId}-hint`} className="field-hint">{helper}</p>}
    {error && <p id={`${inputId}-error`} className="field-error" role="alert">{error}</p>}
  </div>
}
