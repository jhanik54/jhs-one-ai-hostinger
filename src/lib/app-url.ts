/** Build absolute URLs from the configured public origin, never the incoming Host header. */
export function appUrl(path: string): URL {
  const configuredUrl = process.env.APP_URL?.trim()

  if (!configuredUrl && process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL must be configured in production.')
  }

  const url = new URL(configuredUrl || 'http://localhost:3000')
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('APP_URL must use HTTP or HTTPS.')
  }

  if (process.env.NODE_ENV === 'production') {
    const hostname = url.hostname.toLowerCase()
    if (
      url.protocol !== 'https:' ||
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) {
      throw new Error('APP_URL must be a public HTTPS URL in production.')
    }
  }

  return new URL(path, url.origin)
}
