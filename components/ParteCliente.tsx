'use client'
import Link from 'next/link'
import { periodoCompatto } from '@/lib/dateItaliane'
import { euroTondi } from '@/lib/euroTondi'
import type { SoggiornoPersona } from '@/lib/clienteCheTorna'

// ============================================================================
// LA PARTE «CLIENTE» (Ania, 12/09/2026): chi è già stata qui, che cosa ha già
// fatto da noi e quanto ha speso. Sta in fondo alla pagina della proposta,
// prima di «Rifiuta la richiesta», e la stessa identica parte andrà nella
// nuova scheda prenotazione: per questo è un componente di sola
// presentazione, che riceve testi già pronti e non legge niente dal database.
//
//   CLIENTE ──────────────────────────────────
//   SOGGIORNI   TOTALE SPESO   RICEVUTA   PROVENIENZA
//   2           1.360 €        sì         Nida
//
//   Ambra    29 apr → 4 mag · 5 notti         680 €
//   Ambra    12 ago → 20 ago · 8 notti  2025  680 €
//
//   «Dorme male con i rumori: darle la camera sul cortile.»
//   Apri il cliente ›
//
// Chi è in archivio ma non ha ancora dormito qui: «Nessun soggiorno concluso»,
// e restano nota e link. Chi è alla prima volta non ha questa parte: la decide
// la pagina, che non la disegna affatto.
// ============================================================================

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
const ROSSO_NOTA = '#C00000'
export const MISURA_ETICHETTA = 9        // px, maiuscolo ottone
export const MISURA_VALORE = 14.5        // px, semibold verde scuro
export const MISURA_CAMERA = 20          // px, Georgia

function Voce({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="min-w-0">
      <p className="uppercase" style={{ fontSize: MISURA_ETICHETTA, letterSpacing: '1.5px', color: OTTONE }}>{etichetta}</p>
      <p className="truncate mt-0.5" style={{ fontSize: MISURA_VALORE, fontWeight: 600, color: 'var(--color-green-dark)' }}>{valore}</p>
    </div>
  )
}

export default function ParteCliente({
  soggiorni, totaleCent = 0, ricevuta = false, provenienza = null, nota = null,
  hrefCliente = null, annoCorrente = new Date().getFullYear(), className = '',
}: {
  soggiorni: SoggiornoPersona[]
  totaleCent?: number
  ricevuta?: boolean
  provenienza?: string | null
  nota?: string | null
  hrefCliente?: string | null
  annoCorrente?: number
  className?: string
}) {
  const testoNota = (nota ?? '').trim()
  return (
    <section data-parte-cliente className={className}>
      <p className="ed-sezione mb-2">Cliente</p>

      {/* Le quattro cose che si guardano per prime */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 min-[420px]:grid-cols-4">
        <Voce etichetta="soggiorni" valore={soggiorni.length > 0 ? String(soggiorni.length) : '—'} />
        <Voce etichetta="totale speso" valore={totaleCent > 0 ? euroTondi(totaleCent) : '—'} />
        <Voce etichetta="ricevuta" valore={ricevuta ? 'sì' : 'no'} />
        <Voce etichetta="provenienza" valore={(provenienza ?? '').trim() || '—'} />
      </div>

      {/* I soggiorni, uno per riga: la camera in grande, le date in grigio,
          l'anno in ottone quando non è quello di adesso, l'importo a destra */}
      <div className="ed-lista ed-lista-ottone mt-3">
        {soggiorni.length === 0 ? (
          <p data-nessun-soggiorno className="pt-2" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>Nessun soggiorno concluso</p>
        ) : soggiorni.map(s => {
          const anno = Number(s.check_in.slice(0, 4))
          return (
            <Link key={s.prenotazioneId} href={`/prenotazioni/${s.prenotazioneId}`} data-soggiorno
              className="flex items-baseline gap-2 py-2">
              <span className="shrink-0" style={{ fontFamily: GEORGIA, fontSize: MISURA_CAMERA, color: 'var(--color-green-dark)' }}>
                {s.camere.join(' → ') || 'camera'}
              </span>
              <span className="min-w-0 truncate" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>
                {periodoCompatto(s.check_in, s.check_out)} · {s.notti === 1 ? '1 notte' : `${s.notti} notti`}
              </span>
              {anno !== annoCorrente && (
                <span data-anno className="shrink-0" style={{ fontSize: 11, color: OTTONE }}>{anno}</span>
              )}
              <span className="shrink-0 ml-auto" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-green-dark)' }}>{euroTondi(s.totaleCent)}</span>
            </Link>
          )
        })}
      </div>

      {/* La nota della cliente, nello stesso rosso di tutte le altre note */}
      {testoNota && (
        <p data-nota-parte-cliente className="mt-3 leading-snug" style={{ fontSize: 13.5, fontWeight: 600, color: ROSSO_NOTA }}>{testoNota}</p>
      )}

      {hrefCliente && (
        <Link href={hrefCliente} data-apri-cliente className="inline-block mt-3 text-[13px] font-semibold text-green-mid">Apri il cliente ›</Link>
      )}
    </section>
  )
}
