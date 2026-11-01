import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'warning'; loading?: boolean }
export function Button({ variant = 'primary', className = '', type = 'button', loading = false, disabled, children, ...props }: Props) {
  return <button {...props} disabled={disabled || loading} aria-busy={loading || undefined} type={type} className={`button button-${variant} ${className}`}>{loading && <span className="button-spinner" aria-hidden="true" />}{children}</button>
}

