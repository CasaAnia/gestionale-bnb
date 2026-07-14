'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const mobileNavItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/calendario', label: 'Calendario', icon: '📅' },
  { href: '/arrivi', label: 'Arrivi', icon: '🚪' },
  { href: '/prenotazioni', label: 'Prenot.', icon: '📋' },
  { href: '/nuova', label: 'Nuova', icon: '➕' },
  { href: '/clienti', label: 'Clienti', icon: '👤' },
  { href: '/spese', label: 'Spese', icon: '💶' },
  { href: '/impostazioni', label: 'Impost.', icon: '⚙️' },
]

const desktopNavItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/calendario', label: 'Calendario', icon: '📅' },
  { href: '/arrivi', label: 'Arrivi', icon: '🚪' },
  { href: '/prenotazioni', label: 'Prenotazioni', icon: '📋' },
  { href: '/nuova', label: 'Nuova', icon: '➕' },
  { href: '/clienti', label: 'Clienti', icon: '👤' },
  { href: '/spese', label: 'Spese', icon: '💶' },
  { href: '/statistiche', label: 'Statistiche', icon: '📊' },
  { href: '/impostazioni', label: 'Impostazioni', icon: '⚙️' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <>
      {/* Mobile: barra in basso */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-1">
          {mobileNavItems.map(item => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1 text-xs gap-0.5 transition-colors ${active ? 'text-blue-600' : 'text-gray-500'}`}>
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop: barra laterale a sinistra */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-48 bg-white border-r border-gray-200 z-50 flex-col py-6">
        <div className="px-4 mb-6">
          <p className="font-bold text-gray-800 text-sm">Casa Ania Rozzano</p>
        </div>
        {desktopNavItems.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${active ? 'mx-3 rounded-full bg-[#A8DCF0] text-[#0C447C]' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
