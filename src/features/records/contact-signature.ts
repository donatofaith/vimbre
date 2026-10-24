export function parseContactSignature(source: string) {
  const lines = source.slice(0, 5000).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const email = source.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ''
  const phone = (source.match(/\+?\d[\d ().-]{5,}\d/g) ?? []).find(value => {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 7 && digits.length <= 15
  })?.trim() ?? ''
  const name = lines.find(line => !/@|\d|https?:|www\./i.test(line) && !/^(kind regards|regards|best|thanks|thank you|sent from|tel|phone|email)\b/i.test(line) && /^[\p{L}][\p{L} .'’-]+$/u.test(line) && line.split(/\s+/).length >= 2)?.slice(0, 200) ?? ''
  return { name, contact: [email, phone].filter(Boolean).join(' · ') }
}
