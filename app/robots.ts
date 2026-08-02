import type { MetadataRoute } from 'next'

// Il gestionale contiene dati personali degli ospiti: nessun motore di
// ricerca deve indicizzarlo.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  }
}
