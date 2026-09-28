'use client'
// ============================================================================
// «DA INCASSARE» E «INCASSATI OGGI» NELLA HOME «MAISON» (28/09/2026).
// Da incassare: per ogni soggiorno con un residuo, l'etichetta ottone con lo
// stato e come paga («Partita oggi · bonifico»), il nome (link alla scheda) ·
// camere · date, «Totale X € · ricevuti Y € (acconto del …) · resta Z €» con
// Z in mattone, «Registra pagamento» (lo stesso foglio della scheda, senza
// aprirla) e, col telefono, «Apri chat». Sotto, i pagamenti registrati oggi.
// Chi entra e con quali cifre lo decide lib/statistiche.daIncassare, come prima.
// ============================================================================
import { useState } from 'react'
import Link from 'next/link'
import PagamentoDaHome from './PagamentoDaHome'
import { ICONA_WHATSAPP } from '@/components/ArriviOggi'
import { ID_DA_INCASSARE } from '@/components/NumeriOggi'
import { openWhatsApp } from '@/lib/whatsapp'
import { rigaConto, type IncassoOggi, type VoceIncasso } from '@/lib/incassiHome'
import type { PagamentoSalvato } from '@/components/scheda/FoglioPagamento'

export const TITOLO_DA_INCASSARE = 'Da incassare'
export const TITOLO_INCASSATI_OGGI = 'Incassati oggi'
export const REGISTRA_PAGAMENTO = 'Registra pagamento'
export const APRI_CHAT = 'Apri chat'
export const euroHome = (c: number) => `${(c / 100).toLocaleString('it-IT', { minimumFractionDigits: c % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`

export default function SoldiHome({ voci, incassati, onPagato }: { voci: VoceIncasso[]; incassati: IncassoOggi[]; onPagato: (esito: PagamentoSalvato) => void }) {
  const [pagamento, setPagamento] = useState<string | null>(null)
  const totale = voci.reduce((t, v) => t + v.residuoCent, 0)
  const totaleOggi = incassati.reduce((t, p) => t + p.importoCent, 0)
  return <>
    {voci.length > 0 && <section id={ID_DA_INCASSARE} className="mz-sec scroll-mt-4" data-da-incassare>
      <p className="mz-eyebrow">{TITOLO_DA_INCASSARE} <small>· {voci.length} · {euroHome(totale)}</small></p>
      {voci.map(v => <div key={v.chiave} className="mz-dc" data-voce-incasso={v.id}>
        <p className="mz-eyebrow" style={{ fontSize: 8.5 }}>{v.stato}</p>
        <p className="ti"><Link href={`/scheda/${v.id}`} className="mz-nome-link">{v.nome}</Link>{v.camere && ` · ${v.camere}`}{v.date && ` · ${v.date}`}</p>
        <p className="mo">{rigaConto(v, euroHome)} <span className="mat" data-residuo>{euroHome(v.residuoCent)}</span></p>
        <div className="azioni">
          <button type="button" className="mz-lnk" onClick={() => setPagamento(v.id)} data-registra-pagamento>{REGISTRA_PAGAMENTO}</button>
          {v.telefono && <button type="button" className="mz-lnk q" onClick={() => openWhatsApp(v.telefono!, '')} data-whatsapp="apri-chat">{ICONA_WHATSAPP}{APRI_CHAT}</button>}
        </div>
      </div>)}
    </section>}
    {incassati.length > 0 && <section className="mz-sec" data-incassati-oggi>
      <p className="mz-eyebrow">{TITOLO_INCASSATI_OGGI} <small>· {incassati.length} · {euroHome(totaleOggi)}</small></p>
      {incassati.map(p => <div key={p.id} className="mz-ev">
        <Link href={`/scheda/${p.bookingId}`} className="gn">{p.nome}</Link>
        <span className="r">— {p.testo}</span>
        <span className="eur ink">{euroHome(p.importoCent)}</span>
      </div>)}
    </section>}
    {pagamento && <PagamentoDaHome bookingId={pagamento} onChiudi={() => setPagamento(null)} onSalvato={esito => { setPagamento(null); onPagato(esito) }} />}
  </>
}
