'use client'
// ============================================================================
// REVISIONE DI UN DOCUMENTO (Fase 4 · blocco 3, seconda revisione) — vista
// sulla logica pura di lib/spese/revisione: originali intatti e CUSTODITI,
// modifiche pendenti, correzioni alla conferma via RPC atomica.
// Regole di questa schermata:
//  · custodia ILLEGGIBILE all'apertura → si BLOCCA (niente originali
//    ricostruiti dal database come se la custodia fosse vuota);
//  · durante una richiesta i controlli di modifica sono DISABILITATI
//    (fieldset): la risposta non può sovrascrivere modifiche successive;
//  · categoria e sottocategoria correggono le CANONICHE (quelle con
//    precedenza nel contratto), con la coerenza categoria→sottocategoria;
//  · quantità (3 decimali, mai vuota: default 1), prezzo unitario
//    (3 decimali, può mancare), sconto (2 decimali, default 0);
//  · una voce nuova dall'esito incerto si risolve SOLO a mano;
//  · totale · somma · differenza nel piede FISSO, sempre in vista.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, ZoomIn, SlidersHorizontal } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Chip, Etichetta, Foglio } from './mattoni'
import type { PaginaFoto } from './FotoSheet'
import {
  aggiungiRiga, apriRevisione, avvisoCoerenzaRiga, blocchiConferma,
  bozzaCorrente, dubbiDi, modificaBozza, modificaRiga, modificaTotale,
  modifichePendenti, quadratura, riconciliaPresa, riconosciRigaIncerta,
  rigaCorrente, scegliCanonicaBozza, scegliCanonicaRiga,
  scegliSottoCanonicaBozza, scegliSottoCanonicaRiga, togliRigaNuova,
  totaliSorella, tracciaDa,
  type BozzaGrezza, type RigaGrezza, type StatoRevisione,
} from '@/lib/spese/revisione'
import {
  confermaRevisione, salvaModifiche, scartaRevisione,
  type ClienteRevisione, type EsitoRevisione,
} from '@/lib/spese/revisioneScrittura'
import type { DepositoRevisione } from '@/lib/spese/revisioneDurevole'
import {
  gestoreImporto, gestoreNumero, interpretaCampo, testoCampo, testoNumero,
  type RegolaCampo, type RegolaImporto, type RegolaNumero,
} from '@/lib/spese/campiImporto'
import { creaGuardiaInvio } from '@/lib/spese/scrittura'
import { etichettaMetodo } from '@/lib/spese/adattatore'

const eurCent = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €'
const METODI = ['contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro']
const NATURE = [['ordinaria', 'Ordinaria'], ['ricorrente', 'Ricorrente'], ['straordinaria', 'Straordinaria']] as const

type PropsRevisione = {
  documento: { id: string; supplier?: string | null; kind: string; doc_total: number | null; note?: string | null }
  bozze: BozzaGrezza[]
  righe: RigaGrezza[]
  gruppi: { id: string; name: string; ambito?: string | null }[]
  categorie: { id: string; name: string; group_id: string }[]
  canoniche: { id: string; name: string }[]
  sottoCanoniche: { id: string; name: string; canonical_category_id?: string | null }[]
  camere: { id: string; name: string }[]
  pagine: PaginaFoto[]
  firmaUrl: (storagePath: string) => Promise<string | null>
  cliente: ClienteRevisione
  deposito: DepositoRevisione
  fatto: (esito: 'confermato' | 'scartato' | 'salvato' | 'verifica') => void   // ricarica la pagina
  chiudi: () => void
}

