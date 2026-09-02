'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Globe, Phone, MessageCircle, ChevronDown } from 'lucide-react'
import BackBar from '@/components/BackBar'
import InterruttoreVista from '@/components/richieste/InterruttoreVista'
import CalendarioRichieste from '@/components/richieste/CalendarioRichieste'
import { supabase } from '@/lib/supabase'
import { fetchRichieste } from '@/lib/richiesteDati'
import { useVista, useDesktop } from '@/lib/richiesteVista'
import { meseCorrente, richiesteAperte } from '@/lib/richiesteCalendario'
import type { PrenotazioneBarra } from '@/lib/calendarioBarre'
import type { Room } from '@/lib/types'
import {
  CANALE_LABEL, STATO_LABEL, eAperta, inArchivio, ordinaRichieste, nottiRichiesta, nomeCompleto,
  formatIntervallo, oraArrivo, tempoTrascorso, type Richiesta, type OrdineRichieste,
} from '@/lib/richieste'

const FRAUNCES = { fontFamily: 'var(--font-fraunces), Georgia, serif' }
const ORDINI: { chiave: OrdineRichieste; label: string }[] = [
  { chiave: 'durata', label: 'durata' },
  { chiave: 'arrivo', label: 'arrivo' },
  { chiave: 'persone', label: 'persone' },
]
const GRIGIO_NOTA = '#6b6b60'

// Pulsante pieno verde con testo crema: unico stile dell'azione principale.
const BOTTONE_PIENO = 'inline-flex items-center justify-center bg-green-mid text-cream-text rounded-xl px-5 py-3 font-semibold text-[15px] active:opacity-80 transition-opacity'

const oggiIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function IconaCanale({ canale }: { canale: Richiesta['canale'] }) {
  const props = { size: 13, strokeWidth: 1.8, 'aria-hidden': true as const, className: 'shrink-0' }
  if (canale === 'web') return <Globe {...props} />
  if (canale === 'whatsapp') return <MessageCircle {...props} />
  return <Phone {...props} />
}

function RigaRichiesta({ r, adesso }: { r: Richiesta; adesso: Date }) {
  const n = nottiRichiesta(r)
  return (
    <li className="bg-white rounded-xl border border-card-border shadow-sm p-4 leading-snug">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-[15px] text-green-dark truncate">{nomeCompleto(r)}</p>
        <p className="shrink-0 text-sm font-semibold text-brass">{n === 1 ? '1 notte' : `${n} notti`}</p>
      </div>
      <p className="text-sm text-green-dark mt-1">
        {formatIntervallo(r.arrivo, r.partenza)}
        <span className="text-stone"> · </span>
        {r.persone} {r.persone === 1 ? 'persona' : 'persone'}
        <span className="text-stone"> · </span>
        {r.rooms?.name || 'qualsiasi camera'}
      </p>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone mt-1.5">
        <span className="inline-flex items-center gap-1"><IconaCanale canale={r.canale} />{CANALE_LABEL[r.canale]}</span>
        <span aria-hidden>·</span>
        <span>{oraArrivo(r.created_at, adesso)}</span>
        {r.stato === 'proposta_inviata' && r.proposta_inviata_at && (
          <>
            <span aria-hidden>·</span>
            <span className="text-green-mid font-semibold">proposta inviata {tempoTrascorso(r.proposta_inviata_at, adesso)}</span>
          </>
        )}
      </p>
    </li>
  )
}

function RigaArchivio({ r, adesso }: { r: Richiesta; adesso: Date }) {
  const colore = r.stato === 'confermata' ? '#6C9A7C' : '#8C3B2E'
  return (
    <li className="flex items-baseline justify-between gap-3 py-2.5 border-b-[0.5px] border-border-soft last:border-b-0 text-sm">
      <div className="min-w-0">
        <p className="text-green-dark truncate">{nomeCompleto(r)}</p>
        <p className="text-xs text-stone">{formatIntervallo(r.arrivo, r.partenza)} · {r.persone} {r.persone === 1 ? 'persona' : 'persone'} · {CANALE_LABEL[r.canale]}</p>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1.5 text-xs text-green-dark">
        <span className="w-2 h-2 rounded-full" style={{ background: colore }} />
        {STATO_LABEL[r.stato]}{r.chiusa_at ? ` · ${oraArrivo(r.chiusa_at, adesso)}` : ''}
      </span>
    </li>
  )
}

