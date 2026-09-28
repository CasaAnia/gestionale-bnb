'use client'
import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import FoglioMaison from './maison/FoglioMaison'
import { House, CalendarDays, Inbox, DoorOpen, Sparkles, ClipboardList, Plus, Users, Banknote, Wallet, ChartColumn, Settings } from 'lucide-react'
import { useDemoMode } from '@/lib/useDemoMode'
import { isHiddenPath } from '@/lib/demoMode'
import { useRichiesteWeb } from '@/lib/webRequests'
import { useRichiesteAperte } from '@/lib/richiesteDati'
import { COLOR_PRENOTAZIONE } from '@/lib/calendarioMobile'

// Barra in basso «Maison» (riferimento approvato da Ania il 28/09/2026):
// cinque voci con icone a filo sottile ed etichette maiuscolette 8,5 px.
// Pulizie, Prenotazioni, Clienti, Spese, Statistiche e Impostazioni stanno
// nel foglio «Menu». Le icone sono quelle del riferimento, tali e quali.
const ICONE_BARRA = {
  oggi: <svg viewBox="0 0 24 24" aria-hidden><path d="M3 11l9-8 9 8v10H3z" /></svg>,
  calendario: <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="5" width="18" height="16" rx="1" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  richieste: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 5h16v11H9l-5 4z" /></svg>,
  arrivi: <svg viewBox="0 0 24 24" aria-hidden><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3M15 12v2" /></svg>,
  menu: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
}
export const VOCI_BARRA = [
  { href: '/', label: 'Oggi', icona: 'oggi' },
  { href: '/calendario', label: 'Calendario', icona: 'calendario' },
  { href: '/richieste', label: 'Richieste', icona: 'richieste' },
  { href: '/arrivi', label: 'Arrivi', icona: 'arrivi' },
] as const
export const VOCI_MENU = [
  { href: '/prenotazioni', label: 'Prenotazioni' },
  { href: '/clienti', label: 'Clienti' },
  { href: '/pulizie', label: 'Pulizie' },
  { href: '/spese', label: 'Spese B&B' },
  { href: '/spese-famiglia', label: 'Spese Famiglia' },
  { href: '/statistiche', label: 'Statistiche' },
  { href: '/impostazioni', label: 'Impostazioni e notifiche' },
] as const

const desktopNavGroups = [
  {
    label: null as string | null,
    items: [{ href: '/', label: 'Home', Icon: House }],
  },
  {
    label: 'Ogni giorno',
    items: [
      { href: '/calendario', label: 'Calendario', Icon: CalendarDays },
      { href: '/richieste', label: 'Richieste', Icon: Inbox },
      { href: '/arrivi', label: 'Arrivi', Icon: DoorOpen },
      { href: '/pulizie', label: 'Pulizie', Icon: Sparkles },
    ],
  },
  {
    label: null as string | null,
    items: [
      { href: '/prenotazioni', label: 'Prenotazioni', Icon: ClipboardList },
      { href: '/nuova-prenotazione', label: 'Nuova', Icon: Plus },
      { href: '/clienti', label: 'Clienti', Icon: Users },
      { href: '/spese', label: 'Spese B&B', Icon: Banknote },
      { href: '/spese-famiglia', label: 'Spese Famiglia', Icon: Wallet },
      { href: '/statistiche', label: 'Statistiche', Icon: ChartColumn },
      { href: '/impostazioni', label: 'Impostazioni', Icon: Settings },
    ],
  },
]

// Bollino rosso mattone con il numero di richieste dal sito da confermare.
// Con «!» la lettura è fallita: un errore non deve mai sembrare «nessuna richiesta».
// Blu (lo stesso blu delle prenotazioni nel Calendario) per le richieste già
// gestite in attesa di risposta (Ania, 07/09/2026): sotto il rosso, nessuna urgenza.
const COLORE_BOLLINO = { rosso: '#C0563B', blu: COLOR_PRENOTAZIONE } as const
function RequestBadge({ count, className, colore = 'rosso' }: { count: number | '!'; className?: string; colore?: keyof typeof COLORE_BOLLINO }) {
  if (count === 0) return null
  return (
    <span data-bollino={colore} className={`chip-in min-w-[17px] h-[17px] px-1 rounded-full text-white text-[10.5px] font-bold leading-none inline-flex items-center justify-center ${className || ''}`} style={{ background: COLORE_BOLLINO[colore] }}>
      {count}
    </span>
  )
}

