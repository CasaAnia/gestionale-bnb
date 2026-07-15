import type { Metadata, Viewport } from 'next'
import { Fraunces, Nunito_Sans } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' })
const nunitoSans = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito-sans', display: 'swap' })

export const metadata: Metadata = {
  title: 'Casa Ania Rozzano',
  description: 'Gestionale B&B',
  icons: {
    icon: '/apple-touch-icon.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FBF9F4',
  // Il gestionale è solo chiaro: impedisce alla "modalità scura forzata" dei
  // browser Android di scurire automaticamente sfondi e riquadri
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${fraunces.variable} ${nunitoSans.variable}`}>
      <body className="bg-cream text-green-dark antialiased font-sans">
        <main className="max-w-lg lg:max-w-full mx-auto min-h-screen pb-20 lg:pb-0 lg:ml-48">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
