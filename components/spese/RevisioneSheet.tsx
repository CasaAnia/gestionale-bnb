'use client'
// ============================================================================
// REVISIONE DI UN DOCUMENTO (Fase 4 · blocco 3) — vista sulla logica pura
// di lib/spese/revisione: originali intatti, modifiche pendenti, correzioni
// alla conferma via RPC atomica. Grafica B; tocchi ≥ 44 px; dubbi mostrati
// con motivo (sfondo tenue, MAI bordi neri). Quadratura ESATTA in vista:
// totale documento, somma righe, differenza — conferma bloccata se ≠ 0.
// ============================================================================
import { useMemo, useRef, useState } from 'react'
import { X, Plus, ZoomIn } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Chip, Etichetta, Foglio } from './mattoni'
import type { PaginaFoto } from './FotoSheet'
import {
  aggiungiRiga, apriRevisione, blocchiConferma, bozzaCorrente, dubbiDi,
  modificaBozza, modificaRiga, modificaTotale, modifichePendenti, quadratura,
  rigaCorrente, togliRigaNuova, totaliSorella,
  type BozzaGrezza, type RigaGrezza, type StatoRevisione,
} from '@/lib/spese/revisione'
import { confermaRevisione, salvaModifiche, scartaRevisione, type ClienteRevisione } from '@/lib/spese/revisioneScrittura'
import { creaGuardiaInvio, importoDaTesto, testoDaImporto } from '@/lib/spese/scrittura'
import { etichettaMetodo } from '@/lib/spese/adattatore'

const eurCent = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €'
const METODI = ['contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro']
const NATURE = [['ordinaria', 'Ordinaria'], ['ricorrente', 'Ricorrente'], ['straordinaria', 'Straordinaria']] as const

