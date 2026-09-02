'use client'
// ============================================================================
// FATTURA (Fase 5) — il dettaglio di una fattura di Casa Ania, consultabile
// PRIMA e DOPO il pagamento, e il PAGAMENTO di una fattura approvata:
//  · testata (fornitore, numero, data, scadenza, totale), stato della
//    scadenza (scaduta / in scadenza / non scaduta), righe, camere, pagine;
//  · pagamento con data (mai futura) e metodo OBBLIGATORIO, via RPC atomica
//    e idempotente (paga_fattura): un doppio tocco non parte, un errore
//    certo si mostra, un esito incerto ferma tutto con «Chiudi e ricontrolla»;
//  · dopo il pagamento: data e metodo reali, la spesa è nel conto del mese
//    del pagamento (non della fattura).
// ============================================================================
import { useRef, useState } from 'react'
import { Camera, CalendarClock, CircleCheck, Landmark, TriangleAlert } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Chip, Etichetta, Foglio, Pastiglia } from './mattoni'
import { eurVista as eur } from '@/lib/spese/vista'
import { etichettaGiorno, etichettaMetodo } from '@/lib/spese/adattatore'
import { etichettaScadenza, type FatturaDettaglio } from '@/lib/spese/fattureVista'
import { blocchiPagamento, type EsitoPagamento, type RichiestaPagamento } from '@/lib/spese/fatturePagamento'
import { creaGuardiaInvio } from '@/lib/spese/scrittura'

