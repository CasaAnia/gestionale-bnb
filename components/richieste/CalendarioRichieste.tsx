'use client'
import { useEffect, useMemo, useRef, type CSSProperties, type MouseEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildChangeGroups, chainClipPath } from '@/lib/roomChanges'
import { ROOM_NUMBER_BY_NAME } from '@/lib/roomTypes'
import { nomeOspite } from '@/lib/guestName'
import { ordinaCamere } from '@/lib/disponibilita'
import {
  COLORE_OGGI, COLORE_DOMENICA, COLORE_GRIGLIA, COLORE_SEPARATORE, COLORE_RICHIESTA_TESTO,
  contestoColori, segmentiBarra, indiciIntervallo, type PrenotazioneBarra,
} from '@/lib/calendarioBarre'
import { giorniDelMese, etichettaMese, spostaMese, chiaveRiga, RIGA_QUALSIASI, gruppiSovrapposti, unioneIntervalli, sovrapposizioni, giorniDaInizio, spostaGiorni, etichettaPeriodo, GIORNI_QUINDICINA } from '@/lib/richiesteCalendario'
import { nomeCompleto, nomeBreve, formatIntervallo, riassuntoPersone, scadenzaProposta, STATO_LABEL, type Richiesta } from '@/lib/richieste'
import type { Vista } from '@/lib/richiesteVista'

export type CameraCalendario = { id: string; name: string; active?: boolean }
export type Ancora = { x: number; y: number }

// Modo del calendario desktop (blocco 2, 04/09/2026): «mese» oppure «2
// settimane» (colonne larghe, etichette intere). Sul telefono resta il mese.
export type ModoCalendario = 'mese' | 'quindici'

type Props = {
  mese: string
  onMese: (m: string) => void
  modo?: ModoCalendario                 // default 'mese'
  onModo?: (m: ModoCalendario) => void
  inizio?: string                       // primo giorno della finestra a 2 settimane (YYYY-MM-DD)
  onInizio?: (iso: string) => void
  camere: CameraCalendario[]
  compatto?: boolean                    // telefono in orizzontale: colonne più strette, 14 giorni senza scorrere
  adesso?: Date                        // per il timer della proposta nel tooltip (default: ora)
  prenotazioni: PrenotazioneBarra[]     // solo confermate/completate
  richieste: Richiesta[]                // aperte nel mese; vuoto in vista Reale
  acconti: Record<string, number>
  vista: Vista
  layout: 'desktop' | 'mobile'
  oggi: string                          // YYYY-MM-DD
  evidenziata?: string | null           // id richiesta selezionata dalla lista
  onApri?: (gruppo: Richiesta[], ancora: Ancora) => void
}

const OTTONE = '#A9884E'
// Desktop: camere in righe, giorni in colonne
const NAME_W = 84   // solo il nome della camera, senza numero
const COL_MIN_QUINDICI = 72   // a 2 settimane ogni giorno ha almeno 72 px: «Nome C.» intero anche su una notte; se non ci sta, scorre
// Telefono (05/09/2026, richiesta di Ania): stessa griglia del Mac — camere in
// righe, giorni in colonne — che scorre di lato dentro il riquadro. Colonna
// camere più stretta e colonne minime più piccole; la variante «giorni in
// righe» di prima resta nel file, non più usata.
const NAME_W_TELEFONO = 66
// Larghezza della colonna delle camere: larga solo sul Mac vero; sul telefono,
// dritto o girato (compatto), quella stretta, uguale in Calendario/Arrivi/Richieste
// (richiesta di Ania, 05/09/2026). Esportata per allineare la riga «Oggi · mesi».
export function larghezzaColonnaCamere(layout: 'desktop' | 'mobile', compatto?: boolean): number {
  return layout === 'desktop' && !compatto ? NAME_W : NAME_W_TELEFONO
}   // solo il nome («Allegra» a 12 px), senza numero: è la colonna meno utile
const COL_MIN_QUINDICI_TELEFONO = 60
const COL_MIN_MESE_TELEFONO = 40
const ROW_H = 44
const HEADER_H = 40
// Mobile: giorni in righe, camere in colonne strette (deve stare in 390 px)
const DAY_W = 44
const DAY_H = 26
const HEADER_H_MOBILE = 34
const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

