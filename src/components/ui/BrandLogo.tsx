type BrandLogoProps = { variant?: 'full' | 'symbol'; className?: string; decorative?: boolean }
export function BrandLogo({ variant = 'full', className = '', decorative = false }: BrandLogoProps) {
  const symbol = variant === 'symbol'
  return <img className={`vimbre-logo vimbre-logo-${variant} ${className}`.trim()} src={symbol ? '/vimbre-mark-colour.svg' : '/vimbre-lockup-compact-colour.svg'} width={symbol ? 44 : 153} height={symbol ? 44 : 48} alt={decorative ? '' : 'Vimbre'} aria-hidden={decorative || undefined} decoding="async" />
}
