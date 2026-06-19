import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'Casa Ania Rozzano',
  description: 'Gestionale B&B',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <main className="max-w-lg lg:max-w-full mx-auto min-h-screen pb-20 lg:pb-0 lg:ml-48">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
