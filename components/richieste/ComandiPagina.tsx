'use client'
import Link from 'next/link'
import { rigaDaGuardare } from '@/lib/comandiRichieste'

// ============================================================================
// I COMANDI SOTTO IL CALENDARIO DELLE RICHIESTE (Ania, dal telefono,
// 12/09/2026).
//
// Prima erano pastiglie: due etichettine colorate («nuove dal sito», «da
// guardare») e un interruttore «Ordina». Troppe pastiglie in poco spazio.
// Adesso sono PAROLE:
//
//   • 3 da guardare · ferme da più di un giorno      ← si tocca, accende il filtro
//   Ordina per  arrivo  notti  persone               ← la scelta sottolineata
//
// Le due righe sono in 14 px: Ania trovava troppo piccoli i filtri di ieri,
// e 14 px è la misura minima, non una preferenza.
//
// Le «nuove dal sito» non hanno più un'etichettina: si leggono solo nel
// sottotitolo in cima alla pagina («4 aperte · 2 nuove dal sito»).
//
// Resta com'era «+ Nuova richiesta». L'interruttore «Reale | Presunta» è
// quello del Calendario: components/InterruttorePillola.
//
// Tutto quello che si tocca ha un'area utile alta almeno 44 px.
// ============================================================================

export const ALTEZZA_TASTO = 24       // «+ Nuova richiesta»
export const ANGOLI_VOCE = 4
export const ALTEZZA_TOCCO = 44

const TESTO_RIGHE = 14                // le due righe di parole: 14 px è la
                                      // misura minima (Ania, 12/09/2026), i
                                      // filtri di ieri erano troppo piccoli
const OTTONE_SCURO = '#7A5C1E'        // «3 da guardare»
const OTTONE_PALLINO = 'var(--color-brass)'
const OTTONE_CHIARO = 'rgba(169,136,78,0.45)'   // la sottolineatura della scelta
const TOCCO = 'py-[12px]'             // 20 px di riga + 12 sopra e 12 sotto = 44

// ── «+ Nuova richiesta» ─────────────────────────────────────────────────────
// Alto 24 px, fondo sage, testo green-mid 11,5 bold, angoli 4, 9 px ai lati.
// Niente contorno e niente verde pieno: il verde pieno è dell'azione.
export function TastoNuovaRichiesta({ testo = '+ Nuova richiesta', className = '' }: { testo?: string; className?: string }) {
  return (
    <Link href="/richieste/nuova" data-nuova-richiesta
      className={`inline-flex items-center justify-center shrink-0 bg-sage text-green-mid ${className}`}
      style={{ height: ALTEZZA_TASTO, padding: '0 9px', borderRadius: ANGOLI_VOCE, fontSize: 11.5, fontWeight: 700 }}>
      {testo}
    </Link>
  )
}

// ── «3 da guardare · ferme da più di un giorno» ─────────────────────────────
// Una riga sola: pallino d'ottone da 7 px, il conto in grassetto scuro e il
// perché in grigio. Si tocca e accende il filtro; da accesa dice «mostra
// tutte», che è la via d'uscita. Senza richieste ferme la riga non c'è.
export function RigaDaGuardare({ quante, acceso, onClick }: { quante: number; acceso: boolean; onClick: () => void }) {
  const riga = rigaDaGuardare(quante, acceso)
  if (!riga) return null
  return (
    <button type="button" data-da-guardare aria-pressed={acceso} onClick={onClick}
      className={`flex items-center gap-1.5 text-left ${TOCCO} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid`}
      style={{ fontSize: TESTO_RIGHE, lineHeight: '20px' }}>
      <span aria-hidden className="shrink-0" style={{ width: 7, height: 7, borderRadius: '50%', background: OTTONE_PALLINO }} />
      <span style={{ fontWeight: 700, color: OTTONE_SCURO }}>{riga.conto}</span>
      <span style={{ color: 'var(--color-stone)' }}>{riga.coda}</span>
    </button>
  )
}

// ── «Ordina per  arrivo  notti  persone» ────────────────────────────────────
// Le tre parole si toccano una per una; quella scelta è in verde grassetto con
// una sottolineatura sottile d'ottone chiaro, 4 px sotto il testo.
export function RigaOrdina<T extends string>({ voci, scelta, onScegli, nome, className = '' }: {
  voci: readonly (readonly [T, string])[]
  scelta: T
  onScegli: (v: T) => void
  nome: string
  className?: string
}) {
  return (
    <div role="group" aria-label={nome} data-ordina className={`flex items-center flex-wrap gap-x-3 ${className}`}
      style={{ fontSize: TESTO_RIGHE, lineHeight: '20px', color: 'var(--color-stone)' }}>
      <span className={TOCCO}>Ordina per</span>
      {voci.map(([v, label]) => {
        const presa = scelta === v
        return (
          <button key={v} type="button" onClick={() => onScegli(v)} aria-pressed={presa} data-ordine={v}
            className={`${TOCCO} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid`}
            style={presa
              ? { fontWeight: 700, color: 'var(--color-green-mid)', textDecoration: 'underline', textDecorationColor: OTTONE_CHIARO, textDecorationThickness: 1, textUnderlineOffset: 4 }
              : { color: 'var(--color-stone)' }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}
