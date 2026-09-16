'use client'
// ============================================================================
// «CAMBIA CLIENTE» (16/09/2026): il foglio della scheda nuova. Dentro, la
// ricerca per nome o telefono come nell'inserimento, coi risultati in righe
// (🧾 ★ nome, telefono, quante volte è stata: components/nuova/RigaCliente)
// e il tastino «+ Nuovo cliente», che apre lo stesso modulo dell'inserimento.
// Scegliendo, il foglio chiede conferma con una riga sola («La prenotazione
// passa da Carmela Sabia a …») e poi salva con «Cambia».
//
// Le regole sono quelle di lib/cambiaCliente (06/09/2026): cambia SOLO il
// riferimento al cliente su tutte le righe del soggiorno, il cliente di
// partenza non si tocca, i documenti seguono la persona (spunta già attiva,
// Ania 06/09/2026). Le scritture sono quelle di lib/cambiaClienteDati.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import CampoRicerca from '@/components/CampoRicerca'
import RigaCliente, { TastinoSage, NUOVO_CLIENTE } from '@/components/nuova/RigaCliente'
import NuovoCliente, { NUOVO_CLIENTE_VUOTO, type DatiNuovoCliente } from '@/components/nuova/NuovoCliente'
import { MATTONE, OTTONE } from '@/components/nuova/PezziNuova'
import { nomeOspite, nomeCompleto } from '@/lib/guestName'
import { numeroUsabile } from '@/lib/whatsapp'
import { leggiStrutture } from '@/lib/provenienzaDati'
import type { StrutturaNota } from '@/lib/provenienza'
import { campiNuovoCliente, SENZA_NOME, SENZA_TELEFONO } from '@/lib/datiCliente'
import {
  avvisiCambioCliente, stessoCliente, testoDocumentiDaSpostare, rigaPassaggio, MESSAGGIO_DOCUMENTI_NON_SPOSTATI,
  type ClienteBreve, type PrenotazionePerCambio,
} from '@/lib/cambiaCliente'
import { cercaClientiPerCambio, soggiorniConclusiDeiClienti, creaClienteNuovo, scriviCambioCliente, documentiDelCliente, spostaDocumenti } from '@/lib/cambiaClienteDati'

export const TITOLO_CAMBIA_CLIENTE = 'Cambia cliente'
export const AZIONE_CAMBIA = 'Cambia'
export const CERCA_UN_ALTRO = '‹ cerca un’altra cliente'

