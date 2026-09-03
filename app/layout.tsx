import type { Metadata, Viewport } from 'next'
import { Fraunces, Manrope, Nunito_Sans } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import MobileTopBar from '@/components/MobileTopBar'
import MainContainer from '@/components/MainContainer'
import ScrollToTop from '@/components/ScrollToTop'
import NavTracker from '@/components/NavTracker'
import WebRequestAlert from '@/components/WebRequestAlert'
import RinnovoNotifiche from '@/components/RinnovoNotifiche'
import AvvisoConnessione from '@/components/AvvisoConnessione'

const nunitoSans = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito-sans', display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', weight: ['400', '600'], style: ['normal', 'italic'], display: 'swap' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['400', '500', '600', '700'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Casa Ania Rozzano',
  description: 'Gestionale B&B',
  // Il gestionale non deve finire su Google: contiene dati degli ospiti.
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: '/apple-touch-icon.png',
    apple: '/apple-touch-icon.png',
  },
  // Apertura come app (senza barra Safari) dalla schermata Home di iOS
  appleWebApp: {
    capable: true,
    title: 'Casa Ania',
    statusBarStyle: 'default',
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
    <html lang="it" className={`${nunitoSans.variable} ${fraunces.variable} ${manrope.variable}`}>
      <body className="bg-cream text-green-dark antialiased font-sans">
        <ScrollToTop />
        <NavTracker />
        <MobileTopBar />
        <main className="min-h-screen pt-12 lg:pt-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-48">
          <AvvisoConnessione />
          <MainContainer>{children}</MainContainer>
        </main>
        <BottomNav />
        <WebRequestAlert />
        <RinnovoNotifiche />
      </body>
    </html>
  )
}
