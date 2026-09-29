'use client'
import { hrefScheda } from '@/lib/provenienzaScheda'
// ============================================================================
// LE RICHIESTE «MAISON» (riferimento approvato da Ania il 29/09/2026:
// docs/design/richieste-riferimento.html, checklist in
// docs/design/richieste-checklist.md).
//
// Sopra il calendario delle richieste (components/richieste/NastroRichieste:
// il nastro del Calendario, «Vista · Reale | Presunta», le richieste
// tratteggiate, il foglietto al tocco); sotto l'ELENCO A RIGHE separate da un
// filo: etichetta d'ottone, nome e date in Cormorant, il TELEFONO per esteso
// coi due cerchi (novità 14c), notti · persone · camera · speso, il timer
// della proposta, la nota in mattone, le azioni sottolineate. In fondo le
// chiuse degli ultimi 3 giorni. Il comportamento è quello di sempre.
// ============================================================================
import { Suspense, useEffect, useMemo, useState } from 'react'
import { soggiorniDellaPersona, clienteDellaRichiesta, type SoggiornoStorico } from '@/lib/clienteCheTorna'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import BackLink from '@/components/BackLink'
import TestaPagina from '@/components/TestaPagina'
import FasciaComandi from '@/components/richieste/FasciaComandi'
import NastroRichieste, { type PrenotazioneRichieste } from '@/components/richieste/NastroRichieste'
import FogliettoRichiesta from '@/components/richieste/FogliettoRichiesta'
import { IconeContatto } from '@/components/scheda/TestataMaison'
import { camereLibere } from '@/lib/richiesteNastro'
import { barreTenute, type RichiestaTenuta } from '@/lib/calendarioOpzioni'
import CampoRicerca from '@/components/CampoRicerca'
import { matchNome, matchTelefono } from '@/lib/ricerca'
import RifiutaConMotivo from '@/components/richieste/RifiutaConMotivo'
import type { MotivoRifiuto } from '@/lib/motivoRifiuto'
import FinestraConferma from '@/components/richieste/FinestraConferma'
import type { RichiestaConProposta } from '@/lib/richiesteConferma'
import { supabase } from '@/lib/supabase'
import { fetchRichieste, rifiutaRichiesta, riapriRichiesta, ricaricaRichiesteAperte } from '@/lib/richiesteDati'
import AvvisoAzione from '@/components/AvvisoAzione'
import { useVista, useDesktop, useAdesso, useOrizzontaleTelefono, useSchermoIntero } from '@/lib/richiesteVista'
import { sovrapposizioni } from '@/lib/richiesteCalendario'
import { altreStesseDate, gruppoStesseDate, etichettaAltre, sottotitoloGruppo, contatoreGruppo, VEDI_TUTTE } from '@/lib/richiesteStesseDate'
import { personePerNotte } from '@/lib/richiesteProposta'
import { pezziRigaElenco, titoloRigaRichiesta, etichettaRigaRichiesta, pezzoCliente } from '@/lib/rigaRichiesta'
import { periodoConGiorni } from '@/lib/dateItaliane'
import { periodoConMese } from '@/lib/schedaPrenotazione'
import { iconeFoglietto } from '@/lib/calendarioFoglietto'
import { smartBack } from '@/lib/navHistory'
import { nomeOspite } from '@/lib/guestName'
import { telefonoPerEsteso } from '@/lib/whatsapp'
import type { Room } from '@/lib/types'
import {
  CANALE_LABEL, eAperta, inArchivio, rigaChiusa, riapribile, ordinaRichieste, nottiRichiesta, nomeCompleto,
  formatIntervallo, formatDateRichiesta, avvisoFerma, daGuardare, scadenzaProposta, tastoRichiesta, type Richiesta, type OrdineRichieste,
} from '@/lib/richieste'

const oggiIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// La riga del cliente come arriva dall'archivio: id e nome per riconoscerla,
// valutazione e ricevuta per i segni accanto al nome.
type ClienteSchedato = { id?: string; full_name?: string | null; phone?: string | null; rating?: string | null; vuole_ricevuta?: boolean | null }

// Quello che si sa della cliente, letto una volta sola dalla pagina
export type ClienteRiga = { volte: number; inArchivio: boolean; stella: boolean; ricevuta: boolean; totaleCent: number }
const CLIENTE_NUOVA: ClienteRiga = { volte: 0, inArchivio: false, stella: false, ricevuta: false, totaleCent: 0 }

// Il periodo di una richiesta come nel riferimento: «30 set → 3 ott»; le notti scelte a mano si elencano
const periodoRichiesta = (r: Richiesta) => (r.notti_richieste ? formatDateRichiesta(r) : periodoConMese(r.arrivo, r.partenza))

// ── Una richiesta dell'elenco (elenco A del riferimento) ────────────────────
//   OGGI · DAL SITO · GIÀ OSPITE 3 VOLTE  ⧉ 1 altra per le stesse date
//   🧾 ★ Anna Rinaldi · 30 set → 3 ott                    (Cormorant 19)
//   +39 347 812 6690  (☏) (💬)                            (Cormorant 17)
//   3 notti · 2 persone · qualsiasi camera · 640 € spesi   (speso in mattone)
//   Proposta inviata · scade tra 2 h 15 min · ferma da 3 giorni
//   «la nota del cliente»                                 (mattone)
//   INVIA PROPOSTA   MODIFICA   RIFIUTA
function RigaRichiesta({ r, adesso, conflitti, stesseDate, onGruppo, nelGruppo = false, selezionata, onSeleziona, onRifiuta, onConferma, cliente = CLIENTE_NUOVA }: { r: Richiesta; adesso: Date; conflitti: string[]; stesseDate?: string | null; onGruppo?: () => void; nelGruppo?: boolean; selezionata: boolean; onSeleziona: () => void; onRifiuta: (r: Richiesta) => void; onConferma: (r: Richiesta) => void; cliente?: ClienteRiga }) {
  const router = useRouter()
  // Le persone di ogni notte: con dati storti (persone_per_notte non coerente)
  // personePerNotte alza un errore e qui la riga non deve sparire.
  let personeNotti: number[]
  try { personeNotti = personePerNotte(r) } catch { personeNotti = [Math.max(1, Number(r.persone) || 1)] }
  const periodo = periodoRichiesta(r)
  const pezzi = pezziRigaElenco({ notti: nottiRichiesta(r), personeNotti, camera: r.rooms?.name ?? null, totaleCent: cliente.totaleCent, maison: true })
  // «oggi · dal sito · già ospite 3 volte»: quando è arrivata, da dove, e se la conosciamo già
  const etichetta = etichettaRigaRichiesta(r.created_at, r.canale, adesso, pezzoCliente(cliente.volte, cliente.inArchivio))
  const ferma = avvisoFerma(r, adesso)
  const scadenza = scadenzaProposta(r, adesso)
  const [primaScadenza, ...restoScadenza] = (scadenza?.testo ?? '').split(' · ')
  const telefono = telefonoPerEsteso(r.telefono)
  const icone = iconeFoglietto(cliente.ricevuta, cliente.stella)
  const nome = nomeCompleto(r)
  const tasto = tastoRichiesta(r.stato)
  const nota = (r.note ?? '').trim()
  return (
    <li id={`richiesta-${r.id}`} className={`ric-riga ${nelGruppo ? 'gruppo' : ''} ${selezionata ? 'scelta' : ''}`} data-riga-richiesta={r.id}>
      <div role="button" tabIndex={0} onClick={onSeleziona} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleziona() } }} aria-pressed={selezionata}>
        <p className="re" data-etichetta-richiesta>
          {etichetta}
          {stesseDate && onGruppo && (
            <>{' · '}<button type="button" data-stesse-date data-senza-sottolinea className="blu" onClick={e => { e.stopPropagation(); onGruppo() }}>⧉ {stesseDate} per le stesse date</button></>
          )}
        </p>
        <p className="rt" data-titolo-richiesta aria-label={titoloRigaRichiesta(nome, periodo)}>
          {icone && <span className="ic">{cliente.ricevuta && <span data-ricevuta aria-label="vuole la ricevuta">🧾</span>}{cliente.ricevuta && cliente.stella && ' '}{cliente.stella && <span data-stella aria-label="cliente ottima">★</span>}{' '}</span>}
          {nome} · <span className="per">{periodo}</span>
        </p>
        {telefono && (
          <div className="tel" data-telefono-richiesta onClick={e => e.stopPropagation()}>
            <span className="num">{telefono}</span>
            <IconeContatto telefono={r.telefono} nome={nome} dati="elenco" />
          </div>
        )}
        <p className="rd">
          {pezzi.map((x, i) => <span key={i} className={x.speso ? 'mat' : undefined}>{x.testo}</span>)}
        </p>
        {(scadenza || ferma) && (
          <p className="rm2" data-timer-richiesta>
            {scadenza && <>{primaScadenza}{restoScadenza.length > 0 && <> · <b>{restoScadenza.join(' · ')}</b></>}</>}
            {scadenza && ferma && ' · '}
            {ferma}
          </p>
        )}
        {conflitti.length > 0 && (
          <p className="rm2" title={conflitti.join(' · ')}>si sovrappone con {conflitti.join(', ')}</p>
        )}
        {nota && <p className="rn2" data-nota-cliente>«{nota}»</p>}
        {tasto && (
          <div className="ra" onClick={e => e.stopPropagation()}>
            <button type="button" className="mz-lnk" data-tasto-principale
              onClick={() => (r.stato === 'in_attesa' ? router.push(`/richieste/${r.id}/proposta`) : onConferma(r))}>{tasto}</button>
            <button type="button" className="mz-lnk q" data-comando="modifica" onClick={() => router.push(`/richieste/${r.id}/modifica`)}>Modifica</button>
            <button type="button" className="mz-lnk q" data-comando="rifiuta" onClick={() => onRifiuta(r)}>Rifiuta</button>
          </div>
        )}
      </div>
    </li>
  )
}