export function RevisioneSheet({ documento, bozze, righe, gruppi, categorie, camere, pagine, firmaUrl, cliente, fatto, chiudi }: {
  documento: { id: string; supplier?: string | null; kind: string; doc_total: number | null; note?: string | null }
  bozze: BozzaGrezza[]
  righe: RigaGrezza[]
  gruppi: { id: string; name: string; ambito?: string | null }[]
  categorie: { id: string; name: string; group_id: string }[]
  camere: { id: string; name: string }[]
  pagine: PaginaFoto[]
  firmaUrl: (storagePath: string) => Promise<string | null>
  cliente: ClienteRevisione
  fatto: (esito: 'confermato' | 'scartato' | 'salvato') => void   // ricarica la pagina
  chiudi: () => void
}) {
  const [stato, setStato] = useState<StatoRevisione>(() =>
    apriRevisione(documento.id, documento.doc_total, bozze, righe))
  const [errore, setErrore] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState(false)
  const [scartoAperto, setScartoAperto] = useState(false)
  const [motivoScarto, setMotivoScarto] = useState('')
  const [zoom, setZoom] = useState<{ url: string; grande: boolean } | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  // testi degli importi in modifica (il numero entra nello stato solo se valido)
  const [testi, setTesti] = useState<Record<string, string>>({})
  const guardia = useRef(creaGuardiaInvio())

  const ambitoDi = useMemo(() => {
    const m = new Map(gruppi.map(g => [g.id, (g.ambito === 'azienda' ? 'azienda' : 'personale') as 'personale' | 'azienda']))
    return (id: string | null) => (id ? m.get(id) ?? 'personale' : 'personale')
  }, [gruppi])
  const q = quadratura(stato)
  const blocchi = blocchiConferma(stato, ambitoDi)
  const testiInvalidi = Object.entries(testi).filter(([, v]) => v !== '' && importoDaTesto(v) === null)

  const apriFoto = async (p: PaginaFoto) => {
    const url = urls[p.id] ?? await firmaUrl(p.storage_path)
    if (!url) { setErrore('non riesco ad aprire la foto: riprova'); return }
    setUrls(prev => ({ ...prev, [p.id]: url }))
    setZoom({ url, grande: false })
  }

  const campoImporto = (chiave: string, corrente: number, applica: (n: number) => void, negativiOk = false) => (
    <input inputMode="decimal" value={testi[chiave] ?? testoDaImporto(Math.abs(corrente)) ?? ''}
      onChange={e => {
        const v = e.target.value
        setTesti(prev => ({ ...prev, [chiave]: v }))
        const n = importoDaTesto(v.replace(/^-/, ''))
        if (n !== null) applica(v.trim().startsWith('-') && negativiOk ? -n : n)
      }}
      className="w-20 min-h-11 px-2 text-[13.5px] text-right tabular-nums outline-none"
      style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
  )

  const esegui = (azione: () => Promise<{ ok: boolean; errore?: string }>) => guardia.current(async () => {
    setErrore(null); setLavoro(true)
    try {
      const esito = await azione()
      if (!esito.ok) setErrore(esito.errore ?? 'errore')   // modifiche INTATTE
      return esito.ok
    } finally { setLavoro(false) }
  })

  return (
    <Foglio aria={`Revisione: ${documento.supplier || 'documento'}`} chiudi={chiudi} scorrevole
      piede={
        <div className="flex flex-col gap-1.5">
          {blocchi.map(b => (
            <p key={b} className="text-[12px] font-semibold px-1" role="alert" style={{ color: t.rosso }}>⛔ {b}</p>
          ))}
          <div className="flex gap-2">
            <button disabled={lavoro || !modifichePendenti(stato) || testiInvalidi.length > 0}
              onClick={() => esegui(async () => {
                const r = await salvaModifiche(cliente, stato)
                if (r.ok) fatto('salvato')
                return r
              })}
              className="flex-1 min-h-12 text-[14px] font-bold disabled:opacity-50"
              style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }}>
              Salva
            </button>
            <button disabled={lavoro || blocchi.length > 0 || testiInvalidi.length > 0}
              onClick={() => esegui(async () => {
                const r = await confermaRevisione(cliente, stato)
                if (r.ok) fatto('confermato')
                return r
              })}
              className="flex-[2] min-h-12 text-[15px] font-bold text-white disabled:opacity-50"
              style={{ background: t.verde, borderRadius: t.rPill }}>
              {lavoro ? 'Un attimo…' : 'Conferma le spese'}
            </button>
          </div>
        </div>
      }>
      <p className={`${DISPLAY} text-[19px] mb-0.5`} style={{ color: t.inchiostro }}>
        {documento.supplier || 'Documento da rivedere'}
      </p>
      <p className="text-[12px] mb-3" style={{ color: t.sub }}>
        {documento.kind === 'scontrino' ? 'scontrino' : documento.kind} in revisione
        {documento.note ? ` · nota: ${documento.note}` : ''}
      </p>

      {errore && (
        <div className="mb-3 px-3 py-2 text-[13px] font-semibold" role="alert"
          style={{ background: t.terraTenue, color: t.rosso, borderRadius: t.r }}>{errore}</div>
      )}

      {/* ---- foto e pagine, con zoom ---- */}
      {pagine.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {[...pagine].sort((a, b) => a.page_order - b.page_order).map(p => (
            <button key={p.id} onClick={() => apriFoto(p)} aria-label={`Apri la pagina ${p.page_order} con lo zoom`}
              className="relative shrink-0 grid place-items-center w-20 h-24"
              style={{ background: t.velo, borderRadius: t.r, border: t.bordoCarta }}>
              <ZoomIn size={18} style={{ color: t.sub }} />
              <span className="absolute bottom-1 text-[10px]" style={{ color: t.sub }}>pagina {p.page_order}</span>
            </button>
          ))}
        </div>
      )}

      {/* ---- totale, somma, differenza: SEMPRE in vista ---- */}
      <div className="mb-3 p-3" style={{ background: q.ok ? t.verdeTenue : t.terraTenue, borderRadius: t.r }}>
        <div className="flex items-center justify-between min-h-11">
          <span className="text-[13px] font-bold" style={{ color: t.inchiostro }}>Totale documento</span>
          {campoImporto('doc_total', (stato.docTotaleCent ?? 0) / 100, n => setStato(s => modificaTotale(s, Math.round(n * 100))))}
        </div>
        <div className="flex justify-between text-[12.5px]" style={{ color: t.sub }}>
          <span>somma delle righe + arrotondamenti</span>
          <span className="tabular-nums font-semibold">{eurCent(q.sommaCent)}</span>
        </div>
        <div className="flex justify-between text-[13px] font-bold" style={{ color: q.ok ? t.verde : t.rosso }}>
          <span>{q.ok ? '✓ quadra al centesimo' : 'differenza'}</span>
          {!q.ok && <span className="tabular-nums">{q.diffCent == null ? '—' : eurCent(q.diffCent)}</span>}
        </div>
      </div>

      {/* ---- le sorelle: Casa Mia e Casa Ania separate ---- */}
      {stato.bozze.map(b => {
        const c = bozzaCorrente(stato, b.id)
        const ambito = ambitoDi(c.group_id)
        const accento = ambito === 'azienda' ? t.terracotta : t.verde
        const tot = totaliSorella(stato, b.id)
        const dubbi = dubbiDi(b.confidence)
        // una categoria senza gruppo vale per tutti (sui dati veri il gruppo c'è sempre)
        const catDelGruppo = categorie.filter(x => !c.group_id || !x.group_id || x.group_id === c.group_id)
        return (
          <section key={b.id} className="mb-4 p-3" style={{ background: t.carta, borderRadius: t.r, border: t.bordoCarta, boxShadow: t.ombra }}>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-1 text-[11.5px] font-bold text-white" style={{ background: accento, borderRadius: 99 }}>
                {ambito === 'azienda' ? 'Casa Ania' : 'Casa Mia'}
              </span>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: t.inchiostro }}>
                quota {eurCent(tot.totaleCent)}
              </span>
            </div>
            {dubbi.map(d => (
              <p key={d.campo} className="text-[12px] mb-1 px-2 py-1 font-semibold" role="note"
                style={{ background: t.terraTenue, color: t.inchiostro, borderRadius: t.r }}>
                dubbio su «{d.campo}» — {d.motivo}
              </p>
            ))}

            <Etichetta>Di chi è</Etichetta>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {gruppi.map(g => (
                <Chip key={g.id} attivo={c.group_id === g.id} colore={accento}
                  onClick={() => setStato(s => modificaBozza(s, b.id, { group_id: g.id, category_id: null }))}>
                  {g.name}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <Etichetta>Categoria</Etichetta>
                <select value={c.category_id ?? ''}
                  onChange={e => setStato(s => modificaBozza(s, b.id, { category_id: e.target.value || null }))}
                  className="w-full min-h-11 px-2 text-[13.5px] outline-none"
                  style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }}>
                  <option value="">—</option>
                  {catDelGruppo.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <Etichetta>Sottocategoria</Etichetta>
                <input value={c.subcategory ?? ''} placeholder="Non specificata"
                  onChange={e => setStato(s => modificaBozza(s, b.id, { subcategory: e.target.value || null }))}
                  className="w-full min-h-11 px-3 text-[13.5px] outline-none"
                  style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
              </div>
            </div>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <Etichetta>Data</Etichetta>
                <input type="date" value={c.expense_date}
                  onChange={e => setStato(s => modificaBozza(s, b.id, { expense_date: e.target.value }))}
                  className="w-full min-h-11 px-2 text-[13.5px] outline-none"
                  style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
              </div>
              <div className="flex-1">
                <Etichetta>Negozio</Etichetta>
                <input value={c.store ?? ''}
                  onChange={e => setStato(s => modificaBozza(s, b.id, { store: e.target.value || null }))}
                  className="w-full min-h-11 px-3 text-[13.5px] outline-none"
                  style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
              </div>
            </div>
            {ambito === 'azienda' && (
              <>
                <Etichetta>Metodo di pagamento (obbligatorio)</Etichetta>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {METODI.map(m => (
                    <Chip key={m} attivo={c.payment_method === m} colore={accento}
                      onClick={() => setStato(s => modificaBozza(s, b.id, { payment_method: m }))}>
                      {etichettaMetodo(m)}
                    </Chip>
                  ))}
                </div>
                <Etichetta>Camera</Etichetta>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  <Chip attivo={!c.room_id} colore={accento}
                    onClick={() => setStato(s => modificaBozza(s, b.id, { room_id: null }))}>Generale</Chip>
                  {camere.map(r => (
                    <Chip key={r.id} attivo={c.room_id === r.id} colore={accento}
                      onClick={() => setStato(s => modificaBozza(s, b.id, { room_id: r.id }))}>{r.name}</Chip>
                  ))}
                </div>
              </>
            )}
            <Etichetta>Natura (facoltativa)</Etichetta>
            <div className="flex gap-1.5 flex-wrap mb-3">
              <Chip attivo={!c.expense_nature} colore={accento}
                onClick={() => setStato(s => modificaBozza(s, b.id, { expense_nature: null }))}>Non indicata</Chip>
              {NATURE.map(([v, nome]) => (
                <Chip key={v} attivo={c.expense_nature === v} colore={accento}
                  onClick={() => setStato(s => modificaBozza(s, b.id, { expense_nature: v }))}>{nome}</Chip>
              ))}
            </div>

            {/* ---- le righe ---- */}
            <Etichetta>Voci ({tot.righeCent.length} attive{tot.escluse ? ` · ${tot.escluse} escluse` : ''}{tot.aggiunte ? ` · ${tot.aggiunte} aggiunte` : ''})</Etichetta>
            {stato.righe.filter(r => r.draft_id === b.id).map(r => {
              const rc = rigaCorrente(stato, r.id)
              const dubbiRiga = dubbiDi(r.confidence)
              return (
                <div key={r.id} className="py-1.5" style={{ opacity: rc.excluded ? 0.45 : 1 }}>
                  <div className="flex items-center gap-2">
                    <input value={rc.name}
                      onChange={e => setStato(s => modificaRiga(s, r.id, { name: e.target.value }))}
                      className="flex-1 min-h-11 px-3 text-[13.5px] outline-none"
                      style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
                    {campoImporto(`riga-${r.id}`, rc.amount, n => setStato(s => modificaRiga(s, r.id, { amount: n })))}
                    <button onClick={() => setStato(s => modificaRiga(s, r.id, { excluded: !rc.excluded }))}
                      aria-label={rc.excluded ? `Reincludi ${rc.name}` : `Escludi ${rc.name}`}
                      className="min-h-11 min-w-11 px-2 text-[12px] font-bold"
                      style={{ color: rc.excluded ? t.verde : t.rosso }}>
                      {rc.excluded ? '↩︎' : '✕'}
                    </button>
                  </div>
                  <p className="text-[10.5px] px-3" style={{ color: t.sub }}>
                    {r.user_added ? 'aggiunta a mano · ' : ''}
                    {r.raw_name && r.raw_name !== rc.name ? `sullo scontrino: «${r.raw_name}»` : ''}
                    {rc.qty && rc.qty !== 1 ? ` · ×${rc.qty}` : ''}
                    {rc.excluded ? ' · esclusa dal conto' : ''}
                  </p>
                  {dubbiRiga.map(d => (
                    <p key={d.campo} className="text-[11.5px] mx-3 mt-0.5 px-2 py-1 font-semibold"
                      style={{ background: t.terraTenue, color: t.inchiostro, borderRadius: t.r }}>
                      dubbio su «{d.campo}» — {d.motivo}
                    </p>
                  ))}
                </div>
              )
            })}
            {stato.righeNuove.filter(r => r.draft_id === b.id).map(r => (
              <div key={r.idLocale} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 px-3 text-[13.5px]" style={{ color: t.inchiostro }}>{r.name}
                  <span className="text-[10.5px] block" style={{ color: t.sub }}>nuova, da salvare</span></span>
                <span className="tabular-nums text-[13.5px] font-semibold" style={{ color: t.inchiostro }}>{eurCent(Math.round(r.amount * 100))}</span>
                <button onClick={() => setStato(s => togliRigaNuova(s, r.idLocale))} aria-label={`Togli ${r.name}`}
                  className="min-h-11 min-w-11 text-[12px] font-bold" style={{ color: t.rosso }}>✕</button>
              </div>
            ))}
            <AggiungiVoce accento={accento} aggiungi={(nome, importo) =>
              setStato(s => aggiungiRiga(s, { draft_id: b.id, name: nome, amount: importo }, crypto.randomUUID()))} />

            <div className="flex items-center justify-between mt-1 pt-2" style={{ borderTop: t.bordoCarta }}>
              <span className="text-[12.5px]" style={{ color: t.sub }}>arrotondamento (± cent)</span>
              {campoImporto(`arr-${b.id}`, (c.arrotondamento_cent ?? 0) / 100,
                n => setStato(s => modificaBozza(s, b.id, { arrotondamento_cent: Math.round(n * 100) })), true)}
            </div>
          </section>
        )
      })}

      {/* ---- scarto, col motivo ---- */}
      {!scartoAperto ? (
        <button onClick={() => setScartoAperto(true)} disabled={lavoro}
          className="w-full min-h-11 mb-4 text-[13px] font-bold" style={{ color: t.rosso }}>
          Scarta questo documento…
        </button>
      ) : (
        <div className="mb-4 p-3" style={{ background: t.terraTenue, borderRadius: t.r }}>
          <Etichetta>Motivo dello scarto (obbligatorio)</Etichetta>
          <input value={motivoScarto} onChange={e => setMotivoScarto(e.target.value)}
            placeholder="es. foto doppia, non è una spesa…"
            className="w-full min-h-11 px-3 mb-2 text-[13.5px] outline-none"
            style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
          <div className="flex gap-2">
            <button onClick={() => setScartoAperto(false)} className="flex-1 min-h-11 text-[13px] font-bold" style={{ color: t.sub }}>Annulla</button>
            <button disabled={lavoro} onClick={() => esegui(async () => {
              const r = await scartaRevisione(cliente, documento.id, motivoScarto)
              if (r.ok) fatto('scartato')
              return r
            })}
              className="flex-1 min-h-11 text-[13px] font-bold text-white" style={{ background: t.rosso, borderRadius: t.rPill }}>
              Scarta davvero
            </button>
          </div>
        </div>
      )}

      {/* ---- zoom della foto ---- */}
      {zoom && (
        <div className="fixed inset-0 z-[80] overflow-auto" style={{ background: 'rgba(10,12,10,.92)' }}
          onClick={() => setZoom(z => z && !z.grande ? { ...z, grande: true } : null)}>
          <button onClick={e => { e.stopPropagation(); setZoom(null) }} aria-label="Chiudi lo zoom"
            className="fixed top-2 right-2 z-[81] grid place-items-center w-11 h-11 text-white"
            style={{ background: 'rgba(20,25,20,.8)', borderRadius: 99 }}>
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- link firmato temporaneo */}
          <img src={zoom.url} alt="Documento ingrandito"
            className={zoom.grande ? 'max-w-none w-[250%]' : 'w-full h-auto'}
            style={{ cursor: zoom.grande ? 'zoom-out' : 'zoom-in' }} />
          <p className="fixed bottom-2 inset-x-0 text-center text-[12px] text-white/80">
            {zoom.grande ? 'tocca per chiudere' : 'tocca per ingrandire'}
          </p>
        </div>
      )}
    </Foglio>
  )
}