export default function Richieste() {
  const [tutte, setTutte] = useState<Richiesta[]>([])
  const [camere, setCamere] = useState<Room[]>([])
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneBarra[]>([])
  const [acconti, setAcconti] = useState<Record<string, number>>({})
  const [ordine, setOrdine] = useState<OrdineRichieste>('durata')
  const [mese, setMese] = useState(() => meseCorrente())
  const [loading, setLoading] = useState(true)
  const [errori, setErrori] = useState<string[]>([])
  const [adesso] = useState(() => new Date())
  const [vista, setVista] = useVista()
  const desktop = useDesktop()
  // Sul telefono si vede una sezione alla volta: calendario o lista.
  const [sezione, setSezione] = useState<'calendario' | 'lista'>('calendario')
  const mostraCalendario = desktop || sezione === 'calendario'
  const mostraLista = desktop || sezione === 'lista'

  useEffect(() => {
    // Stesse letture del calendario principale (camere attive, prenotazioni
    // con ospite, acconti) più le richieste. Ogni errore finisce a schermo.
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(id, full_name, phone, rating)').in('status', ['confermata', 'completata']),
      supabase.from('payments').select('booking_id, amount'),
      fetchRichieste(),
    ]).then(([r, b, pay, ric]) => {
      const errs: string[] = []
      if (r.error) errs.push(`camere: ${r.error.message}`)
      if (b.error) errs.push(`prenotazioni: ${b.error.message}`)
      if (pay.error) errs.push(`acconti: ${pay.error.message}`)
      if (ric.error) errs.push(`richieste: ${ric.error}`)
      setCamere((r.data || []) as Room[])
      setPrenotazioni((b.data || []) as unknown as PrenotazioneBarra[])
      const sums: Record<string, number> = {}
      for (const x of (pay.data || []) as { booking_id: string; amount: number | string }[]) sums[x.booking_id] = (sums[x.booking_id] || 0) + Number(x.amount)
      setAcconti(sums)
      setTutte(ric.data)
      setErrori(errs)
      setLoading(false)
    })
  }, [])

  const aperte = useMemo(() => ordinaRichieste(tutte.filter(eAperta), ordine), [tutte, ordine])
  const archivio = useMemo(
    () => tutte.filter(r => inArchivio(r, adesso)).sort((a, b) => (b.chiusa_at ?? b.created_at).localeCompare(a.chiusa_at ?? a.created_at)),
    [tutte, adesso],
  )
  // Vista Reale: nessuna richiesta, in nessuna forma.
  const richiesteCalendario = useMemo(
    () => (vista === 'presunta' ? richiesteAperte(tutte, mese) : []),
    [tutte, mese, vista],
  )

  const nuovaRichiesta = (extra = '') => (
    <Link href="/richieste/nuova" className={`${BOTTONE_PIENO} ${extra}`}>+ Nuova richiesta</Link>
  )

  return (
    <div className="p-4">
      <BackBar href="/" />
      <div className="flex items-center justify-between gap-3 mb-3">
        <h1 className="text-[22px] text-green-dark leading-tight" style={FRAUNCES}>Richieste di prenotazione</h1>
        <InterruttoreVista vista={vista} onChange={setVista} />
      </div>
      {!desktop && (
        <>
          {nuovaRichiesta('w-full mb-3')}
          <div className="flex gap-2 mb-4" role="tablist" aria-label="Sezione">
            {([['calendario', 'Calendario'], ['lista', 'Lista']] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={sezione === k} onClick={() => setSezione(k)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${sezione === k ? 'bg-green-mid text-cream-text' : 'bg-white text-stone border border-card-border'}`}>
                {label}
                {k === 'lista' && !loading && aperte.length > 0 && (
                  <span className={`text-xs font-bold ${sezione === k ? 'text-cream-text' : 'text-brass'}`}>{aperte.length}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {errori.length > 0 && (
        <div className="mb-4 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">
          Non riesco a leggere alcuni dati: {errori.join(' · ')}
        </div>
      )}

      <div className="md:grid md:grid-cols-[3fr_2fr] md:gap-5 md:items-start">
        {/* Calendario */}
        <section hidden={!mostraCalendario}>
          {loading ? (
            <div className="bg-white rounded-xl border border-card-border text-center py-10 text-stone">Caricamento…</div>
          ) : (
            <CalendarioRichieste
              mese={mese} onMese={setMese} camere={camere} prenotazioni={prenotazioni} richieste={richiesteCalendario}
              acconti={acconti} vista={vista} layout={desktop ? 'desktop' : 'mobile'} oggi={oggiIso()} />
          )}
          <p className="text-xs mt-2" style={{ color: GRIGIO_NOTA }}>
            {vista === 'presunta' ? 'Tratteggiato = richieste in attesa. Tocca una barra per vedere chi c’è dentro.' : 'Solo confermate: queste non si toccano.'}
          </p>
        </section>

        {/* Lista */}
        <section hidden={!mostraLista} className="md:mt-0">
          {desktop && <div className="mb-3">{nuovaRichiesta('w-full')}</div>}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
            <span className="text-xs text-stone shrink-0">Ordina per</span>
            {ORDINI.map(o => (
              <button key={o.chiave} type="button" onClick={() => setOrdine(o.chiave)} aria-pressed={ordine === o.chiave}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${ordine === o.chiave ? 'bg-green-mid text-cream-text' : 'bg-white text-stone border border-card-border'}`}>
                {o.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-10 text-stone">Caricamento…</div>
          ) : aperte.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center gap-4">
              <p className="text-stone">Nessuna richiesta in attesa</p>
              <Link href="/richieste/nuova" className={BOTTONE_PIENO}>Nuova richiesta</Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {aperte.map(r => <RigaRichiesta key={r.id} r={r} adesso={adesso} />)}
            </ul>
          )}

          {!loading && (
            <details className="group mt-8">
              <summary className="list-none cursor-pointer flex items-center justify-between py-2 text-sm text-stone select-none [&::-webkit-details-marker]:hidden">
                <span>Archivio <span className="text-xs">({archivio.length})</span></span>
                <ChevronDown size={16} strokeWidth={1.8} className="transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              {archivio.length === 0 ? (
                <p className="text-sm text-stone py-2">Nessuna richiesta chiusa negli ultimi 90 giorni.</p>
              ) : (
                <ul className="bg-white rounded-xl border border-card-border px-4 mt-1">
                  {archivio.map(r => <RigaArchivio key={r.id} r={r} adesso={adesso} />)}
                </ul>
              )}
            </details>
          )}
        </section>
      </div>
    </div>
  )
}
