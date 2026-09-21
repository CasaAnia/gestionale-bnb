'use client'
// ============================================================================
// «ARRIVI DI OGGI» IN HOME (21/09/2026) — la terza superficie del riferimento
// approvato da Ania.
//
// Prima gli arrivi erano una riga sola fra le altre: «CHECK-IN · Nome —
// Camera · 🕐 15:00», e quel 15:00 non diceva di dove fosse. Adesso ogni
// arrivo ha il suo riquadro: in grande l'ora IN STRUTTURA (con «circa» se è
// una stima o una fascia), e sotto, riga per riga, da dove arriva e chi la va
// a prendere. Niente riquadro bianco: filo d'ottone a sinistra e fondo della
// Home, come il resto delle sezioni editoriali.
//
// Gli arrivi stanno SOLO qui: il blocco «Oggi / Domani» non li ripete più
// (Ania, 11/09/2026, sulle pulizie: «due stanze sopra e tre sotto è
// confusionale»). Partenze e cambi camera restano dov'erano.
//
// Sola presentazione: le parole vengono da lib/arrivo.
// ============================================================================
import Link from 'next/link'
import { Plane, TrainFront, MapPin, Car, ChevronRight } from 'lucide-react'
import { nomeOspite } from '@/lib/guestName'
import { arrivoInHome, leggiArrivo, type IconaArrivo } from '@/lib/arrivo'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
export const TITOLO_ARRIVI_OGGI = 'Arrivi di oggi'
export const TITOLO_ARRIVI_DOMANI = 'Arrivi di domani'

const ICONE: Record<IconaArrivo, typeof Plane> = { aereo: Plane, treno: TrainFront, luogo: MapPin, auto: Car }

export function contaArrivi(n: number): string {
  return n === 1 ? '1 arrivo' : `${n} arrivi`
}

function Riquadro({ b }: { b: Record<string, unknown> }) {
  const a = arrivoInHome(leggiArrivo(b))
  const camera = (b.rooms as { name?: string } | null)?.name
  const nota = (b.guests as { notes?: string | null } | null)?.notes
  return (
    <div data-arrivo-home={String(b.id)} className="py-3" style={{ borderLeft: `3px solid ${OTTONE}`, paddingLeft: 14, marginTop: 12 }}>
      <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 8 }}>
        <p style={{ fontFamily: GEORGIA, fontSize: 19, lineHeight: '23px', color: 'var(--color-green-dark)' }}>{nomeOspite(b)}</p>
        {camera && <span className="ed-badge" data-camera>{camera}</span>}
      </div>

      <p className="mt-1.5 flex items-baseline flex-wrap" style={{ gap: 7 }}>
        <span data-ora-struttura style={{ fontFamily: GEORGIA, fontSize: a.numerico ? 27 : 19, lineHeight: '30px', color: 'var(--color-green-dark)', fontVariantNumeric: 'tabular-nums' }}>{a.grande}</span>
        {a.circa && <span data-circa style={{ fontSize: 14, color: 'var(--color-stone)' }}>circa</span>}
      </p>
      <p data-sotto-ora style={{ fontSize: 13, color: 'var(--color-stone)' }}>{a.sotto}</p>

      {a.righe.length > 0 && (
        <div className="mt-2.5" style={{ borderTop: '1px solid var(--color-card-border)', paddingTop: 10 }}>
          {a.righe.map((r, i) => {
            const Icona = ICONE[r.icona]
            return (
              <div key={r.icona + i} data-riga-arrivo={r.icona} className="flex items-start" style={{ gap: 10, marginTop: i ? 8 : 0 }}>
                <Icona size={17} color={OTTONE} aria-hidden className="shrink-0" style={{ marginTop: 2 }} />
                <div className="min-w-0">
                  <p style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-green-dark)' }}>{r.forte}</p>
                  <p style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>{r.sotto}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* La nota del cliente resta in rosso anche qui (Ania, 10/09/2026) */}
      {typeof nota === 'string' && nota.trim() && (
        <p data-nota-cliente-home className="mt-2 text-[13px] leading-snug font-semibold" style={{ color: '#C00000' }}>{nota}</p>
      )}

      <p className="mt-2.5">
        <Link href={`/scheda/${String(b.id)}`} className="ed-azione inline-flex items-center" style={{ gap: 3 }}>
          Apri prenotazione<ChevronRight size={14} aria-hidden />
        </Link>
      </p>
    </div>
  )
}

export default function ArriviOggi({ oggi, domani }: { oggi: Record<string, unknown>[]; domani: Record<string, unknown>[] }) {
  if (oggi.length === 0 && domani.length === 0) return null
  return (
    <section data-arrivi-home className="mb-6">
      {oggi.length > 0 && (
        <>
          <p className="ed-sezione mb-1">{TITOLO_ARRIVI_OGGI} <small>{contaArrivi(oggi.length)}</small></p>
          {oggi.map(b => <Riquadro key={String(b.id)} b={b} />)}
        </>
      )}
      {domani.length > 0 && (
        <>
          <p className={`ed-sezione mb-1 ${oggi.length ? 'mt-5' : ''}`}>{TITOLO_ARRIVI_DOMANI} <small>{contaArrivi(domani.length)}</small></p>
          {domani.map(b => <Riquadro key={String(b.id)} b={b} />)}
        </>
      )}
    </section>
  )
}