// ---- guscio: prima si legge la CUSTODIA; se è illeggibile ci si FERMA -----
// (aprire con gli originali presi dal database sembrerebbe innocuo, ma dopo
// un Salva quel «originale» è già il valore corretto: la prima modifica
// sovrascriverebbe la traccia vera e le correzioni andrebbero perse).
// Se la traccia dice che un'operazione precedente è ancora ANNOTATA come
// in corso, la nuova schermata deve PRENDERE IN CARICO il documento
// esplicitamente prima di poter scrivere: la presa reclama la generazione
// nuova, così la sequenza vecchia si ferma da sola al prossimo passo.
export function RevisioneSheet(props: PropsRevisione) {
  const { documento, deposito, chiudi, fatto } = props
  const [lettura, setLettura] = useState(() => deposito.leggi(documento.id))
  const [preso, setPreso] = useState<StatoRevisione | null>(null)
  const [errorePresa, setErrorePresa] = useState<string | null>(null)
  if (lettura.errore) {
    return (
      <Foglio aria="Revisione bloccata: custodia illeggibile" chiudi={chiudi} scorrevole>
        <p className={`${DISPLAY} text-[19px] mb-2`} style={{ color: t.inchiostro }}>Un attimo: non apro la revisione</p>
        <div className="mb-3 px-3 py-2 text-[13px] font-semibold" role="alert"
          style={{ background: t.terraTenue, color: t.rosso, borderRadius: t.r }}>
          Non riesco a leggere la custodia locale delle correzioni ({lettura.errore}).
          Aprire adesso userebbe i valori del database come «originali» e le
          correzioni già fatte andrebbero perse: riprovo a leggere, non tiro a indovinare.
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={chiudi} className="flex-1 min-h-12 text-[14px] font-bold"
            style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }}>
            Chiudi
          </button>
          <button onClick={() => setLettura(deposito.leggi(documento.id))}
            className="flex-[2] min-h-12 text-[14px] font-bold text-white"
            style={{ background: t.verde, borderRadius: t.rPill }}>
            Riprova a leggere
          </button>
        </div>
      </Foglio>
    )
  }
  const inCorso = lettura.traccia?.inCorso
  if (inCorso && !preso) {
    const nome = inCorso.tipo === 'salva' ? 'un salvataggio' : inCorso.tipo === 'conferma' ? 'una conferma' : 'uno scarto'
    return (
      <Foglio aria="Revisione: presa in carico" chiudi={chiudi} scorrevole>
        <p className={`${DISPLAY} text-[19px] mb-2`} style={{ color: t.inchiostro }}>Prima di aprire</p>
        <div className="mb-3 px-3 py-2 text-[13px] font-semibold" role="alert"
          style={{ background: t.terraTenue, color: t.inchiostro, borderRadius: t.r }}>
          Nella sessione precedente {nome}{' '}è rimasto annotato come in corso: la sua
          richiesta potrebbe essere ancora per aria. Riprendere il documento è
          possibile SOLO quando l&apos;esito di quell&apos;operazione risulta nei dati
          (una richiesta già partita non si può annullare da qui): adesso lo verifico.
        </div>
        {errorePresa && (
          <div className="mb-3 px-3 py-2 text-[13px] font-semibold" role="alert"
            style={{ background: t.terraTenue, color: t.rosso, borderRadius: t.r }}>{errorePresa}</div>
        )}
        <div className="flex gap-2 mb-4">
          <button onClick={() => fatto('verifica')} className="flex-1 min-h-12 text-[14px] font-bold"
            style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }}>
            Chiudi e ricarica
          </button>
          <button onClick={() => {
            // la presa è consentita SOLO a esito DIMOSTRATO sui dati
            // freschi: aumentare la generazione ferma le chiamate future
            // della vecchia sequenza, ma non una richiesta già partita —
            // finché il suo effetto non si vede, si resta bloccati
            const presa = riconciliaPresa(lettura.traccia!, documento.doc_total, props.bozze, props.righe)
            if (!presa.dimostrata) {
              setErrorePresa(`l'esito non è ancora dimostrabile per: ${presa.inAttesa.join(' · ')}. `
                + 'Resto bloccato: ricarica tra qualche istante e riprova — una rilettura sola non esclude un arrivo tardivo. '
                + 'Se non si dimostrasse mai, la pendenza si chiuderà solo col contratto idempotente (proposta 0023).')
              return
            }
            const stato = apriRevisione(documento.id, documento.doc_total, props.bozze, props.righe, lettura.traccia ?? null)
            const r = deposito.salva(tracciaDa(stato))
            if (r.errore) setErrorePresa(`non riesco a prendere in carico il documento (${r.errore}): riprova`)
            else setPreso(stato)
          }}
            className="flex-[2] min-h-12 text-[14px] font-bold text-white"
            style={{ background: t.verde, borderRadius: t.rPill }}>
            Verifica e riprendi
          </button>
        </div>
      </Foglio>
    )
  }
  return <RevisioneAperta {...props} statoIniziale={
    preso ?? apriRevisione(documento.id, documento.doc_total, props.bozze, props.righe, lettura.traccia ?? null)
  } />
}