function giornoSettimana(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDay()
}

// Taglio a incastro per le barre verticali (mobile): il soggiorno arriva da
// un'altra camera (taglio in alto) o prosegue altrove (taglio in basso).
function clipVerticale(tagliaSopra: boolean, tagliaSotto: boolean): string {
  if (tagliaSopra && tagliaSotto) return 'polygon(0 0, 100% 8px, 100% 100%, 0 calc(100% - 8px))'
  if (tagliaSopra) return 'polygon(0 0, 100% 8px, 100% 100%, 0 100%)'
  if (tagliaSotto) return 'polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - 8px))'
  return 'none'
}

// Etichetta della barra: «Anna R.» (nomeBreve), con lo stato se c'è spazio
export function etichettaRichiesta(r: Richiesta, breve = false): string {
  const chi = nomeBreve(r)
  return breve ? chi : `${chi} · ${r.stato === 'proposta_inviata' ? 'inviata' : 'attesa'}`
}
// Tooltip al passaggio del mouse (desktop): nome completo, date, persone, stato;
// con la proposta inviata al posto dello stato c'è il timer delle 3 ore
// («Proposta inviata · scade tra 2 h 15 min» / «… scaduta 20 min fa»).
export function tooltipRichiesta(r: Richiesta, adesso: Date = new Date()): string {
  const persone = r.persone_per_notte ? riassuntoPersone(r.arrivo, r.persone_per_notte) : `${r.persone} ${r.persone === 1 ? 'persona' : 'persone'}`
  const stato = scadenzaProposta(r, adesso)?.testo ?? STATO_LABEL[r.stato]
  return `${nomeCompleto(r)} · ${formatIntervallo(r.arrivo, r.partenza)} · ${persone} · ${r.rooms?.name || 'qualsiasi camera'} · ${stato}`
}

type Riga = { chiave: string; nome: string; numero: string; camera: CameraCalendario | null }