// ── Una chiusa (telefono 5 del riferimento) ─────────────────────────────────
// Etichetta di stato: scaduta e chiusa da sola in mattone, rifiutata da te in
// grigio, confermata in verde; nome e date in Cormorant, i dati, «Riapri»
// (scaduta, rifiutata) oppure «Apri la scheda» (confermata).
function RigaChiusa({ r, adesso, evidenziata = false, onRiapri, riaprendo }: { r: Richiesta; adesso: Date; evidenziata?: boolean; onRiapri: (r: Richiesta) => void; riaprendo: boolean }) {
  const stato = rigaChiusa(r, adesso)
  let personeNotti: number[]
  try { personeNotti = personePerNotte(r) } catch { personeNotti = [Math.max(1, Number(r.persone) || 1)] }
  const dati = pezziRigaElenco({ notti: nottiRichiesta(r), personeNotti, camera: r.rooms?.name ?? null, maison: true }).map(x => x.testo).join('')
  return (
    <li id={`richiesta-${r.id}`} data-chiusa={stato.tono} className={`ric-riga chiusa ${evidenziata ? 'scelta' : ''}`}>
      <div>
        <p className={`re ${stato.tono}`}>{stato.testo}</p>
        <p className="rt">{nomeCompleto(r)} · <span className="per">{periodoRichiesta(r)}</span></p>
        <p className="rd">{dati} · {CANALE_LABEL[r.canale]}</p>
        <div className="ra">
          {r.stato === 'confermata' && r.prenotazione_id && (
            <Link href={hrefScheda(r.prenotazione_id, 'richieste')} className="mz-lnk">Apri la scheda</Link>
          )}
          {riapribile(r) && (
            <button type="button" onClick={() => onRiapri(r)} disabled={riaprendo} className="mz-lnk" data-riapri>{riaprendo ? 'Riapro…' : 'Riapri'}</button>
          )}
        </div>
      </div>
    </li>
  )
}