function RevisioneAperta({ documento, gruppi, categorie, canoniche, sottoCanoniche, camere, pagine, firmaUrl, cliente, deposito, fatto, chiudi, statoIniziale }: PropsRevisione & { statoIniziale: StatoRevisione }) {
  const [stato, setStato] = useState<StatoRevisione>(statoIniziale)
  const [avvisoCustodia, setAvvisoCustodia] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [nota, setNota] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState(false)
  const [daVerificare, setDaVerificare] = useState(false)
  const [scartoAperto, setScartoAperto] = useState(false)
  const [motivoScarto, setMotivoScarto] = useState('')
  const [zoom, setZoom] = useState<{ url: string; grande: boolean; pdf: boolean } | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [dettagli, setDettagli] = useState<Record<string, boolean>>({})
  // i testi in modifica, ciascuno con la SUA regola
  const [testi, setTesti] = useState<Record<string, { testo: string; regola: RegolaCampo }>>({})
  const guardia = useRef(creaGuardiaInvio())

  // ogni cambiamento va in custodia: un salvataggio interrotto o una
  // chiusura non perdono nulla (l'errore di custodia si DICE)
  const custodiaAvviata = useRef(false)
  useEffect(() => {
    if (!custodiaAvviata.current && !modifichePendenti(stato)) return
    custodiaAvviata.current = true
    const r = deposito.salva(tracciaDa(stato))
    setAvvisoCustodia(r.errore
      ? `non riesco a custodire le modifiche sul dispositivo (${r.errore}): se chiudi ora le perdi — il Salva resterà comunque protetto`
      : null)
  }, [stato, deposito])

  const ambitoDi = useMemo(() => {
    const m = new Map(gruppi.map(g => [g.id, (g.ambito === 'azienda' ? 'azienda' : 'personale') as 'personale' | 'azienda']))
    return (id: string | null) => (id ? m.get(id) ?? 'personale' : 'personale')
  }, [gruppi])
  const nomeCategoria = useMemo(() => new Map(categorie.map(c => [c.id, c.name])), [categorie])
  const q = quadratura(stato)
  // la somma VERA delle righe (quadraturaDocumento la azzera quando manca
  // il totale: a schermo sarebbe fuorviante)
  const sommaCent = stato.bozze.reduce((a, b) => a + totaliSorella(stato, b.id).totaleCent, 0)
  const blocchi = blocchiConferma(stato, ambitoDi, sottoCanoniche)
  const invalidi = [...new Set(Object.values(testi)
    .map(v => interpretaCampo(v.regola, v.testo))
    .filter(e => e.tipo === 'invalido')
    .map(e => e.perche!))]

  const apriFoto = async (p: PaginaFoto) => {
    const url = urls[p.id] ?? await firmaUrl(p.storage_path)
    if (!url) { setErrore(`non riesco ad aprire la pagina ${p.page_order}: riprova`); return }
    setUrls(prev => ({ ...prev, [p.id]: url }))
    setZoom({ url, grande: false, pdf: p.tipo === 'application/pdf' })
  }

  const stileCampo = (invalido: boolean) => ({
    background: t.carta, borderRadius: t.rPill,
    border: invalido ? `1.5px solid ${t.rosso}` : t.bordoCarta,
    color: invalido ? t.rosso : t.inchiostro,
  })

  // campo in CENTESIMI (totale, riga, arrotondamento)
  const campoImporto = (chiave: string, regola: RegolaImporto, correnteCent: number | null, applica: (cent: number | null) => void) => {
    const testo = testi[chiave]?.testo ?? testoCampo(regola, correnteCent)
    const invalido = testi[chiave] != null && interpretaCampo(regola, testi[chiave].testo).tipo === 'invalido'
    return (
      <input inputMode="decimal" value={testo}
        placeholder={regola === 'arrotondamento' ? '±0,00' : '0,00'}
        aria-invalid={invalido}
        onChange={e => {
          const v = e.target.value
          setTesti(prev => ({ ...prev, [chiave]: { testo: v, regola } }))
          gestoreImporto(regola, applica)(v)
        }}
        className="w-20 min-h-11 px-2 text-[13.5px] text-right tabular-nums outline-none"
        style={stileCampo(invalido)} />
    )
  }

  // campo NUMERICO fedele alla 0020 (quantità/prezzo unitario/sconto)
  const campoNumero = (chiave: string, regola: RegolaNumero, corrente: number | null, applica: (valore: number | null) => void) => {
    const testo = testi[chiave]?.testo ?? testoNumero(corrente)
    const invalido = testi[chiave] != null && interpretaCampo(regola, testi[chiave].testo).tipo === 'invalido'
    return (
      <input inputMode="decimal" value={testo}
        placeholder={regola === 'quantita' ? '1' : regola === 'sconto' ? '0' : '—'}
        aria-invalid={invalido}
        onChange={e => {
          const v = e.target.value
          setTesti(prev => ({ ...prev, [chiave]: { testo: v, regola } }))
          gestoreNumero(regola, applica)(v)
        }}
        className="w-full min-h-11 px-2 text-[13.5px] text-right tabular-nums outline-none font-normal"
        style={stileCampo(invalido)} />
    )
  }

  // le CANONICHE (con precedenza nel contratto). Perché la SCELTA sia
  // davvero effettiva anche le STORICHE che riaffiorerebbero nella catena
  // di ripiego vengono azzerate dal chiamante (suCategoria/suSotto);
  // le assegnazioni delle ALTRE voci non si toccano mai.
  const selettoreCanonica = (
    valore: { canonical_category_id: string | null; canonical_subcategory_id: string | null },
    suCategoria: (id: string | null) => void,
    suSotto: (id: string | null) => void,
    vuotoCat: string, vuotoSotto: string,
    storiche?: { categoria?: string | null; sottocategoria?: string | null },
  ) => {
    // DIPENDENZA DICHIARATA: senza il catalogo canonico non c'è nulla da
    // proporre — lo si dice, NON si popola il database da qui
    if (canoniche.length === 0) {
      return (
        <p className="mb-2 px-2 py-1.5 text-[11.5px] font-semibold" role="note"
          style={{ background: t.velo, color: t.sub, borderRadius: t.r }}>
          il catalogo delle categorie canoniche è vuoto: qui valgono le storiche
          {storiche?.categoria ? ` (${storiche.categoria}${storiche.sottocategoria ? ` · ${storiche.sottocategoria}` : ''})` : ''} —
          per correggerle da questa schermata serve prima il catalogo
        </p>
      )
    }
    const sottoDellaCat = sottoCanoniche.filter(x => x.canonical_category_id === valore.canonical_category_id)
    return (
      <div className="flex gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <Etichetta>Categoria</Etichetta>
          <select value={valore.canonical_category_id ?? ''}
            onChange={e => suCategoria(e.target.value || null)}
            className="w-full min-h-11 px-2 text-[13.5px] outline-none"
            style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }}>
            <option value="">{vuotoCat}</option>
            {canoniche.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          {!valore.canonical_category_id && storiche?.categoria && (
            <p className="text-[10.5px] px-2 mt-0.5" style={{ color: t.sub }}>oggi vale la storica: {storiche.categoria}</p>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Etichetta>Sottocategoria</Etichetta>
          <select value={valore.canonical_subcategory_id ?? ''} disabled={!valore.canonical_category_id}
            onChange={e => suSotto(e.target.value || null)}
            className="w-full min-h-11 px-2 text-[13.5px] outline-none disabled:opacity-50"
            style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }}>
            <option value="">{vuotoSotto}</option>
            {sottoDellaCat.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          {!valore.canonical_subcategory_id && storiche?.sottocategoria && (
            <p className="text-[10.5px] px-2 mt-0.5" style={{ color: t.sub }}>storica: {storiche.sottocategoria}</p>
          )}
        </div>
      </div>
    )
  }

  const esegui = (azione: () => Promise<EsitoRevisione>) => guardia.current(async () => {
    setErrore(null); setNota(null); setLavoro(true)
    try {
      const esito = await azione()
      // i controlli sono DISABILITATI durante l'attesa (fieldset): questo
      // stato non può sovrascrivere modifiche fatte nel frattempo
      setStato(esito.stato)
      if (!esito.ok) {
        setErrore(esito.errore)                          // modifiche INTATTE
        if (esito.incerto) setDaVerificare(true)         // stop: prima si riconcilia
      } else if (esito.avviso) setNota(esito.avviso)
      return esito.ok
    } finally { setLavoro(false) }
  })

  const fermo = lavoro || daVerificare

  return (
    <Foglio aria={`Revisione: ${documento.supplier || 'documento'}`} chiudi={chiudi} scorrevole
      piede={
        <div className="flex flex-col gap-1.5">
          {/* ---- totale · somma · differenza: nel piede FISSO, sempre in vista ---- */}
          <div className="flex items-center justify-between px-1 text-[12.5px] font-bold">
            <span style={{ color: t.sub }}>
              totale {stato.docTotaleCent == null ? '—' : eurCent(stato.docTotaleCent)} · righe+arrot. {eurCent(sommaCent)}
            </span>
            <span className="tabular-nums" style={{ color: q.ok ? t.verde : t.rosso }}>
              {q.ok ? '✓ quadra' : q.diffCent == null ? 'totale mancante'
                : q.diffCent > 0 ? `mancano ${eurCent(q.diffCent)}` : `${eurCent(-q.diffCent)} di troppo`}
            </span>
          </div>
          {invalidi.map(m => (
            <p key={m} className="text-[12px] font-semibold px-1" role="alert" style={{ color: t.rosso }}>⛔ {m}</p>
          ))}
          {blocchi.map(b => (
            <p key={b} className="text-[12px] font-semibold px-1" role="alert" style={{ color: t.rosso }}>⛔ {b}</p>
          ))}
          {daVerificare ? (
            <button onClick={() => fatto('verifica')}
              className="w-full min-h-12 text-[14px] font-bold text-white"
              style={{ background: t.inchiostro, borderRadius: t.rPill }}>
              Chiudi e ricontrolla
            </button>
          ) : (
            <div className="flex gap-2">
              <button disabled={fermo || !modifichePendenti(stato) || invalidi.length > 0}
                onClick={() => esegui(async () => {
                  const r = await salvaModifiche(cliente, deposito, stato)
                  if (r.ok) { setNota('Modifiche salvate: puoi continuare o confermare.'); fatto('salvato') }
                  return r
                })}
                className="flex-1 min-h-12 text-[14px] font-bold disabled:opacity-50"
                style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }}>
                Salva
              </button>
              <button disabled={fermo || blocchi.length > 0 || invalidi.length > 0}
                onClick={() => esegui(async () => {
                  const r = await confermaRevisione(cliente, deposito, stato)
                  if (r.ok) fatto('confermato')
                  return r
                })}
                className="flex-[2] min-h-12 text-[15px] font-bold text-white disabled:opacity-50"
                style={{ background: t.verde, borderRadius: t.rPill }}>
                {lavoro ? 'Un attimo…' : 'Conferma le spese'}
              </button>
            </div>
          )}
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
      {nota && (
        <div className="mb-3 px-3 py-2 text-[13px] font-semibold" role="status"
          style={{ background: t.verdeTenue, color: t.inchiostro, borderRadius: t.r }}>{nota}</div>
      )}
      {avvisoCustodia && (
        <div className="mb-3 px-3 py-2 text-[12.5px] font-semibold" role="alert"
          style={{ background: t.terraTenue, color: t.inchiostro, borderRadius: t.r }}>{avvisoCustodia}</div>
      )}

      {/* durante una richiesta E dopo un esito incerto TUTTI i controlli
          di modifica sono spenti: la risposta non può calpestare modifiche
          fatte nell'attesa, e le modifiche custodite restano ESATTAMENTE
          quelle inviate (serve alla riconciliazione della presa in carico) */}
      <fieldset disabled={fermo} style={{ display: 'contents' }}>

      {/* ---- foto e pagine, con zoom (il TIPO si conserva: i PDF sono PDF) ---- */}
      {pagine.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {[...pagine].sort((a, b) => a.page_order - b.page_order).map(p => (
            <button key={p.id} onClick={() => apriFoto(p)} aria-label={`Apri la pagina ${p.page_order} con lo zoom`}
              className="relative shrink-0 grid place-items-center w-20 h-24"
              style={{ background: t.velo, borderRadius: t.r, border: t.bordoCarta }}>
              <ZoomIn size={18} style={{ color: t.sub }} />
              <span className="absolute bottom-1 text-[10px]" style={{ color: t.sub }}>
                {p.tipo === 'application/pdf' ? `PDF ${p.page_order}` : `pagina ${p.page_order}`}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ---- totale documento, modificabile (il riepilogo vive nel piede) ---- */}
      <div className="mb-3 p-3" style={{ background: q.ok ? t.verdeTenue : t.terraTenue, borderRadius: t.r }}>
        <div className="flex items-center justify-between min-h-11">
          <span className="text-[13px] font-bold" style={{ color: t.inchiostro }}>Totale documento</span>
          {campoImporto('doc_total', 'totale', stato.docTotaleCent, cent => setStato(s => modificaTotale(s, cent)))}
        </div>
        <div className="flex justify-between text-[12.5px]" style={{ color: t.sub }}>
          <span>somma delle righe + arrotondamenti</span>
          <span className="tabular-nums font-semibold">{eurCent(sommaCent)}</span>
        </div>
        <div className="flex justify-between text-[13px] font-bold" style={{ color: q.ok ? t.verde : t.rosso }}>
          <span>{q.ok ? '✓ quadra al centesimo' : q.diffCent == null ? 'totale del documento mancante' : 'differenza'}</span>
          {!q.ok && q.diffCent != null && <span className="tabular-nums">{eurCent(q.diffCent)}</span>}
        </div>
      </div>

      {/* ---- le sorelle: Casa Mia e Casa Ania separate ---- */}
      {stato.bozze.map(b => {
        const c = bozzaCorrente(stato, b.id)
        // l'ambito della PARTE è quello originale: i destinatari proposti
        // restano coerenti (mai gruppi dell'altro ambito sulla sorella)
        const ambito = ambitoDi(b.group_id ?? c.group_id)
        const accento = ambito === 'azienda' ? t.terracotta : t.verde
        const gruppiSorella = gruppi.filter(g => !b.group_id || ambitoDi(g.id) === ambito)
        const tot = totaliSorella(stato, b.id)
        const dubbi = dubbiDi(b.confidence)
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
              {gruppiSorella.map(g => (
                <Chip key={g.id} attivo={c.group_id === g.id} colore={accento}
                  onClick={() => setStato(s => modificaBozza(s, b.id, { group_id: g.id }))}>
                  {g.name}
                </Chip>
              ))}
            </div>
            {selettoreCanonica(
              { canonical_category_id: c.canonical_category_id, canonical_subcategory_id: c.canonical_subcategory_id },
              id => setStato(s => modificaBozza(s, b.id, scegliCanonicaBozza(id))),
              id => setStato(s => modificaBozza(s, b.id, scegliSottoCanonicaBozza(id))),
              '—', 'Non specificata',
              { categoria: c.category_id ? nomeCategoria.get(c.category_id) : null, sottocategoria: c.subcategory },
            )}
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
              const coerenza = avvisoCoerenzaRiga(rc)
              return (
                <div key={r.id} className="py-1.5" style={{ opacity: rc.excluded ? 0.45 : 1 }}>
                  <div className="flex items-center gap-2">
                    <input value={rc.name}
                      onChange={e => setStato(s => modificaRiga(s, r.id, { name: e.target.value }))}
                      className="flex-1 min-w-0 min-h-11 px-3 text-[13.5px] outline-none"
                      style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
                    {campoImporto(`riga-${r.id}`, 'riga', Math.round(rc.amount * 100),
                      cent => setStato(s => modificaRiga(s, r.id, { amount: (cent ?? 0) / 100 })))}
                    <button onClick={() => setDettagli(d => ({ ...d, [r.id]: !d[r.id] }))}
                      aria-label={`Dettagli di ${rc.name}`} aria-expanded={!!dettagli[r.id]}
                      className="min-h-11 min-w-11 grid place-items-center"
                      style={{ color: dettagli[r.id] ? accento : t.sub }}>
                      <SlidersHorizontal size={16} />
                    </button>
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
                    {rc.qty !== 1 ? ` · ×${testoNumero(rc.qty)}` : ''}
                    {rc.excluded ? ' · esclusa dal conto' : ''}
                  </p>
                  {dubbiRiga.map(d => (
                    <p key={d.campo} className="text-[11.5px] mx-3 mt-0.5 px-2 py-1 font-semibold"
                      style={{ background: t.terraTenue, color: t.inchiostro, borderRadius: t.r }}>
                      dubbio su «{d.campo}» — {d.motivo}
                    </p>
                  ))}
                  {coerenza && (
                    <p className="text-[11.5px] mx-3 mt-0.5 px-2 py-1 font-semibold" role="note"
                      style={{ background: t.terraTenue, color: t.inchiostro, borderRadius: t.r }}>
                      da controllare: {coerenza}
                    </p>
                  )}
                  {dettagli[r.id] && (
                    <div className="mx-1 mt-1.5 p-2" style={{ background: t.velo, borderRadius: t.r }}>
                      <Etichetta>Di chi è questa voce</Etichetta>
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        <Chip attivo={!rc.group_id} colore={accento}
                          onClick={() => setStato(s => modificaRiga(s, r.id, { group_id: null }))}>
                          Come la parte
                        </Chip>
                        {gruppiSorella.map(g => (
                          <Chip key={g.id} attivo={rc.group_id === g.id} colore={accento}
                            onClick={() => setStato(s => modificaRiga(s, r.id, { group_id: g.id }))}>
                            {g.name}
                          </Chip>
                        ))}
                      </div>
                      {selettoreCanonica(
                        { canonical_category_id: rc.canonical_category_id, canonical_subcategory_id: rc.canonical_subcategory_id },
                        id => setStato(s => modificaRiga(s, r.id, scegliCanonicaRiga(id))),
                        id => setStato(s => modificaRiga(s, r.id, scegliSottoCanonicaRiga(id))),
                        'Come la parte', 'Come la parte',
                        { categoria: rc.category_id ? nomeCategoria.get(rc.category_id) : null, sottocategoria: rc.subcategory },
                      )}
                      <div className="flex items-start gap-2">
                        <label className="flex-1 text-[11.5px] font-bold" style={{ color: t.sub }}>Quantità
                          <div className="mt-0.5">{campoNumero(`qty-${r.id}`, 'quantita', rc.qty,
                            v => setStato(s => modificaRiga(s, r.id, { qty: v ?? 1 })))}</div>
                        </label>
                        <label className="flex-1 text-[11.5px] font-bold" style={{ color: t.sub }}>Prezzo unit.
                          <div className="mt-0.5">{campoNumero(`pu-${r.id}`, 'prezzo_unitario', rc.unit_price,
                            v => setStato(s => modificaRiga(s, r.id, { unit_price: v })))}</div>
                        </label>
                        <label className="flex-1 text-[11.5px] font-bold" style={{ color: t.sub }}>Sconto
                          <div className="mt-0.5">{campoNumero(`sc-${r.id}`, 'sconto', rc.discount === 0 ? null : rc.discount,
                            v => setStato(s => modificaRiga(s, r.id, { discount: v ?? 0 })))}</div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {stato.righeNuove.filter(r => r.draft_id === b.id).map(r => (
              <div key={r.idLocale} className="py-1.5"
                style={{ opacity: r.stato === 'incerta' || r.stato === 'in_invio' ? 0.75 : r.stato === 'riconosciuta' ? 0.6 : 1 }}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 px-3 text-[13.5px]" style={{ color: t.inchiostro }}>{r.name}
                    <span className="text-[10.5px] block" style={{ color: r.stato === 'incerta' || r.stato === 'in_invio' ? t.rosso : t.sub }}>
                      {r.stato === 'nuova' ? 'nuova, da salvare'
                        : r.stato === 'salvata' ? 'aggiunta e salvata ✓'
                          : r.stato === 'in_invio' ? 'invio in corso…'
                            : r.stato === 'riconosciuta' ? 'collegata alla voce comparsa (annotazione: l\'esito dell\'invio resta non dimostrato)'
                              : 'esito incerto: non so se è stata inserita'}
                    </span></span>
                  <span className="tabular-nums text-[13.5px] font-semibold" style={{ color: t.inchiostro }}>{eurCent(Math.round(r.amount * 100))}</span>
                  {r.stato === 'nuova' && (
                    <button onClick={() => setStato(s => togliRigaNuova(s, r.idLocale))} aria-label={`Togli ${r.name}`}
                      className="min-h-11 min-w-11 text-[12px] font-bold" style={{ color: t.rosso }}>✕</button>
                  )}
                </div>
                {r.stato === 'incerta' && !daVerificare && (
                  r.gemella ? (
                    <div className="mx-3 mt-1">
                      <button onClick={() => setStato(s => riconosciRigaIncerta(s, r.idLocale))}
                        className="w-full min-h-11 px-2 text-[11.5px] font-bold text-white"
                        style={{ background: accento, borderRadius: t.rPill }}>
                        Collega alla voce identica qui sopra (solo annotazione)
                      </button>
                    </div>
                  ) : (
                    // NESSUNA scorciatoia: la pendenza non si può cancellare
                    // fingendo che sia risolta — resta e blocca la conferma
                    <p className="mx-3 mt-1 px-2 py-1.5 text-[11px] font-semibold"
                      style={{ background: t.terraTenue, color: t.inchiostro, borderRadius: t.r }}>
                      resta in attesa: l&apos;esito si potrà dimostrare solo col contratto
                      idempotente (proposta 0023); se comparirà una voce identica potrai
                      collegarla come annotazione
                    </p>
                  )
                )}
              </div>
            ))}
            <AggiungiVoce accento={accento} aggiungi={(nome, importoCent) =>
              setStato(s => aggiungiRiga(s, { draft_id: b.id, name: nome, amount: importoCent / 100 }, crypto.randomUUID()))} />

            <div className="flex items-center justify-between mt-1 pt-2" style={{ borderTop: t.bordoCarta }}>
              <span className="text-[12.5px]" style={{ color: t.sub }}>arrotondamento (± cent)</span>
              {campoImporto(`arr-${b.id}`, 'arrotondamento', c.arrotondamento_cent ?? 0,
                cent => setStato(s => modificaBozza(s, b.id, { arrotondamento_cent: cent ?? 0 })))}
            </div>
          </section>
        )
      })}

      {/* ---- scarto, col motivo ---- */}
      {!scartoAperto ? (
        <button onClick={() => setScartoAperto(true)} disabled={fermo}
          className="w-full min-h-11 mb-4 text-[13px] font-bold disabled:opacity-50" style={{ color: t.rosso }}>
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
            <button disabled={fermo} onClick={() => guardia.current(async () => {
              setErrore(null); setLavoro(true)
              try {
                const r = await scartaRevisione(cliente, deposito, stato, motivoScarto)
                if (r.ok) fatto('scartato')
                else { setErrore(r.errore ?? 'errore'); if (r.incerto) setDaVerificare(true) }
                return r.ok
              } finally { setLavoro(false) }
            })}
              className="flex-1 min-h-11 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: t.rosso, borderRadius: t.rPill }}>
              Scarta davvero
            </button>
          </div>
        </div>
      )}

      </fieldset>

      {/* ---- zoom della pagina: immagine (2 livelli) o PDF nel suo visore ---- */}
      {zoom && (
        <div className="fixed inset-0 z-[80] overflow-auto" style={{ background: 'rgba(10,12,10,.92)' }}
          onClick={() => zoom.pdf ? undefined : setZoom(z => z && !z.grande ? { ...z, grande: true } : null)}>
          <button onClick={e => { e.stopPropagation(); setZoom(null) }} aria-label="Chiudi lo zoom"
            className="fixed top-2 right-2 z-[81] grid place-items-center w-11 h-11 text-white"
            style={{ background: 'rgba(20,25,20,.8)', borderRadius: 99 }}>
            <X size={20} />
          </button>
          {zoom.pdf ? (
            <div className="p-3 pt-16 h-full flex flex-col">
              <iframe src={zoom.url} title="Documento PDF"
                className="w-full flex-1" style={{ borderRadius: t.r, background: '#fff' }} />
              <a href={zoom.url} target="_blank" rel="noreferrer"
                className="block text-center text-[13px] font-bold text-white min-h-11 leading-[44px]">
                Apri il PDF a tutto schermo
              </a>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- link firmato temporaneo */}
              <img src={zoom.url} alt="Documento ingrandito"
                onError={() => { setZoom(null); setErrore('non riesco a mostrare la pagina: il collegamento potrebbe essere scaduto — riprova') }}
                className={zoom.grande ? 'max-w-none w-[250%]' : 'w-full h-auto'}
                style={{ cursor: zoom.grande ? 'zoom-out' : 'zoom-in' }} />
              <p className="fixed bottom-2 inset-x-0 text-center text-[12px] text-white/80">
                {zoom.grande ? 'tocca per chiudere' : 'tocca per ingrandire'}
              </p>
            </>
          )}
        </div>
      )}
    </Foglio>
  )
}

// mini-modulo per una voce nuova (nome + importo con la regola delle
// righe: mai vuoto, mai zero; tocchi ≥44)
function AggiungiVoce({ accento, aggiungi }: { accento: string; aggiungi: (nome: string, importoCent: number) => void }) {
  const [aperto, setAperto] = useState(false)
  const [nome, setNome] = useState('')
  const [importo, setImporto] = useState('')
  if (!aperto) return (
    <button onClick={() => setAperto(true)} className="flex items-center gap-1.5 min-h-11 px-2 text-[12.5px] font-bold"
      style={{ color: accento }}>
      <Plus size={15} /> Aggiungi una voce
    </button>
  )
  const esito = interpretaCampo('riga', importo)
  return (
    <div className="flex items-center gap-2 py-1.5">
      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="nome della voce"
        className="flex-1 min-w-0 min-h-11 px-3 text-[13.5px] outline-none"
        style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
      <input value={importo} onChange={e => setImporto(e.target.value)} placeholder="€" inputMode="decimal"
        className="w-20 min-h-11 px-2 text-[13.5px] text-right outline-none"
        style={{ background: t.velo, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
      <button disabled={!nome.trim() || esito.tipo !== 'valido'}
        onClick={() => {
          let centValidi: number | null = null
          gestoreImporto('riga', c => { centValidi = c })(importo)
          if (centValidi != null) {
            aggiungi(nome.trim(), centValidi); setNome(''); setImporto(''); setAperto(false)
          }
        }}
        className="min-h-11 px-3 text-[12.5px] font-bold text-white disabled:opacity-50"
        style={{ background: accento, borderRadius: t.rPill }}>OK</button>
    </div>
  )
}
