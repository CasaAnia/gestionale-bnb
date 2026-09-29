'use client'
// ============================================================================
// LA LINGUETTA «CLIENTE» della scheda prenotazione (13/09/2026; dal
// 28/09/2026 impaginata come il riferimento della scheda a linguette,
// docs/design/scheda-riferimento.html, telefono 5):
//
//   TELEFONO            ARRIVATA DA
//   +39 333 123 4567    da Nida
//   VALUTAZIONE         RICEVUTA
//   ★ ottima            sì
//   GIÀ OSPITE          DOCUMENTI
//   4 volte · 640 €     nessuno · AGGIUNGI
//   NOTA DEL CLIENTE / NOTA DI QUESTA PRENOTAZIONE (mattone, tutta la riga)
//   MODIFICA DATI · CAMBIA CLIENTE · NOTA E COLORE
//   CHI DORME IN CAMERA ─────────────────────
//   Teresa Bianchi / MAMMA · DORME LEI, NON CHI HA PRENOTATO   +39 340 …
//   MODIFICA CHI DORME
//   SOGGIORNI PRECEDENTI · 4 · 640 € ─────────
//   Ambra / 29 apr → 4 mag · 5 notti · 2 ospiti                400 € ›
//                        ANNULLA PRENOTAZIONE
//
// «Con lei» non c'è più: la parte si chiama «Chi dorme in camera».
// Sola presentazione: i testi arrivano da lib/schedaConto, lib/schedaMaison
// e lib/clienteCheTorna.
// ============================================================================
import Link from 'next/link'
import { periodoCompatto } from '@/lib/dateItaliane'
import { euroTondi } from '@/lib/euroTondi'
import { testoNotti } from '@/lib/schedaPrenotazione'
import { COMANDO_NOTA } from '@/lib/notaScheda'
import { TITOLO_CHI_DORME_SCHEDA, COMANDO_CHI_DORME, INTESTATARIA_SCHEDA, ANNULLA_PRENOTAZIONE, etichettaDormeLei } from '@/lib/schedaMaison'
import type { VoceCliente, PersonaConLei } from '@/lib/schedaConto'
import type { SoggiornoPersona } from '@/lib/clienteCheTorna'

