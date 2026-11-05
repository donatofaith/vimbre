export function blogImage(value) {
  if (!value || typeof value.url !== 'string' || value.url.length > 2048 ||
    typeof value.alt !== 'string' || !value.alt.trim() || value.alt.length > 250) return null
  try {
    const url = new URL(value.url)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return {url:url.href,alt:value.alt.trim()}
  } catch {
    return null
  }
}