const METODI = ['contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro']
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const meseDi = (iso: string) => `${MESI[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

export function FatturaSheet({ dettaglio: d, oggi, apriFoto, paga, fatto, chiudi }: {
  dettaglio: FatturaDettaglio
  oggi: string
  apriFoto?: () => void
  paga?: (richiesta: RichiestaPagamento) => Promise<EsitoPagamento>   // solo per una fattura da pagare
  fatto: (esito: 'pagata' | 'verifica') => void
  chiudi: () => void
}) {
  const [richiesta, setRichiesta] = useState<RichiestaPagamento>({ dataPagamento: oggi, metodo: null })
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [daVerificare, setDaVerificare] = useState(false)
  const [pagataOra, setPagataOra] = useState(false)
  const guardia = useRef(creaGuardiaInvio())
  const giorno = (iso: string) => etichettaGiorno(iso, oggi)
  const blocchi = blocchiPagamento(richiesta, oggi)
  const scadenza = d.stato === 'da_pagare' ? d.scadenza : null
  const tonoScadenza = scadenza?.stato === 'scaduta' ? 'rosso' : scadenza?.stato === 'in_scadenza' ? 'terra' : undefined
  const puoPagare = d.stato === 'da_pagare' && !!paga && !pagataOra

  const segnaPagata = () => guardia.current(async () => {
    if (!paga) return false
    setErrore(null); setLavoro(true)
    try {
      const esito = await paga(richiesta)
      if (esito.ok) { setPagataOra(true); return true }
      setErrore(esito.errore)
      if (esito.incerto) setDaVerificare(true)
      return false
    } finally { setLavoro(false) }
  })

  return (
    <Foglio aria={`Fattura ${d.supplier ?? ''}`} chiudi={chiudi} scorrevole
      piede={puoPagare || daVerificare || pagataOra ? (
        <div className="flex flex-col gap-1.5">
          {errore && (
            <p className="text-[12.5px] font-semibold px-1" role="alert" style={{ color: t.rosso }}>{errore}</p>
          )}
          {pagataOra ? (
            <button onClick={() => fatto('pagata')}
              className="w-full min-h-12 text-[14px] font-bold text-white"
              style={{ background: t.verde, borderRadius: t.rPill }}>
              Pagata ✓ · la spesa è nel conto di {meseDi(richiesta.dataPagamento ?? oggi)}
            </button>
          ) : daVerificare ? (
            <button onClick={() => fatto('verifica')}
              className="w-full min-h-12 text-[14px] font-bold text-white"
              style={{ background: t.inchiostro, borderRadius: t.rPill }}>
              Chiudi e ricontrolla
            </button>
          ) : (
            <>
              {blocchi.map(b => (
                <p key={b} className="text-[12px] font-semibold px-1" role="alert" style={{ color: t.rosso }}>⛔ {b}</p>
              ))}
              <button disabled={lavoro || blocchi.length > 0} onClick={segnaPagata}
                className="w-full min-h-12 text-[15px] font-bold text-white disabled:opacity-50"
                style={{ background: t.terracotta, borderRadius: t.rPill }}>
                {lavoro ? 'Un attimo…' : `Segna come pagata · ${d.totale != null ? eur(d.totale) : ''}`}
              </button>
            </>
          )}
        </div>
      ) : undefined}>
      <p className={`${DISPLAY} text-[19px] mb-0.5`} style={{ color: t.inchiostro }}>{d.supplier || 'Fattura'}</p>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {pagataOra && <Pastiglia icona={CircleCheck} tono="verde" testo={`pagata ${giorno(richiesta.dataPagamento ?? oggi)}${richiesta.metodo ? ` · ${etichettaMetodo(richiesta.metodo)}` : ''}`} />}
        {d.stato === 'da_pagare' && !pagataOra && <Pastiglia icona={Landmark} testo="da pagare" tono="terra" />}
        {scadenza && scadenza.stato !== 'senza_scadenza' && !pagataOra && (
          <Pastiglia icona={scadenza.stato === 'scaduta' ? TriangleAlert : CalendarClock}
            testo={etichettaScadenza(d.due_date, scadenza, giorno)} tono={tonoScadenza} />
        )}
        {d.stato === 'pagata' && d.pagamento && (
          <Pastiglia icona={CircleCheck} tono="verde"
            testo={`pagata ${giorno(d.pagamento.data)}${d.pagamento.metodo ? ` · ${etichettaMetodo(d.pagamento.metodo)}` : ''}`} />
        )}
        {d.stato === 'in_revisione' && <Pastiglia testo="in revisione" tono="giallo" />}
        {d.pagine.length > 1 && <Pastiglia testo={`${d.pagine.length} pagine`} />}
      </div>

      <div className="mb-3 p-3" style={{ background: t.carta, borderRadius: t.r, border: t.bordoCarta }}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
          <Voce nome="Numero" valore={d.invoice_number ?? '—'} />
          <Voce nome="Data fattura" valore={d.document_date ? giorno(d.document_date) : '—'} />
          <Voce nome="Scadenza" valore={d.due_date ? giorno(d.due_date) : '—'} />
          <Voce nome="Totale" valore={d.totale != null ? eur(d.totale) : '—'} forte />
          {d.pagamento && <Voce nome="Pagata il" valore={giorno(d.pagamento.data)} />}
          {d.pagamento && <Voce nome="Metodo" valore={d.pagamento.metodo ? etichettaMetodo(d.pagamento.metodo) : '—'} />}
          <Voce nome="Camere" valore={d.camere.length ? d.camere.join(', ') : 'Generale'} />
          {d.gruppi.length > 0 && <Voce nome="Di chi è" valore={d.gruppi.join(', ')} />}
        </div>
        {d.note && <p className="text-[12px] mt-2" style={{ color: t.sub }}>nota: {d.note}</p>}
        {d.stato === 'pagata' && d.pagamento && (
          <p className="text-[12px] mt-2" style={{ color: t.sub }}>
            conta nello Speso di {meseDi(d.pagamento.data)}{d.document_date && d.document_date.slice(0, 7) !== d.pagamento.data.slice(0, 7) ? ` (la fattura è di ${meseDi(d.document_date)})` : ''}
          </p>
        )}
        {d.stato === 'da_pagare' && (
          <p className="text-[12px] mt-2" style={{ color: t.sub }}>
            impegnata, non ancora spesa: entrerà nel conto il giorno del pagamento
          </p>
        )}
      </div>

      {d.righe.length > 0 && (
        <div className="mb-3 p-3" style={{ background: t.carta, borderRadius: t.r, border: t.bordoCarta }}>
          <Etichetta>Voci</Etichetta>
          {d.righe.map((r, i) => (
            <div key={`${r.nome}-${i}`} className="flex items-center gap-2 min-h-8 text-[13px]"
              style={r.esclusa ? { opacity: 0.55 } : undefined}>
              <span className={`flex-1 truncate ${r.esclusa ? 'line-through' : ''}`} style={{ color: r.arrotondamento ? t.sub : t.inchiostro }}>
                {r.nome}
                {r.camera && r.camera !== 'Generale' && <span className="ml-1" style={{ color: t.sub }}>· {r.camera}</span>}
              </span>
              <span className="tabular-nums" style={{ color: t.sub }}>{eur(r.importo)}</span>
            </div>
          ))}
          <div className="flex justify-between text-[12.5px] font-bold mt-1 pt-1.5" style={{ borderTop: `1px solid ${t.bordo}`, color: t.inchiostro }}>
            <span>somma delle voci</span>
            <span className="tabular-nums" style={{ color: d.totale != null && Math.round(d.totale * 100) === d.sommaCent ? t.verde : t.rosso }}>
              {eur(d.sommaCent / 100)}{d.totale != null && Math.round(d.totale * 100) !== d.sommaCent ? ' ≠ totale' : ' ✓'}
            </span>
          </div>
        </div>
      )}

      {apriFoto && d.pagine.length > 0 && (
        <button onClick={apriFoto} className="min-h-11 px-3 mb-3 text-[12.5px] font-bold inline-flex items-center gap-1.5"
          style={{ color: t.verde, border: `1px solid ${t.bordo}`, borderRadius: t.rPill, background: t.carta }}>
          <Camera size={14} /> Vedi {d.pagine.length === 1 ? 'la pagina' : `le ${d.pagine.length} pagine`}
        </button>
      )}

      {puoPagare && (
        <fieldset disabled={lavoro || daVerificare} style={{ display: 'contents' }}>
          <div className="mb-4 p-3" style={{ background: t.terraTenue, borderRadius: t.r }}>
            <Etichetta>Segna il pagamento</Etichetta>
            <div className="mb-2">
              <Etichetta>Data del pagamento</Etichetta>
              <input type="date" value={richiesta.dataPagamento ?? ''} max={oggi}
                onChange={e => setRichiesta(r => ({ ...r, dataPagamento: e.target.value || null }))}
                className="w-full min-w-0 min-h-11 px-2 text-[13.5px] outline-none appearance-none"
                style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
              <p className="text-[11px] mt-1" style={{ color: t.sub }}>la spesa conta nel mese di questa data, non in quello della fattura</p>
            </div>
            <Etichetta>Metodo di pagamento (obbligatorio)</Etichetta>
            <div className="flex gap-1.5 flex-wrap">
              {METODI.map(m => (
                <Chip key={m} attivo={richiesta.metodo === m} colore={t.terracotta}
                  onClick={() => setRichiesta(r => ({ ...r, metodo: m }))}>
                  {etichettaMetodo(m)}
                </Chip>
              ))}
            </div>
          </div>
        </fieldset>
      )}
    </Foglio>
  )
}

function Voce({ nome, valore, forte }: { nome: string; valore: string; forte?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10.5px] uppercase tracking-[0.1em] font-semibold" style={{ color: t.sub }}>{nome}</span>
      <span className={`block truncate ${forte ? `${DISPLAY} text-[17px]` : 'font-medium'}`} style={{ color: t.inchiostro }}>{valore}</span>
    </div>
  )
}
