'use client'
// ============================================================================
// LA PARTE «CLIENTE» della nuova scheda prenotazione (13/09/2026): chi è, i
// suoi soggiorni precedenti e chi dorme con lei.
//
//   CLIENTE ───────────────────────────────────
//   TELEFONO          ARRIVATA DA
//   342 700 4354      passaparola
//   VALUTAZIONE       RICEVUTA
//   ★ ottima          sì
//   NOTA DEL CLIENTE
//   Dorme male con i rumori.
//   Modifica dati · Cambia cliente
//
//   SOGGIORNI PRECEDENTI  2 · 1.360 €
//   Ambra      29 apr → 4 mag · 5 notti · 2 ospiti      680 € ›
//
//   CON LEI
//   Marco Riva                                   333 000 0099
//
// Sola presentazione: i testi arrivano da lib/schedaConto e lib/clienteCheTorna.
// ============================================================================
import Link from 'next/link'
import { periodoCompatto } from '@/lib/dateItaliane'
import { euroTondi } from '@/lib/euroTondi'
import { testoNotti } from '@/lib/schedaPrenotazione'
import type { VoceCliente, PersonaConLei } from '@/lib/schedaConto'
import type { SoggiornoPersona } from '@/lib/clienteCheTorna'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
const ROSSO_NOTA = '#C00000'

export default function ClienteScheda({
  voci, soggiorni, totaleCent, conLei, onChiediProvenienza, hrefModificaDati, hrefCambiaCliente,
  annoCorrente = new Date().getFullYear(), className = '',
}: {
  voci: VoceCliente[]
  soggiorni: SoggiornoPersona[]
  totaleCent: number
  conLei: PersonaConLei[]
  onChiediProvenienza?: () => void
  hrefModificaDati: string
  hrefCambiaCliente: string
  annoCorrente?: number
  className?: string
}) {
  return (
    <div data-parte-cliente-scheda className={className}>
      {/* Chi è, a due colonne */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {voci.map(v => (
          <div key={v.etichetta} data-voce-cliente={v.etichetta} className={`min-w-0 ${v.etichetta === 'nota del cliente' ? 'col-span-2' : ''}`}>
            <p className="uppercase" style={{ fontSize: 9, letterSpacing: '1.5px', color: OTTONE }}>{v.etichetta}</p>
            {v.chiedi && onChiediProvenienza
              ? <button type="button" data-chiedi-provenienza-cliente onClick={onChiediProvenienza} className="mt-0.5 py-1 -my-1 text-left"
                style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-green-mid)' }}>{v.valore}</button>
              : <p className={`mt-0.5 ${v.etichetta === 'nota del cliente' ? 'leading-snug' : 'truncate'}`}
                style={{ fontSize: 14.5, fontWeight: 600, color: v.etichetta === 'nota del cliente' ? ROSSO_NOTA : 'var(--color-green-dark)' }}>{v.valore}</p>}
          </div>
        ))}
      </div>

      <p className="flex flex-wrap items-center mt-3" style={{ gap: '0 12px', fontSize: 14 }}>
        <Link href={hrefModificaDati} className="py-2 -my-2" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-mid)' }}>Modifica dati</Link>
        <Link href={hrefCambiaCliente} className="py-2 -my-2" style={{ fontSize: 14, color: 'var(--color-stone)' }}>Cambia cliente</Link>
      </p>

      {/* I soggiorni precedenti */}
      <p className="ed-sezione mt-6">Soggiorni precedenti {soggiorni.length > 0 && <small>{soggiorni.length} · {euroTondi(totaleCent)}</small>}</p>
      <div className="ed-lista mt-1">
        {soggiorni.length === 0
          ? <p data-nessun-soggiorno className="pt-2" style={{ fontSize: 13, color: 'var(--color-stone)' }}>È la prima volta che viene da noi.</p>
          : soggiorni.map(s => {
            const anno = Number(s.check_in.slice(0, 4))
            return (
              <Link key={s.prenotazioneId} href={`/scheda/${s.prenotazioneId}`} data-soggiorno-precedente
                className="flex items-start justify-between gap-3" style={{ padding: '10px 0' }}>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="truncate" style={{ fontFamily: GEORGIA, fontSize: 20, lineHeight: '24px', color: 'var(--color-green-dark)' }}>{s.camere.join(' → ') || 'camera'}</span>
                    {anno !== annoCorrente && <span data-anno className="shrink-0" style={{ fontSize: 11, color: OTTONE }}>{anno}</span>}
                  </span>
                  <span className="block leading-snug" style={{ fontSize: 13, color: 'var(--color-stone)' }}>
                    {periodoCompatto(s.check_in, s.check_out)} · {testoNotti(s.notti)} · {s.ospiti === 1 ? '1 ospite' : `${s.ospiti} ospiti`}
                  </span>
                </span>
                <span className="shrink-0" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)', lineHeight: '24px' }}>{euroTondi(s.totaleCent)} ›</span>
              </Link>
            )
          })}
      </div>

      {/* Chi dorme con lei */}
      {conLei.length > 0 && (
        <>
          <p className="ed-sezione mt-6">Con lei</p>
          <div className="ed-lista mt-1">
            {conLei.map(p => (
              <div key={p.chiave} data-con-lei className="flex items-baseline justify-between gap-3" style={{ padding: '10px 0' }}>
                <span className="min-w-0 truncate" style={{ fontSize: 14.5, fontWeight: p.senzaNome ? 400 : 600, color: p.senzaNome ? 'var(--color-stone)' : 'var(--color-green-dark)' }}>{p.nome}</span>
                <span className="shrink-0" style={{ fontSize: 14, color: 'var(--color-stone)' }}>{p.telefono}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
