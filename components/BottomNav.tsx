'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/prenotazioni', label: 'Prenot.', icon: '📅' },
  { href: '/nuova', label: 'Nuova', icon: '➕' },
  { href: '/clienti', label: 'Clienti', icon: '👤' },
  { href: '/spese', label: 'Spese', icon: '💶' },
  { href: '/statistiche', label: 'Stats', icon: '📊' },
  { href: '/impostazioni', label: 'Impost.', icon: '⚙️' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-1">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-xs gap-0.5 transition-colors ${
                active ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