export default function CalendarioRichieste(p: Props) {
  const orizzontale = true   // false = torna la vecchia griglia verticale sul telefono
  const modo: ModoCalendario = p.modo === 'quindici' && p.inizio ? 'quindici' : 'mese'
  const nameW = larghezzaColonnaCamere(p.layout, p.compatto)
  const giorni = useMemo(() => (modo === 'quindici' ? giorniDaInizio(p.inizio!, GIORNI_QUINDICINA) : giorniDelMese(p.mese)), [modo, p.inizio, p.mese])
  const camere = useMemo(() => ordinaCamere(p.camere.filter(c => c.active !== false)), [p.camere])
  const ctx = useMemo(() => contestoColori(p.prenotazioni, p.acconti), [p.prenotazioni, p.acconti])
  const catene = useMemo(() => buildChangeGroups(p.prenotazioni), [p.prenotazioni])
  const { inEntrata, inUscita } = useMemo(() => {
    const inEntrata = new Set<string>(), inUscita = new Set<string>()
    catene.edges.forEach(e => { inUscita.add(e.fromId); inEntrata.add(e.toId) })
    return { inEntrata, inUscita }
  }, [catene])

  // Richieste per riga (camera o «qualsiasi»)
  const richiestePerRiga = useMemo(() => {
    const m = new Map<string, Richiesta[]>()
    for (const r of p.richieste) { const k = chiaveRiga(r.camera_id); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r) }
    return m
  }, [p.richieste])
  const rigaQualsiasi = p.vista === 'presunta' && (richiestePerRiga.get(RIGA_QUALSIASI)?.length ?? 0) > 0
  const righe: Riga[] = [
    ...camere.map(c => ({ chiave: c.id, nome: c.name, numero: ROOM_NUMBER_BY_NAME[c.name] || '', camera: c })),
    ...(rigaQualsiasi ? [{ chiave: RIGA_QUALSIASI, nome: 'Qualsiasi camera', numero: '', camera: null }] : []),
  ]

  const N = giorni.length
  // A 2 settimane il calendario può essere più largo dello spazio: scorre in
  // orizzontale e all'apertura porta in vista la colonna di oggi
  const scorrevole = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scorrevole.current
    if (!el || modo !== 'quindici') return
    const i = giorni.indexOf(p.oggi)
    if (i < 0) { el.scrollLeft = 0; return }
    const larghezzaGiorno = (el.scrollWidth - nameW) / N
    const centro = nameW + larghezzaGiorno * (i + 0.5)
    el.scrollLeft = Math.max(0, centro - el.clientWidth / 2)
  }, [modo, giorni, p.oggi, N, nameW])
  function apri(e: MouseEvent, gruppo: Richiesta[]) {
    e.stopPropagation()
    p.onApri?.(gruppo, { x: e.clientX, y: e.clientY })
  }

  // Geometria di una barra da `start` a `end` (indici dei giorni) nella riga/colonna `ri`
  function geometria(start: number, end: number, ri: number, primo: boolean, ultimo: boolean): CSSProperties {
    if (orizzontale) {
      return {
        position: 'absolute', top: 6, height: ROW_H - 12,
        left: `calc(${nameW}px + (100% - ${nameW}px) * ${start / N} + ${primo ? 2 : 0}px)`,
        width: `calc((100% - ${nameW}px) * ${(end - start) / N} - ${(primo ? 2 : 0) + (ultimo ? 2 : 0)}px)`,
      }
    }
    const cols = righe.length
    return {
      position: 'absolute',
      left: `calc(${DAY_W}px + (100% - ${DAY_W}px) * ${ri / cols} + 2px)`,
      width: `calc((100% - ${DAY_W}px) / ${cols} - 4px)`,
      top: start * DAY_H + (primo ? 2 : 0),
      height: (end - start) * DAY_H - (primo ? 2 : 0) - (ultimo ? 2 : 0),
    }
  }

  function barrePrenotazioni(camera: CameraCalendario, ri: number) {
    return p.prenotazioni.filter(b => b.room_id === camera.id).flatMap(b => {
      const segmenti = segmentiBarra(b, giorni, ctx)
      if (segmenti.length === 0) return []
      const entra = inEntrata.has(b.id), esce = inUscita.has(b.id)
      return segmenti.map((s, i) => {
        const primo = i === 0, ultimo = i === segmenti.length - 1
        const tagliaInizio = primo && entra, tagliaFine = ultimo && esce
        const arrInizio = primo && !tagliaInizio, arrFine = ultimo && !tagliaFine
        const raggi = orizzontale
          ? `${arrInizio ? 6 : 0}px ${arrFine ? 6 : 0}px ${arrFine ? 6 : 0}px ${arrInizio ? 6 : 0}px`
          : `${arrInizio ? 6 : 0}px ${arrInizio ? 6 : 0}px ${arrFine ? 6 : 0}px ${arrFine ? 6 : 0}px`
        return (
          <div key={`${b.id}-${i}`} title={`${nomeOspite(b)} · ${formatIntervallo(b.check_in, b.check_out)} · ${b.num_guests ?? ''} ${Number(b.num_guests) === 1 ? 'persona' : 'persone'}`.replace(' ·  ', ' · ')}
            style={{
              ...geometria(s.start, s.end, ri, primo, ultimo),
              background: s.color, borderRadius: raggi,
              clipPath: orizzontale ? chainClipPath(tagliaInizio, tagliaFine) : clipVerticale(tagliaInizio, tagliaFine),
              overflow: 'hidden', display: 'flex', alignItems: orizzontale ? 'center' : 'flex-start',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)', zIndex: 5,
              opacity: p.evidenziata != null ? 0.3 : 1, transition: 'opacity 0.15s',
            }}>
            {primo && (
              <span style={{ color: 'white', fontSize: p.layout === 'desktop' ? (modo === 'quindici' ? 12 : 11) : 10, fontWeight: 600, padding: p.layout === 'desktop' ? '0 6px' : '3px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {entra ? '⇄ ' : ''}{nomeOspite(b)}{esce ? ' ⇄' : ''}
              </span>
            )}
          </div>
        )
      })
    })
  }

  // Badge ⇄ ottone: richieste sovrapposte fra loro, o singola che si
  // sovrappone a una confermata (se confermata, va in conflitto).
  const badge = (
    <span aria-label="si sovrappone" style={{ flexShrink: 0, background: OTTONE, color: '#F5EFE4', borderRadius: 999, fontSize: 9, fontWeight: 700, lineHeight: '14px', height: 14, minWidth: 16, padding: '0 4px', textAlign: 'center' }}>⇄</span>
  )

  function barreRichieste(chiave: string, ri: number) {
    const lista = richiestePerRiga.get(chiave) || []
    return gruppiSovrapposti(lista).flatMap(gruppo => {
      const unione = gruppo.length > 1 ? unioneIntervalli(gruppo) : gruppo[0]
      const idx = indiciIntervallo(unione.arrivo, unione.partenza, giorni)
      if (!idx) return []
      const ids = gruppo.map(r => r.id)
      const selezionata = p.evidenziata != null && ids.includes(p.evidenziata)
      const conflittoConfermate = gruppo.length === 1 && sovrapposizioni(gruppo[0], p.prenotazioni, [], camere).prenotazioni.length > 0
      const conBadge = gruppo.length > 1 || conflittoConfermate
      // a 2 settimane le colonne sono larghe: «Nome C.» intero; nel mese
      // l'etichetta resta e il tooltip dice tutto
      const testo = gruppo.length > 1 ? `${gruppo.length} richieste` : etichettaRichiesta(gruppo[0], p.layout === 'mobile' || modo === 'quindici')
      const titolo = gruppo.map(r => tooltipRichiesta(r, p.adesso)).join('\n')
      const mobile = p.layout === 'mobile'
      return [(
        <button key={ids.join('+')} type="button" onClick={e => apri(e, gruppo)} title={titolo}
          style={{
            ...geometria(idx.start, idx.end, ri, true, true),
            background: 'transparent', border: `1.5px dashed ${OTTONE}`, borderRadius: 6,
            color: COLORE_RICHIESTA_TESTO, fontSize: mobile ? 10 : 11, fontWeight: 600, textAlign: 'left',
            padding: mobile ? '2px 3px' : modo === 'quindici' ? '0 4px' : '0 6px', display: 'flex', gap: 4,
            flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'flex-start' : 'center',
            whiteSpace: 'nowrap', overflow: 'hidden', cursor: 'pointer', zIndex: selezionata ? 8 : 7,
            opacity: p.evidenziata != null && !selezionata ? 0.3 : 1,
            boxShadow: selezionata ? '0 3px 10px rgba(31,61,47,0.45)' : 'none',
            transition: 'opacity 0.15s, box-shadow 0.15s',
          }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', flex: mobile ? undefined : 1 }}>{testo}</span>
          {conBadge && badge}
        </button>
      )]
    })
  }

  const indietro = () => (modo === 'quindici' ? p.onInizio?.(spostaGiorni(p.inizio!, -GIORNI_QUINDICINA)) : p.onMese(spostaMese(p.mese, -1)))
  const avanti = () => (modo === 'quindici' ? p.onInizio?.(spostaGiorni(p.inizio!, GIORNI_QUINDICINA)) : p.onMese(spostaMese(p.mese, 1)))
  const navigazione = (
    <div className="flex items-center justify-between px-2 py-2 border-b" style={{ borderColor: COLORE_SEPARATORE }}>
      <button type="button" onClick={indietro} aria-label={modo === 'quindici' ? 'Due settimane prima' : 'Mese precedente'}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-green-mid active:bg-sage transition-colors">
        <ChevronLeft size={20} strokeWidth={2} aria-hidden />
      </button>
      <span className={`font-serif text-green-dark whitespace-nowrap ${p.layout === 'mobile' ? 'text-[14px]' : 'text-[17px]'}`}>{modo === 'quindici' ? etichettaPeriodo(giorni) : etichettaMese(p.mese)}</span>
      <div className="flex items-center gap-1">
        {p.onModo && (
          <div role="group" aria-label="Vista del calendario" className="inline-flex rounded-full border bg-white p-0.5 mr-1" style={{ borderColor: '#C9BFA8' }}>
            {([['mese', 'Mese'], ['quindici', '2 settimane']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => p.onModo!(v)} aria-pressed={modo === v}
                className={`rounded-full whitespace-nowrap font-semibold transition-colors ${p.layout === 'mobile' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1 text-xs'} ${modo === v ? 'bg-green-mid text-cream-text' : 'text-green-dark'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={avanti} aria-label={modo === 'quindici' ? 'Due settimane dopo' : 'Mese successivo'}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-green-mid active:bg-sage transition-colors">
          <ChevronRight size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  )

  // ── Camere in righe, giorni in colonne (Mac e, dal 05/09/2026, anche telefono) ──
  if (orizzontale) {
    const mobile = p.layout === 'mobile'
    // compatto (telefono in orizzontale): niente larghezza minima, i 14 giorni riempiono lo schermo
    // Telefono girato a mese (scelta di Ania, 05/09/2026): tutti i 31 giorni
    // nella larghezza, come in Calendario e Arrivi (nessun minimo per colonna)
    const colMin = mobile
      ? (modo === 'quindici' ? (p.compatto ? 52 : COL_MIN_QUINDICI_TELEFONO) : (p.compatto ? 0 : COL_MIN_MESE_TELEFONO))
      : (modo === 'quindici' && !p.compatto ? COL_MIN_QUINDICI : 0)
    return (
      <div className="bg-white rounded-xl border border-card-border shadow-sm overflow-hidden">
        {navigazione}
        <div ref={scorrevole} className={mobile ? 'no-scrollbar' : undefined} style={{ overflowX: colMin > 0 ? 'auto' : 'hidden', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: colMin > 0 ? nameW + N * colMin : undefined }}>
        <div style={{ display: 'grid', gridTemplateColumns: `${nameW}px repeat(${N}, minmax(0, 1fr))`, height: HEADER_H, borderBottom: `2px solid ${COLORE_SEPARATORE}` }}>
          {/* angolo e colonna dei nomi restano fermi a sinistra quando la griglia scorre di lato */}
          <div style={{ borderRight: `2px solid ${COLORE_SEPARATORE}`, position: 'sticky', left: 0, zIndex: 12, background: 'white' }} />
          {giorni.map(g => {
            const oggi = g === p.oggi, dom = giornoSettimana(g) === 0
            return (
              <div key={g} style={{ background: oggi ? COLORE_OGGI : 'transparent', borderLeft: `1px solid ${COLORE_GRIGLIA}`, textAlign: 'center', paddingTop: 4, minWidth: 0 }}>
                <div style={{ fontSize: modo === 'quindici' ? 10 : 8, fontWeight: 600, color: dom ? '#C58A67' : '#5c6b60', lineHeight: 1 }}>{modo === 'quindici' ? GIORNI_BREVI[giornoSettimana(g)] : GIORNI_BREVI[giornoSettimana(g)].slice(0, 2)}</div>
                <div style={{
                  fontSize: 12, fontWeight: 700, margin: '2px auto 0', width: 20, height: 20, lineHeight: '20px', borderRadius: '50%',
                  color: oggi ? 'white' : dom ? '#C58A67' : '#1F3D2F', background: oggi ? '#2D6A4F' : 'transparent',
                }}>{Number(g.slice(8))}</div>
              </div>
            )
          })}
        </div>
        {righe.map((riga, ri) => (
          <div key={riga.chiave} style={{ position: 'relative', height: ROW_H, borderBottom: ri === righe.length - 1 ? `2px solid ${COLORE_SEPARATORE}` : `1px solid ${COLORE_GRIGLIA}`, borderTop: riga.chiave === RIGA_QUALSIASI ? `2px solid ${COLORE_SEPARATORE}` : undefined }}>
            <div style={{ display: 'grid', gridTemplateColumns: `${nameW}px repeat(${N}, minmax(0, 1fr))`, height: '100%' }}>
              <div style={{ borderRight: `2px solid ${COLORE_SEPARATORE}`, display: 'flex', alignItems: 'center', gap: 5, padding: '0 6px', minWidth: 0, background: 'white', position: 'sticky', left: 0, zIndex: 10 }}>
                {/* niente numero 01–04: solo il nome della camera, ovunque (05/09/2026) */}
                <span className={riga.camera ? 'font-serif' : ''} style={{ fontSize: riga.camera ? (p.layout === 'mobile' ? 12 : 13) : 10, fontWeight: 600, color: riga.camera ? '#1F3D2F' : COLORE_RICHIESTA_TESTO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>
                  {riga.nome}
                </span>
              </div>
              {giorni.map(g => {
                const oggi = g === p.oggi, dom = giornoSettimana(g) === 0
                return <div key={g} style={{ background: oggi ? COLORE_OGGI : dom ? COLORE_DOMENICA : ri % 2 === 0 ? 'white' : COLORE_DOMENICA, borderLeft: `1px solid ${COLORE_GRIGLIA}` }} />
              })}
            </div>
            {riga.camera && barrePrenotazioni(riga.camera, ri)}
            {p.vista === 'presunta' && barreRichieste(riga.chiave, ri)}
          </div>
        ))}
        </div>
        </div>
      </div>
    )
  }

  // ── Variante di prima sul telefono: giorni in righe, camere in colonne (non più usata dal 05/09/2026) ──
  const cols = righe.length
  const colonne = `${DAY_W}px repeat(${cols}, minmax(0, 1fr))`
  return (
    <div className="bg-white rounded-xl border border-card-border overflow-hidden">
      {navigazione}
      <div style={{ display: 'grid', gridTemplateColumns: colonne, height: HEADER_H_MOBILE, borderBottom: `2px solid ${COLORE_SEPARATORE}` }}>
        <div style={{ borderRight: `2px solid ${COLORE_SEPARATORE}` }} />
        {righe.map(riga => (
          <div key={riga.chiave} style={{ borderLeft: `1px solid ${COLORE_GRIGLIA}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, padding: '0 2px' }}>
            {riga.numero && <span className="font-serif" style={{ fontSize: 8, color: OTTONE, lineHeight: 1 }}>{riga.numero}</span>}
            <span className={riga.camera ? 'font-serif' : ''} style={{ fontSize: riga.camera ? 12 : 9, fontWeight: 600, color: riga.camera ? '#1F3D2F' : COLORE_RICHIESTA_TESTO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: 1.2 }}>
              {riga.camera ? riga.nome : 'Qualsiasi'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', height: N * DAY_H }}>
        {giorni.map((g, gi) => {
          const oggi = g === p.oggi, dom = giornoSettimana(g) === 0
          return (
            <div key={g} style={{ display: 'grid', gridTemplateColumns: colonne, height: DAY_H, borderBottom: `1px solid ${COLORE_GRIGLIA}`, background: oggi ? COLORE_OGGI : dom ? COLORE_DOMENICA : gi % 2 === 0 ? 'white' : 'transparent' }}>
              <div style={{ borderRight: `2px solid ${COLORE_SEPARATORE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, background: oggi ? COLORE_OGGI : 'white' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: dom ? '#C58A67' : '#5c6b60' }}>{GIORNI_BREVI[giornoSettimana(g)]}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, width: 18, height: 18, lineHeight: '18px', textAlign: 'center', borderRadius: '50%',
                  color: oggi ? 'white' : dom ? '#C58A67' : '#1F3D2F', background: oggi ? '#2D6A4F' : 'transparent',
                }}>{Number(g.slice(8))}</span>
              </div>
              {righe.map(riga => <div key={riga.chiave} style={{ borderLeft: `1px solid ${COLORE_GRIGLIA}` }} />)}
            </div>
          )
        })}
        {righe.map((riga, ri) => (
          <div key={riga.chiave}>
            {riga.camera && barrePrenotazioni(riga.camera, ri)}
            {p.vista === 'presunta' && barreRichieste(riga.chiave, ri)}
          </div>
        ))}
      </div>
    </div>
  )
}
