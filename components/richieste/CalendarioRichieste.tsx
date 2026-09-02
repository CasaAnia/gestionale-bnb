'use client'
import { useMemo, type MouseEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildChangeGroups, chainClipPath } from '@/lib/roomChanges'
import { ROOM_NUMBER_BY_NAME } from '@/lib/roomTypes'
import { nomeOspite } from '@/lib/guestName'
import { ordinaCamere } from '@/lib/disponibilita'
import {
  COLORE_OGGI, COLORE_DOMENICA, COLORE_GRIGLIA, COLORE_SEPARATORE, COLORE_RICHIESTA_TESTO,
  contestoColori, segmentiBarra, indiciIntervallo, type PrenotazioneBarra,
} from '@/lib/calendarioBarre'
import { giorniDelMese, etichettaMese, spostaMese, chiaveRiga, RIGA_QUALSIASI } from '@/lib/richiesteCalendario'
import type { Richiesta } from '@/lib/richieste'
import type { Vista } from '@/lib/richiesteVista'

export type CameraCalendario = { id: string; name: string; active?: boolean }
export type Ancora = { x: number; y: number }

type Props = {
  mese: string
  onMese: (m: string) => void
  camere: CameraCalendario[]
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
const NAME_W = 96
const ROW_H = 44
const HEADER_H = 40
const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

function giornoSettimana(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDay()
}

export function etichettaRichiesta(r: Richiesta): string {
  const iniziale = r.nome.trim() ? `${r.nome.trim()[0]}.` : ''
  return `${r.cognome.trim()} ${iniziale} · ${r.stato === 'proposta_inviata' ? 'inviata' : 'attesa'}`
}

export default function CalendarioRichieste(p: Props) {
  const giorni = useMemo(() => giorniDelMese(p.mese), [p.mese])
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
  const rigaQualsiasi = (richiestePerRiga.get(RIGA_QUALSIASI)?.length ?? 0) > 0
  const righe: { chiave: string; nome: string; numero: string; camera: CameraCalendario | null }[] = [
    ...camere.map(c => ({ chiave: c.id, nome: c.name, numero: ROOM_NUMBER_BY_NAME[c.name] || '', camera: c })),
    ...(rigaQualsiasi ? [{ chiave: RIGA_QUALSIASI, nome: 'Qualsiasi camera', numero: '', camera: null }] : []),
  ]

  const N = giorni.length
  const attenua = (id: string) => p.evidenziata != null && p.evidenziata !== id

  function apri(e: MouseEvent, gruppo: Richiesta[]) {
    e.stopPropagation()
    p.onApri?.(gruppo, { x: e.clientX, y: e.clientY })
  }

  // ── Barre di una riga (desktop: orizzontali) ──────────────────────────────
  function barrePrenotazioni(camera: CameraCalendario) {
    return p.prenotazioni.filter(b => b.room_id === camera.id).flatMap(b => {
      const segmenti = segmentiBarra(b, giorni, ctx)
      if (segmenti.length === 0) return []
      const chainKey = catene.chainKeyOf[b.id]
      const entra = inEntrata.has(b.id), esce = inUscita.has(b.id)
      return segmenti.map((s, i) => {
        const primo = i === 0, ultimo = i === segmenti.length - 1
        const tagliaSx = primo && entra, tagliaDx = ultimo && esce
        const arrSx = primo && !tagliaSx, arrDx = ultimo && !tagliaDx
        return (
          <div key={`${b.id}-${i}`} title={`${nomeOspite(b)} · ${b.check_in} → ${b.check_out}`}
            style={{
              position: 'absolute', top: 6, height: ROW_H - 12,
              left: `calc(${NAME_W}px + (100% - ${NAME_W}px) * ${s.start / N} + ${primo ? 2 : 0}px)`,
              width: `calc((100% - ${NAME_W}px) * ${(s.end - s.start) / N} - ${(primo ? 2 : 0) + (ultimo ? 2 : 0)}px)`,
              background: s.color,
              borderRadius: `${arrSx ? 6 : 0}px ${arrDx ? 6 : 0}px ${arrDx ? 6 : 0}px ${arrSx ? 6 : 0}px`,
              clipPath: chainClipPath(tagliaSx, tagliaDx),
              overflow: 'hidden', display: 'flex', alignItems: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)', zIndex: 5,
              opacity: p.evidenziata != null ? 0.3 : 1, transition: 'opacity 0.15s',
            }}>
            {primo && (
              <span style={{ color: 'white', fontSize: 11, fontWeight: 600, paddingLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {entra ? '⇄ ' : ''}{nomeOspite(b)}{esce ? ' ⇄' : ''}{chainKey ? '' : ''}
              </span>
            )}
          </div>
        )
      })
    })
  }

  function barreRichieste(chiave: string) {
    return (richiestePerRiga.get(chiave) || []).flatMap(r => {
      const idx = indiciIntervallo(r.arrivo, r.partenza, giorni)
      if (!idx) return []
      const selezionata = p.evidenziata === r.id
      return [(
        <button key={r.id} type="button" onClick={e => apri(e, [r])} title={etichettaRichiesta(r)}
          style={{
            position: 'absolute', top: 6, height: ROW_H - 12,
            left: `calc(${NAME_W}px + (100% - ${NAME_W}px) * ${idx.start / N} + 2px)`,
            width: `calc((100% - ${NAME_W}px) * ${(idx.end - idx.start) / N} - 4px)`,
            background: 'transparent', border: `1.5px dashed ${OTTONE}`, borderRadius: 6,
            color: COLORE_RICHIESTA_TESTO, fontSize: 11, fontWeight: 600, textAlign: 'left', padding: '0 6px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', zIndex: selezionata ? 8 : 7,
            opacity: attenua(r.id) ? 0.3 : 1,
            boxShadow: selezionata ? '0 3px 10px rgba(31,61,47,0.45)' : 'none',
            transition: 'opacity 0.15s, box-shadow 0.15s',
          }}>
          {etichettaRichiesta(r)}
        </button>
      )]
    })
  }

  return (
    <div className="bg-white rounded-xl border border-card-border overflow-hidden">
      {/* Navigazione mese */}
      <div className="flex items-center justify-between px-2 py-2 border-b" style={{ borderColor: COLORE_SEPARATORE }}>
        <button type="button" onClick={() => p.onMese(spostaMese(p.mese, -1))} aria-label="Mese precedente"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-green-mid active:bg-sage transition-colors">
          <ChevronLeft size={20} strokeWidth={2} aria-hidden />
        </button>
        <span className="font-serif text-[17px] text-green-dark">{etichettaMese(p.mese)}</span>
        <button type="button" onClick={() => p.onMese(spostaMese(p.mese, 1))} aria-label="Mese successivo"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-green-mid active:bg-sage transition-colors">
          <ChevronRight size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {/* Intestazione giorni */}
      <div style={{ display: 'grid', gridTemplateColumns: `${NAME_W}px repeat(${N}, minmax(0, 1fr))`, height: HEADER_H, borderBottom: `2px solid ${COLORE_SEPARATORE}` }}>
        <div style={{ borderRight: `2px solid ${COLORE_SEPARATORE}` }} />
        {giorni.map(g => {
          const oggi = g === p.oggi, dom = giornoSettimana(g) === 0
          return (
            <div key={g} style={{ background: oggi ? COLORE_OGGI : 'transparent', borderLeft: `1px solid ${COLORE_GRIGLIA}`, textAlign: 'center', paddingTop: 4, minWidth: 0 }}>
              <div style={{ fontSize: 8, fontWeight: 600, color: dom ? '#C58A67' : '#5c6b60', lineHeight: 1 }}>{GIORNI_BREVI[giornoSettimana(g)].slice(0, 2)}</div>
              <div style={{
                fontSize: 12, fontWeight: 700, margin: '2px auto 0', width: 20, height: 20, lineHeight: '20px', borderRadius: '50%',
                color: oggi ? 'white' : dom ? '#C58A67' : '#1F3D2F', background: oggi ? '#2D6A4F' : 'transparent',
              }}>{Number(g.slice(8))}</div>
            </div>
          )
        })}
      </div>

      {/* Righe */}
      {righe.map((riga, ri) => (
        <div key={riga.chiave} style={{ position: 'relative', height: ROW_H, borderBottom: `1px solid ${COLORE_GRIGLIA}`, borderTop: riga.chiave === RIGA_QUALSIASI ? `2px solid ${COLORE_SEPARATORE}` : undefined }}>
          <div style={{ display: 'grid', gridTemplateColumns: `${NAME_W}px repeat(${N}, minmax(0, 1fr))`, height: '100%' }}>
            <div style={{ borderRight: `2px solid ${COLORE_SEPARATORE}`, display: 'flex', alignItems: 'center', gap: 5, padding: '0 6px', minWidth: 0, background: 'white' }}>
              {riga.numero && <span className="font-serif" style={{ fontSize: 10, color: OTTONE }}>{riga.numero}</span>}
              <span className={riga.camera ? 'font-serif' : ''} style={{ fontSize: riga.camera ? 13 : 10, fontWeight: 600, color: riga.camera ? '#1F3D2F' : COLORE_RICHIESTA_TESTO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>
                {riga.nome}
              </span>
            </div>
            {giorni.map(g => {
              const oggi = g === p.oggi, dom = giornoSettimana(g) === 0
              return <div key={g} style={{ background: oggi ? COLORE_OGGI : dom ? COLORE_DOMENICA : ri % 2 === 0 ? 'white' : COLORE_DOMENICA, borderLeft: `1px solid ${COLORE_GRIGLIA}` }} />
            })}
          </div>
          {riga.camera && barrePrenotazioni(riga.camera)}
          {p.vista === 'presunta' && barreRichieste(riga.chiave)}
        </div>
      ))}
    </div>
  )
}
