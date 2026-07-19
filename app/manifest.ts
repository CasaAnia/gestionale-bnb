import type { MetadataRoute } from 'next'

// Manifest PWA: con display "standalone" l'app aggiunta alla schermata Home di
// iOS si apre come app (requisito per le notifiche push web su iPhone).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Casa Ania Rozzano',
    short_name: 'Casa Ania',
    description: 'Gestionale B&B',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FBF9F4',
    theme_color: '#FBF9F4',
    icons: [
      { src: '/icon-192.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