export default function BottomNav() {
  const pathname = usePathname()
  const [menuAperto, setMenuAperto] = useState(false)
  const demo = useDemoMode()
  // La chiave cambia a ogni navigazione: il conteggio si riaggiorna anche
  // quando Ania conferma una richiesta e torna indietro.
  const richiesteWeb = useRichiesteWeb(pathname)
  const webCount: number | '!' = richiesteWeb.stato === 'errore' ? '!' : richiesteWeb.richieste.length
  // Richieste di prenotazione (tabella richieste), Ania 07/09/2026: rosso col numero
  // SOLO delle nuove da gestire (in attesa); blu, sotto, quelle con proposta inviata
  // ancora in attesa di risposta; le scadute non hanno bollino (restano nella pagina).
  // Parte 3 (05/09/2026): stesso bollino «!» del Calendario quando la lettura fallisce
  const richiesteAperte = useRichiesteAperte(pathname)
  const richiesteCount: number | '!' = richiesteAperte.stato === 'errore' ? '!' : richiesteAperte.bollini.nuove
  const inAttesaRisposta = richiesteAperte.stato === 'errore' ? 0 : richiesteAperte.bollini.inAttesaRisposta
  if (pathname === '/login') return null
  const visible = (href: string) => !(demo && isHiddenPath(href))
  return (
    <>
      {/* Mobile: barra «Maison» (28/09/2026) */}
      <nav className="barra-bassa lg:hidden fixed bottom-0 left-0 right-0 z-50" aria-label="Navigazione"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', background: '#F6F2EA', borderTop: '1px solid #E1D9CB' }}>
        <div className="mz-nav">
          {VOCI_BARRA.map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} className={active ? 'on' : ''} aria-current={active ? 'page' : undefined}>
                {ICONE_BARRA[item.icona]}{item.label}
                {/* Richieste: il puntino d'ottone quando c'è qualcosa da guardare (o la lettura è fallita) */}
                {item.href === '/richieste' && (webCount !== 0 || richiesteCount !== 0) && <span className="punto" data-bollino="ottone" aria-label="Richieste da gestire" />}
              </Link>
            )
          })}
          <button type="button" className={menuAperto || VOCI_MENU.some(v => pathname.startsWith(v.href)) ? 'on' : ''} onClick={() => setMenuAperto(true)} aria-expanded={menuAperto} data-menu-barra>
            {ICONE_BARRA.menu}Menu
          </button>
        </div>
      </nav>
      {menuAperto && (
        <FoglioMaison titolo="Menu" altezza={420} onChiudi={() => setMenuAperto(false)} dati="menu">
          <div className="mz-vai" style={{ marginTop: 8 }} onClick={() => setMenuAperto(false)}>
            {VOCI_MENU.filter(v => visible(v.href)).map(v => (
              <Link key={v.href} href={v.href}><span>{v.label}</span><span aria-hidden>→</span></Link>
            ))}
          </div>
        </FoglioMaison>
      )}

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
              {group.items.filter(item => visible(item.href)).map(item => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                // «Nuova» apre l'inserimento nuovo (16/09/2026): dopo il
                // salvataggio si apre la scheda, quindi niente returnTo.
                const href = item.href
                return (
                  <Link key={item.href} href={href}
                    className={`flex items-center gap-3 pl-4 pr-4 py-2.5 font-serif text-[15px] border-l-2 transition-colors duration-200 ${active ? 'border-[#A9884E] text-green-dark' : 'border-transparent text-[#8a9488] hover:text-green-dark'}`}>
                    <item.Icon size={16} strokeWidth={1.5} className="shrink-0 text-green-mid" aria-hidden />
                    <span>{item.label}</span>
                    {item.href === '/calendario' && <RequestBadge count={webCount} />}
                    {item.href === '/richieste' && <RequestBadge count={richiesteCount} />}
                    {item.href === '/richieste' && <RequestBadge count={inAttesaRisposta} colore="blu" />}
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
