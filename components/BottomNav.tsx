'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, CalendarDays, DoorOpen, Sparkles, ClipboardList, Plus, Users, Banknote, ChartColumn, Settings } from 'lucide-react'

const mobileNavItems = [
  { href: '/calendario', label: 'Calendario', Icon: CalendarDays },
  { href: '/arrivi', label: 'Arrivi', Icon: DoorOpen },
  { href: '/pulizie', label: 'Pulizie', Icon: Sparkles },
  { href: '/statistiche', label: 'Report', Icon: ChartColumn },
]

const desktopNavGroups = [
  {
    label: null as string | null,
    items: [{ href: '/', label: 'Home', Icon: House }],
  },
  {
    label: 'Ogni giorno',
    items: [
      { href: '/calendario', label: 'Calendario', Icon: CalendarDays },
      { href: '/arrivi', label: 'Arrivi', Icon: DoorOpen },
      { href: '/pulizie', label: 'Pulizie', Icon: Sparkles },
    ],
  },
  {
    label: null as string | null,
    items: [
      { href: '/prenotazioni', label: 'Prenotazioni', Icon: ClipboardList },
      { href: '/nuova', label: 'Nuova', Icon: Plus },
      { href: '/clienti', label: 'Clienti', Icon: Users },
      { href: '/spese', label: 'Spese', Icon: Banknote },
      { href: '/statistiche', label: 'Statistiche', Icon: ChartColumn },
      { href: '/impostazioni', label: 'Impostazioni', Icon: Settings },
    ],
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <>
      {/* Mobile: bottom navigation crema & ottone */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t-[0.5px] border-[#E9E2D2] z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-stretch h-14 max-w-lg mx-auto">
          {mobileNavItems.map(item => {
            const active = pathname.startsWith(item.href)
            const color = active ? '#A9884E' : '#8a9488'
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center justify-center flex-1 gap-1 transition-colors"
                style={{ color }}>
                <item.Icon size={20} strokeWidth={active ? 2 : 1.6} aria-hidden />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop: barra laterale a sinistra */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-48 bg-sidebar border-r border-border-soft z-50 flex-col py-6">
        <div className="px-4 pt-3 mb-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ border: '1px solid var(--color-brass)' }}>
            <span className="font-serif text-2xl" style={{ color: 'var(--color-brass)' }}>CA</span>
          </div>
          <p className="font-serif text-xl text-green-dark leading-tight">Casa Ania</p>
          <p className="text-[10px] mt-1 uppercase" style={{ color: 'var(--color-brass)', letterSpacing: '2px' }}>
            Rozzano
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          {desktopNavGroups.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-1.5">
              {group.label && (
                <p className="pl-4 mt-3 mb-0.5 text-[9px] uppercase" style={{ color: 'var(--color-brass)', letterSpacing: '2px' }}>
                  {group.label}
                </p>
              )}
              {group.items.map(item => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 pl-4 pr-4 py-2.5 font-serif text-[15px] border-l-2 transition-colors duration-200 ${active ? 'border-[#A9884E] text-green-dark' : 'border-transparent text-[#8a9488] hover:text-green-dark'}`}>
                    <item.Icon size={16} strokeWidth={1.5} className="shrink-0 text-green-mid" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </nav>
    </>
  )
}