export default function ClienteScheda({
  voci, giaOspite, documenti, hrefDocumenti, notaPrenotazione, soggiorni, totaleCent,
  intestataria, conLei, dormonoAltri, onChiediProvenienza, onModificaDati, onCambiaCliente, onNota, onConLei, onAnnulla,
  annoCorrente = new Date().getFullYear(), className = '',
}: {
  voci: VoceCliente[]
  /** «4 volte · 640 €» o «prima volta» */
  giaOspite: string
  /** «nessuno» (con «Aggiungi») o «3 caricati ›»; null = lettura non riuscita */
  documenti: { testo: string; nessuno: boolean } | null
  hrefDocumenti: string | null
  notaPrenotazione: string | null
  soggiorni: SoggiornoPersona[]
  totaleCent: number
  /** chi ha prenotato: la sua riga c'è quando dorme lei */
  intestataria: { nome: string; telefono: string } | null
  conLei: PersonaConLei[]
  /** la spunta «Non è lei a dormire qui»: le persone in elenco dormono al suo posto */
  dormonoAltri: boolean
  onChiediProvenienza?: () => void
  /** apre il foglio «Dati della cliente» (16/09/2026), qui nella scheda */
  onModificaDati: () => void
  /** apre il foglio «Cambia cliente» (16/09/2026), qui nella scheda */
  onCambiaCliente: () => void
  /** apre il foglio «Nota e colore» */
  onNota: () => void
  /** apre il foglio «Chi dorme in camera» (era «Con lei», 17/09/2026) */
  onConLei: () => void
  /** apre il foglio «Annulla la prenotazione»; null = già annullata */
  onAnnulla: (() => void) | null
  annoCorrente?: number
  className?: string
}) {
  const nota = voci.find(v => v.etichetta === 'nota del cliente')
  const corte = voci.filter(v => v.etichetta !== 'nota del cliente')
  return (
    <div data-parte-cliente-scheda className={className}>
      <section className="np-sec" style={{ paddingTop: 16 }}>
        {/* Chi è, a due colonne */}
        <div className="sch-g2">
          {corte.map(v => (
            <div key={v.etichetta} data-voce-cliente={v.etichetta} className="min-w-0">
              <p className="sch-k">{v.etichetta}</p>
              {v.chiedi && onChiediProvenienza
                ? <button type="button" data-chiedi-provenienza-cliente onClick={onChiediProvenienza} className="sch-v sch-v-azione">{v.valore}</button>
                : <p className="sch-v">{v.valore}</p>}
            </div>
          ))}
          <div data-voce-cliente="già ospite" className="min-w-0"><p className="sch-k">già ospite</p><p className="sch-v">{giaOspite}</p></div>
          {documenti && (
            <div data-voce-cliente="documenti" className="min-w-0">
              <p className="sch-k">documenti</p>
              {documenti.nessuno
                ? <p className="sch-v">{documenti.testo}{hrefDocumenti && <> · <Link href={hrefDocumenti} data-aggiungi-documento className="mz-lnk q sch-lnk-piccolo">Aggiungi</Link></>}</p>
                : hrefDocumenti ? <Link href={hrefDocumenti} data-documenti-caricati className="sch-v block">{documenti.testo}</Link> : <p className="sch-v">{documenti.testo}</p>}
            </div>
          )}
          {nota && <div data-voce-cliente="nota del cliente" className="min-w-0 sch-tutta"><p className="sch-k">nota del cliente</p><p className="sch-v mat">{nota.valore}</p></div>}
          {notaPrenotazione && <div data-voce-cliente="nota di questa prenotazione" className="min-w-0 sch-tutta"><p className="sch-k">nota di questa prenotazione</p><p className="sch-v mat">{notaPrenotazione}</p></div>}
        </div>

        <p className="sch-azioni">
          <button type="button" data-modifica-dati onClick={onModificaDati} className="mz-lnk">Modifica dati</button>
          <button type="button" data-cambia-cliente onClick={onCambiaCliente} className="mz-lnk q">Cambia cliente</button>
          <button type="button" data-nota-colore onClick={onNota} className="mz-lnk q">{COMANDO_NOTA}</button>
        </p>
      </section>

      {/* Chi dorme in camera */}
      <section className="np-sec" data-chi-dorme-scheda>
        <p className="mz-eyebrow">{TITOLO_CHI_DORME_SCHEDA}</p>
        {!dormonoAltri && intestataria && (
          <div data-intestataria className="np-persona">
            <span className="min-w-0"><span className="nm">{intestataria.nome}</span><span className="ch">{INTESTATARIA_SCHEDA}</span></span>
            <span className="tel">{intestataria.telefono}</span>
          </div>
        )}
        {conLei.map(p => (
          <div key={p.chiave} data-con-lei className="np-persona">
            <span className="min-w-0">
              <span className={`nm ${p.senzaNome ? 'senza' : ''}`}>{p.nome}</span>
              {dormonoAltri
                ? <span data-dorme-lei className="ch mat">{etichettaDormeLei(p.chiE)}</span>
                : p.chiE && <span data-chi-e className="ch">{p.chiE}</span>}
            </span>
            <span className="tel">{p.telefono}</span>
          </div>
        ))}
        <p style={{ marginTop: 10 }}><button type="button" data-con-lei-comando onClick={onConLei} className="mz-lnk q">{COMANDO_CHI_DORME}</button></p>
      </section>

      {/* I soggiorni precedenti */}
      <section className="np-sec" data-soggiorni-precedenti>
        <p className="mz-eyebrow">Soggiorni precedenti {soggiorni.length > 0 && <small>· {soggiorni.length} · {euroTondi(totaleCent)}</small>}</p>
        {soggiorni.length === 0
          ? <p data-nessun-soggiorno className="np-hint">È la prima volta che viene da noi.</p>
          : soggiorni.map(s => {
            const anno = Number(s.check_in.slice(0, 4))
            return (
              <Link key={s.prenotazioneId} href={`/scheda/${s.prenotazioneId}`} data-soggiorno-precedente className="sch-det sch-prec">
                <span className="min-w-0">
                  <span className="sch-big nm">{s.camere.join(' ⇄ ') || 'camera'}</span>
                  <small>{anno !== annoCorrente && <span data-anno>{anno} · </span>}{periodoCompatto(s.check_in, s.check_out)} · {testoNotti(s.notti)} · {s.ospiti === 1 ? '1 ospite' : `${s.ospiti} ospiti`}</small>
                </span>
                <b className="sch-big">{euroTondi(s.totaleCent)} ›</b>
              </Link>
            )
          })}
      </section>

      {onAnnulla && (
        <p className="sch-fondo">
          <button type="button" data-annulla-prenotazione onClick={onAnnulla} className="mz-lnk sch-lnk-mat">{ANNULLA_PRENOTAZIONE}</button>
        </p>
      )}
    </div>
  )
}