// mini-modulo per una voce nuova (nome + importo, tocchi ≥44)
function AggiungiVoce({ accento, aggiungi }: { accento: string; aggiungi: (nome: string, importo: number) => void }) {
  const [aperto, setAperto] = useState(false)
  const [nome, setNome] = useState('')
  const [importo, setImporto] = useState('')
  if (!aperto) return (
    <button onClick={() => setAperto(true)} className="flex items-center gap-1.5 min-h-11 px-2 text-[12.5px] font-bold"
      style={{ color: accento }}>
      <Plus size={15} /> Aggiungi una voce
    </button>
  )
  const n = importoDaTesto(importo)
  return (
    <div className="flex items-center gap-2 py-1.5">
      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="nome della voce"
        className="flex-1 min-h-11 px-3 text-[13.5px] outline-none"
        style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
      <input value={importo} onChange={e => setImporto(e.target.value)} placeholder="€" inputMode="decimal"
        className="w-20 min-h-11 px-2 text-[13.5px] text-right outline-none"
        style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
      <button disabled={!nome.trim() || n === null}
        onClick={() => { aggiungi(nome.trim(), n!); setNome(''); setImporto(''); setAperto(false) }}
        className="min-h-11 px-3 text-[12.5px] font-bold text-white disabled:opacity-50"
        style={{ background: accento, borderRadius: t.rPill }}>OK</button>
    </div>
  )
}