// useSearchParams (?apri=) richiede un confine Suspense per la pagina statica
export default function Page() {
  return <Suspense><Richieste /></Suspense>
}

function Richieste() {
  const router = useRouter()
  // ?apri=<id>: arrivo dalla scheda prenotazione, archivio aperto e riga evidenziata
  const apriId = useSearchParams().get('apri')
  const [tutte, setTutte] = useState<Richiesta[]>([])
  const [camere, setCamere] = useState<Room[]>([])
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneRichieste[]>([])
  const [pagamenti, setPagamenti] = useState<{ booking_id: string; amount: number | string }[]>([])
  const [clienti, setClienti] = useState<ClienteSchedato[]>([])
  const [ordine, setOrdine] = useState<OrdineRichieste>('durata')
  // «Cerca nome o telefono…» (05/09/2026): filtra la lista; con un solo risultato lo evidenzia anche nel calendario
  const [query, setQuery] = useState('')
  // «N da guardare»: filtro sulle ferme (in attesa > 24 h, proposta > 48 h, arrivo passato) e sulle proposte scadute (3 h dall'invio)
  const [soloDaGuardare, setSoloDaGuardare] = useState(false)
  // Filtro «stesse date»: l'id della richiesta toccata. È solo della pagina,
  // non si ricorda uscendo e rientrando (Ania, 12/09/2026).
  const [gruppoDi, setGruppoDi] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errori, setErrori] = useState<string[]>([])
  // Parte 3 (05/09/2026): «Riprova» ricarica la pagina E il contatore della barra
  const [tentativo, setTentativo] = useState(0)
  // avanza ogni minuto: timer della proposta, «da guardare» e archivio si aggiornano da soli
  const adesso = useAdesso()
  const [vista, setVista] = useVista()
  const desktop = useDesktop()
  // Telefono in orizzontale: solo il calendario, a tutto schermo
  // (a 844 px il telefono girato conta già come «desktop»: la griglia del Mac riempie lo schermo)
  const orizzontale = useOrizzontaleTelefono()
  useSchermoIntero()
  // Richiesta selezionata dalla lista (evidenziata nel calendario) e pannello «chi c'è dentro»
  const [selezionata, setSelezionata] = useState<string | null>(null)
  const [pannello, setPannello] = useState<{ gruppo: Richiesta[]; ancora: { x: number; y: number } } | null>(null)
  // Dove portare il nastro (la richiesta trovata o scelta nell'elenco)
  const [vaiA, setVaiA] = useState<{ iso: string; n: number } | null>(null)
  const portaA = (iso: string) => setVaiA(v => ({ iso, n: (v?.n ?? 0) + 1 }))
  // Rifiuto: finestra di conferma, poi aggiornamento locale della riga
  const [daRifiutare, setDaRifiutare] = useState<Richiesta | null>(null)
  // Conferma → prenotazione (finestra «Creare la prenotazione?», poi la scheda)
  const [daConfermare, setDaConfermare] = useState<RichiestaConProposta | null>(null)
  const [rifiutando, setRifiutando] = useState(false)
  // «Riapri» dalla linguetta Chiuse (06/09/2026)
  const [riaprendo, setRiaprendo] = useState<string | null>(null)
  async function riapri(r: Richiesta) {
    if (riaprendo) return
    setRiaprendo(r.id)
    const { error } = await riapriRichiesta(r.id)
    setRiaprendo(null)
    if (error) { setErrori(e => [...e.filter(x => !x.startsWith('riapertura')), `riapertura: ${error}`]); return }
    setTutte(lista => lista.map(x => (x.id === r.id ? { ...x, stato: 'in_attesa', chiusa_at: null, proposta_inviata_at: null, chiusura_motivo: null, scadenza_notificata_at: null } : x)))
    void ricaricaRichiesteAperte()
  }

  // Rifiuta con motivo (07/09/2026): la finestra «Perché la rifiuti?» obbliga a scegliere il motivo
  async function confermaRifiuto(motivo: MotivoRifiuto) {
    if (!daRifiutare) return
    setRifiutando(true)
    const { chiusa_at, stato, error } = await rifiutaRichiesta(daRifiutare.id, motivo)
    setRifiutando(false)
    if (error) { setErrori(e => [...e.filter(x => !x.startsWith('rifiuto')), `rifiuto: ${error}`]); setDaRifiutare(null); return }
    const id = daRifiutare.id
    setTutte(lista => lista.map(r => (r.id === id ? { ...r, stato, chiusa_at, chiusura_motivo: stato === 'chiusa' ? 'rifiutata' : r.chiusura_motivo, motivo_rifiuto: motivo } : r)))
    setPannello(pan => (pan ? { ...pan, gruppo: pan.gruppo.filter(r => r.id !== id) } : pan))
    setSelezionata(s => (s === id ? null : s))
    setDaRifiutare(null)
  }

  useEffect(() => {
    // Stesse letture del calendario principale (camere attive, prenotazioni
    // con ospite, acconti) più le richieste. Ogni errore finisce a schermo.
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(*)').in('status', ['confermata', 'completata']),
      supabase.from('payments').select('booking_id, amount'),
      fetchRichieste(),
      // I clienti servono a riconoscere chi torna: valutazione, ricevuta e
      // scheda. `select('*')` regge anche senza la colonna vuole_ricevuta.
      supabase.from('guests').select('*'),
    ]).then(([r, b, pay, ric, g]) => {
      const errs: string[] = []
      if (r.error) errs.push(`camere: ${r.error.message}`)
      if (b.error) errs.push(`prenotazioni: ${b.error.message}`)
      if (pay.error) errs.push(`acconti: ${pay.error.message}`)
      if (ric.error) errs.push(`richieste: ${ric.error}`)
      if (g.error) errs.push(`clienti: ${g.error.message}`)
      setClienti((g.data || []) as ClienteSchedato[])
      setCamere((r.data || []) as Room[])
      setPrenotazioni((b.data || []) as unknown as PrenotazioneRichieste[])
      setPagamenti((pay.data || []) as { booking_id: string; amount: number | string }[])
      setTutte(ric.data)
      setErrori(errs)
      setLoading(false)
    })
  }, [tentativo])

  // Con la lettura delle richieste fallita la lista non mostra «Nessuna
  // richiesta…»: un errore non è mai «nessuna richiesta» (parte 3)
  const richiesteNonLette = errori.some(e => e.startsWith('richieste:'))

  function riprovaCaricamento() {
    setErrori([])
    setLoading(true)
    setTentativo(t => t + 1)
    void ricaricaRichiesteAperte(true)
  }

  useEffect(() => {
    if (loading || !apriId) return
    document.getElementById(`richiesta-${apriId}`)?.scrollIntoView({ block: 'center' })
  }, [loading, apriId])

  const aperte = useMemo(() => ordinaRichieste(tutte.filter(eAperta), ordine), [tutte, ordine])
  const ferme = useMemo(() => daGuardare(aperte, adesso), [aperte, adesso])
  const cercaTra = (lista: Richiesta[], q: string) => {
    const t = q.trim()
    if (!t) return lista
    return lista.filter(r => matchNome([r.nome, r.cognome, nomeCompleto(r)], t) || matchTelefono(r.telefono, t))
  }
  const trovate = useMemo(() => cercaTra(aperte, query), [aperte, query])
  // Quante ALTRE richieste aperte vogliono le stesse notti: il segno blu
  const altreDi = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of aperte) m.set(r.id, altreStesseDate(r, aperte).length)
    return m
  }, [aperte])
  // Col filtro attivo si vede solo quel gruppo, dalla più vecchia
  const capogruppo = gruppoDi ? aperte.find(r => r.id === gruppoDi) ?? null : null
  const gruppo = useMemo(() => (capogruppo ? gruppoStesseDate(capogruppo, aperte) : []), [capogruppo, aperte])
  const mostrate = capogruppo ? gruppo : soloDaGuardare ? cercaTra(ferme, query) : trovate
  function cambiaRicerca(v: string) {
    setQuery(v)
    const t = cercaTra(aperte, v)
    setSelezionata(v.trim() && t.length === 1 ? t[0].id : null)
    // il nastro va sulla prima richiesta trovata (in ordine di arrivo)
    const prima = [...t].sort((x, y) => x.arrivo.localeCompare(y.arrivo))[0]
    if (v.trim() && prima) portaA(prima.arrivo)
  }
  const archivio = useMemo(
    () => tutte.filter(r => inArchivio(r, adesso)).sort((a, b) => (b.chiusa_at ?? b.created_at).localeCompare(a.chiusa_at ?? a.created_at)),
    [tutte, adesso],
  )
  // Le chiuse si aprono con «Mostra»; arrivando da una scheda (?apri=) già aperte sulla riga
  const [chiuseAperte, setChiuseAperte] = useState<boolean | null>(null)
  const chiuseVisibili = chiuseAperte ?? (!!apriId && archivio.some(r => r.id === apriId))
  // Sul nastro restano piene le richieste trovate dalla ricerca, quella scelta
  // nell'elenco o quelle del foglietto aperto; il resto si attenua (0,35)
  const evidenziate = useMemo(() => {
    if (pannello) return pannello.gruppo.map(r => r.id)
    if (query.trim() && trovate.length > 0) return trovate.map(r => r.id)
    return selezionata ? [selezionata] : null
  }, [pannello, query, trovate, selezionata])

  // Chi è la cliente di ogni richiesta: quante volte è già stata qui, quanto
  // ha speso, se è ottima e se vuole la ricevuta (Ania, 12/09/2026). Il
  // riconoscimento è quello di sempre: telefono, oppure nome e cognome.
  const clienteDi = useMemo(() => {
    const m = new Map<string, ClienteRiga>()
    const oggi = oggiIso()
    const storico = prenotazioni as unknown as SoggiornoStorico[]
    for (const r of aperte) {
      const persona = { nome: r.nome, cognome: r.cognome, telefono: r.telefono }
      const g = clienteDellaRichiesta(persona, clienti)
      const s = soggiorniDellaPersona({ ...persona, guest_id: g?.id ?? null }, storico, oggi)
      m.set(r.id, { volte: s.volte, inArchivio: !!g, stella: valutazioneDi(g) === 'ottimo', ricevuta: vuoleRicevuta(g), totaleCent: s.ricaviCent })
    }
    return m
  }, [aperte, prenotazioni, clienti])

  // Le camere tenute dalle proposte inviate (per le camere libere del foglietto)
  const tenuteAperte = useMemo(() => barreTenute(aperte.filter(r => r.stato === 'proposta_inviata') as unknown as RichiestaTenuta[], adesso)
    .map(b => ({ richiestaId: b.richiestaId, cameraId: b.cameraId, notti: b.notti, scaduta: b.scaduta })), [aperte, adesso])

  // Sovrapposizioni con le prenotazioni CONFERMATE (nome ospite). Le altre
  // richieste aperte non stanno più qui: dal 12/09/2026 le dice il segno blu,
  // che si tocca e restringe l'elenco a quel gruppo. Così il ⇄ resta una cosa
  // sola, il cambio camera, e la riga non ripete quello che dice il segno.
  const conflittiDi = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of aperte) {
      const s = sovrapposizioni(r, prenotazioni as unknown as Parameters<typeof sovrapposizioni>[1], [], camere)
      m.set(r.id, s.prenotazioni.map(b => `${nomeOspite(b)} (${formatIntervallo(b.check_in, b.check_out)})`))
    }
    return m
  }, [aperte, prenotazioni, camere])

  return (
    <div className="maison cal flex flex-col" data-richieste-maison>
      {/* La testa è quella condivisa con Calendario e Arrivi
          (components/TestaPagina): la pagina comincia allo stesso punto delle
          altre. Dal telefono il titolo «Richieste» resta NASCOSTO (lo dice la
          barra in alto) ma il suo spazio resta. Dal Mac (29/09/2026, Ania) la
          sola scrittina «RICHIESTE» come la barra del telefono, i comandi a
          destra, senza la riga «← Indietro». Dal telefono girato
          «← Indietro» torna alla Home; solo arrivando dalla scheda di una
          prenotazione (?apri=) si torna davvero indietro, a quella scheda. */}
      <TestaPagina titolo="Richieste" titoloNascosto maison desktop={desktop && !orizzontale}
        scrittaMac={desktop && !orizzontale}
        indietro={<BackLink onClick={() => (apriId ? smartBack(router, '/') : router.push('/'))} />}
        comandi={<CampoRicerca maison value={query} onChange={cambiaRicerca} className={desktop ? (orizzontale ? 'flex-1 max-w-[360px]' : 'w-[340px]') : 'w-full'} />} />
      {errori.length > 0 && (
        <div className="px-4"><AvvisoAzione testo={`Non riesco a leggere alcuni dati: ${errori.join(' · ')}`} onRiprova={riprovaCaricamento} className="mb-4" /></div>
      )}

      {/* Il calendario: lo stesso nastro del Calendario (components/richieste/NastroRichieste),
          con la riga del periodo, «Vista · Reale | Presunta», i mesi e la legenda */}
      {loading ? (
        <div className="mz-caricamento">Caricamento…</div>
      ) : (
        <NastroRichieste camere={camere} prenotazioni={prenotazioni} pagamenti={pagamenti} richieste={tutte}
          vista={vista} onVista={setVista} evidenziate={evidenziate} vaiA={vaiA} adesso={adesso}
          desktop={desktop} orizzontale={orizzontale}
          onRichieste={(gruppo, e) => setPannello({ gruppo, ancora: { x: e?.clientX ?? 0, y: e?.clientY ?? 0 } })} />
      )}

      {/* L'ELENCO: filo sopra, «RICHIESTE APERTE · N» con «+ Nuova richiesta», le chip dell'ordine, le righe */}
      <div className="ric-elenco" data-elenco-richieste>
        <div className="rk">
          <span>{capogruppo ? 'Stesse date' : soloDaGuardare ? 'Da guardare' : 'Richieste aperte'}{!loading && <> · {capogruppo ? contatoreGruppo(gruppo.length) : mostrate.length}</>}</span>
          <Link href="/richieste/nuova" className="mz-lnk q" data-nuova-richiesta>+ Nuova richiesta</Link>
        </div>
        {!loading && (
          <FasciaComandi maison ordine={ordine} onOrdine={setOrdine}
            ferme={ferme.length} soloDaGuardare={soloDaGuardare} onDaGuardare={() => setSoloDaGuardare(v => !v)} />
        )}
        {/* Il filtro «stesse date»: la barra col periodo e «Vedi tutte» */}
        {capogruppo && (
          <div data-barra-gruppo className="ric-gruppo">
            <div className="min-w-0">
              <p className="ti">Richieste per {periodoConGiorni(capogruppo.arrivo, capogruppo.partenza)}</p>
              <p className="so">{sottotitoloGruppo(gruppo.length)}</p>
            </div>
            <button type="button" data-vedi-tutte onClick={() => setGruppoDi(null)} className="mz-lnk">{VEDI_TUTTE}</button>
          </div>
        )}
        {loading ? (
          <div className="mz-caricamento">Caricamento…</div>
        ) : mostrate.length === 0 && !richiesteNonLette ? (
          <p className="ric-vuoto">{soloDaGuardare ? 'Nessuna richiesta ferma' : 'Nessuna richiesta in attesa'}</p>
        ) : (
          <ul className="ric-righe">
            {mostrate.map(r => (
              <RigaRichiesta key={r.id} r={r} adesso={adesso} conflitti={conflittiDi.get(r.id) || []} cliente={clienteDi.get(r.id)}
                stesseDate={capogruppo ? null : etichettaAltre(altreDi.get(r.id) ?? 0)} onGruppo={() => setGruppoDi(r.id)} nelGruppo={!!capogruppo}
                selezionata={selezionata === r.id}
                onSeleziona={() => { const nuova = selezionata === r.id ? null : r.id; setSelezionata(nuova); if (nuova) portaA(r.arrivo) }}
                onRifiuta={setDaRifiutare} onConferma={r => setDaConfermare(r as RichiestaConProposta)} />
            ))}
          </ul>
        )}

        {/* LE CHIUSE degli ultimi 3 giorni: «CHIUSE · N · MOSTRA», aperte «CHIUSE · ULTIMI 3 GIORNI · NASCONDI» */}
        {!loading && (
          <div className="ric-chiuse" data-chiuse>
            <div className="rk">
              <span>{chiuseVisibili ? 'Chiuse · ultimi 3 giorni' : `Chiuse · ${archivio.length}`}</span>
              <button type="button" className="mz-lnk q" aria-expanded={chiuseVisibili} onClick={() => setChiuseAperte(!chiuseVisibili)}>{chiuseVisibili ? 'Nascondi' : 'Mostra'}</button>
            </div>
            {chiuseVisibili && (
              <>
                {archivio.length === 0 ? (
                  <p className="ric-vuoto piccolo">{richiesteNonLette ? 'Richieste non lette.' : 'Nessuna richiesta chiusa negli ultimi 3 giorni.'}</p>
                ) : (
                  <ul className="ric-righe">
                    {archivio.map(r => <RigaChiusa key={r.id} r={r} adesso={adesso} evidenziata={r.id === apriId} onRiapri={riapri} riaprendo={riaprendo === r.id} />)}
                  </ul>
                )}
                <p className="ric-nota">Dopo 3 giorni spariscono da sole.</p>
              </>
            )}
          </div>
        )}
      </div>

      {pannello && pannello.gruppo.length > 0 && (
        // Il foglietto della richiesta (novità 14b): al posto del vecchio pannello
        <FogliettoRichiesta gruppo={pannello.gruppo} adesso={adesso} cliente={r => clienteDi.get(r.id) ?? CLIENTE_NUOVA}
          libere={r => camereLibere(r, camere, prenotazioni, tenuteAperte).map(c => c.name)}
          onChiudi={() => setPannello(null)} onRifiuta={setDaRifiutare} onConferma={r => { setPannello(null); setDaConfermare(r as RichiestaConProposta) }} />
      )}
      {daConfermare && (
        <FinestraConferma richiesta={daConfermare} aperte={aperte} layout={desktop ? 'desktop' : 'mobile'}
          onChiudi={() => setDaConfermare(null)} onCreata={(id, avviso) => router.push(`/scheda/${id}?da=richiesta${avviso ? `&avviso=${encodeURIComponent(avviso)}` : ''}`)} />
      )}
      {daRifiutare && (
        <RifiutaConMotivo richiesta={daRifiutare} occupato={rifiutando} onConferma={confermaRifiuto} onAnnulla={() => { if (!rifiutando) setDaRifiutare(null) }} />
      )}
    </div>
  )
}