export default function FoglioCambiaCliente({ booking, segmenti, pagamenti, confermaInviata, oggi, onChiudi, onCambiato }: {
  booking: PrenotazionePerCambio & { guest_name?: string | null; guests?: ClienteBreve | null }
  /** righe del soggiorno (cambio camera, camere parallele) */
  segmenti: number
  /** movimenti già registrati */
  pagamenti: number
  /** la conferma è già partita al cliente attuale */
  confermaInviata: boolean
  oggi: string
  onChiudi: () => void
  /** solo a scrittura riuscita: il cliente nuovo, con quello che serve alla testa */
  onCambiato: (cliente: ClienteBreve, avviso: string | null) => void
}) {
  const clienteAttuale = booking.guests ?? null
  const nomeVecchio = nomeOspite(booking)
  const [ricerca, setRicerca] = useState('')
  const [risultati, setRisultati] = useState<ClienteBreve[]>([])
  const [soggiorni, setSoggiorni] = useState<Record<string, number>>({})
  const [erroreRicerca, setErroreRicerca] = useState<string | null>(null)
  const [scelto, setScelto] = useState<ClienteBreve | null>(null)
  const [nuovo, setNuovo] = useState<DatiNuovoCliente | null>(null)
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[] }>({ disponibile: false, lista: [] })
  const [documenti, setDocumenti] = useState<string[]>([])
  const [spostaDoc, setSpostaDoc] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const avvisi = avvisiCambioCliente({ pagamenti, confermaInviata, segmenti, nomeVecchio })
  const rigaDocumenti = testoDocumentiDaSpostare(documenti.length, nomeVecchio)

  useEffect(() => {
    let vivo = true
    void leggiStrutture().then(r => { if (vivo) setStrutture({ disponibile: r.disponibile, lista: r.strutture }) })
    void documentiDelCliente(clienteAttuale?.id).then(ids => { if (vivo) setDocumenti(ids) })
    return () => { vivo = false }
  }, [clienteAttuale?.id])

  // La ricerca: nome o telefono, con la regola già in uso (cercaClientiPerCambio,
  // mai il cliente attuale); un quarto di secondo dopo l'ultimo tasto.
  function scriviRicerca(v: string) {
    setRicerca(v)
    if (timer.current) clearTimeout(timer.current)
    const testo = v.trim()
    if (testo.length < 2) { setRisultati([]); return }
    timer.current = setTimeout(() => { void cerca(testo) }, 250)
  }
  async function cerca(testo: string) {
    const r = await cercaClientiPerCambio(testo, clienteAttuale?.id)
    setErroreRicerca(r.errore)
    setRisultati(r.clienti)
    setSoggiorni(await soggiorniConclusiDeiClienti(r.clienti.map(c => c.id), oggi))
  }

  async function spostaDocumentiPoiChiudi(cliente: ClienteBreve) {
    let avviso: string | null = null
    if (spostaDoc && documenti.length > 0 && clienteAttuale?.id) {
      const e = await spostaDocumenti(documenti, clienteAttuale.id, cliente.id, () => {})
      if (e) avviso = `${MESSAGGIO_DOCUMENTI_NON_SPOSTATI}: ${e.replace(/^Non salvato, /, '')}`
    }
    onCambiato(cliente, avviso)
  }

  async function cambia() {
    if (salvando) return
    setErrore(null)
    let cliente: ClienteBreve | null = scelto
    setSalvando(true)
    try {
      if (nuovo) {
        if (!nuovo.nome.trim()) { setErrore(SENZA_NOME); return }
        if (!numeroUsabile(nuovo.telefono)) { setErrore(SENZA_TELEFONO); return }
        const creato = await creaClienteNuovo(campiNuovoCliente(nuovo, strutture.disponibile) as never, strutture.lista)
        if (creato.errore !== null) { setErrore(creato.errore); return }
        cliente = creato.cliente
        // il cliente ora esiste: se il passaggio sotto fallisce si riprova senza un doppione
        setScelto(creato.cliente)
        setNuovo(null)
      }
      if (!cliente) { setErrore('Scegli una cliente dall’elenco o creane una nuova.'); return }
      if (stessoCliente(booking, cliente.id)) { setErrore('È già la cliente di questa prenotazione.'); return }
      const e = await scriviCambioCliente(booking, cliente.id, () => {})
      if (e) { setErrore(e); return }
      await spostaDocumentiPoiChiudi(cliente)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Foglio titolo={TITOLO_CAMBIA_CLIENTE} onChiudi={onChiudi}>
      {!scelto && !nuovo && (
        <div data-cerca-cliente>
          <CampoRicerca value={ricerca} onChange={scriviRicerca} placeholder="Cerca per nome o telefono…" />
          <div style={{ marginTop: 10 }}><TastinoSage testo={NUOVO_CLIENTE} onClick={() => setNuovo(NUOVO_CLIENTE_VUOTO)} /></div>
          {erroreRicerca && <p className="mt-3" style={{ fontSize: 13, color: MATTONE }}>{erroreRicerca}</p>}
          {risultati.length > 0 && (
            <div data-trovati style={{ marginTop: 14 }}>
              {risultati.map(c => <RigaCliente key={c.id} cliente={c} soggiorni={soggiorni[c.id] ?? 0} onScegli={() => setScelto(c)} />)}
            </div>
          )}
          {ricerca.trim().length >= 2 && risultati.length === 0 && !erroreRicerca && (
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--color-stone)' }}>Nessuna cliente con questo nome o telefono.</p>
          )}
          <p style={{ marginTop: 18 }}>
            <button type="button" data-annulla-foglio onClick={onChiudi} style={{ minHeight: 44, padding: '0 14px', fontSize: 13, color: 'var(--color-stone)' }}>Annulla</button>
          </p>
        </div>
      )}

      {!scelto && nuovo && (
        <NuovoCliente dati={nuovo} onDati={setNuovo} strutture={strutture.lista} struttureDisponibili={strutture.disponibile}
          titolo={null} avanti={null} etichetteOttone />
      )}

      {(scelto || nuovo) && (
        <div data-conferma-cambio style={{ marginTop: 16 }}>
          {/* una riga sola: da chi a chi */}
          <p data-riga-passaggio style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-green-dark)' }}>
            {rigaPassaggio(nomeVecchio, scelto?.full_name ?? nomeCompleto({ nome: nuovo?.nome, cognome: nuovo?.cognome }))}
          </p>
          {avvisi.map(a => <p key={a} style={{ marginTop: 6, fontSize: 12.5, color: OTTONE }}>{a}</p>)}
          {rigaDocumenti && (
            <label className="flex items-start gap-2.5 mt-3 cursor-pointer" data-sposta-documenti style={{ fontSize: 13, color: 'var(--color-green-dark)' }}>
              <input type="checkbox" checked={spostaDoc} onChange={e => setSpostaDoc(e.target.checked)} className="mt-0.5 accent-[#2D6A4F]" />
              <span>{rigaDocumenti}</span>
            </label>
          )}
          {scelto && (
            <p style={{ marginTop: 8 }}>
              <button type="button" data-cerca-altro onClick={() => setScelto(null)} className="py-2 -my-2" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>{CERCA_UN_ALTRO}</button>
            </p>
          )}
          {errore && <AvvisoAzione testo={errore} className="mt-3" />}
          <PiedeFoglio azione={nuovo ? 'Crea e cambia' : AZIONE_CAMBIA} onAzione={cambia} salvando={salvando} onAnnulla={onChiudi} dati="cambia-cliente" />
        </div>
      )}
    </Foglio>
  )
}
