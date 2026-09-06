'use client'
// «Cambia cliente» nella scheda prenotazione (06/09/2026): sposta QUESTA
// prenotazione su un altro cliente, esistente (ricerca per nome o telefono)
// o nuovo (nome, cognome, telefono, provenienza). Il cliente di partenza non
// viene toccato; della prenotazione cambia solo il riferimento al cliente.
// Regole e testi in lib/cambiaCliente; scritture in lib/cambiaClienteDati
// con esito controllato: se non salva, «Non salvato, riprova» e nulla cambia.
import { useEffect, useRef, useState } from 'react'
import AvvisoAzione from '@/components/AvvisoAzione'
import CampoProvenienza from '@/components/CampoProvenienza'
import { nomeOspite } from '@/lib/guestName'
import { normalizzaTelefono, telefonoLeggibile } from '@/lib/whatsapp'
import { type StrutturaNota } from '@/lib/provenienza'
import {
  avvisiCambioCliente, provenienzaProposta, nuovoClienteDaModulo, stessoCliente, testoDocumentiDaSpostare,
  MESSAGGIO_DOCUMENTI_NON_SPOSTATI, type ClienteBreve, type PrenotazionePerCambio, type ValoreProvenienzaModulo,
} from '@/lib/cambiaCliente'
import { cercaClientiPerCambio, creaClienteNuovo, scriviCambioCliente, documentiDelCliente, spostaDocumenti } from '@/lib/cambiaClienteDati'

type Props = {
  booking: PrenotazionePerCambio & { guest_name?: string | null; guests?: ClienteBreve | null }
  segmenti: number               // righe del soggiorno (cambio camera)
  pagamenti: number              // movimenti già registrati
  confermaInviata: boolean       // proposta/conferma già mandata al cliente attuale
  strutture: { disponibile: boolean; lista: StrutturaNota[] }
  onClose: () => void
  onCambiato: (cliente: ClienteBreve) => void   // solo a scrittura riuscita
}

export default function CambiaCliente({ booking, segmenti, pagamenti, confermaInviata, strutture, onClose, onCambiato }: Props) {
  const clienteAttuale = booking.guests ?? null
  const nomeVecchio = nomeOspite(booking)
  const [modo, setModo] = useState<'cerca' | 'nuovo'>('cerca')
  const [testo, setTesto] = useState('')
  const [risultati, setRisultati] = useState<ClienteBreve[]>([])
  const [erroreRicerca, setErroreRicerca] = useState<string | null>(null)
  const [cercando, setCercando] = useState(false)
  const [scelto, setScelto] = useState<ClienteBreve | null>(null)
  const [modulo, setModulo] = useState({ nome: '', cognome: '', telefono: '' })
  const [provenienza, setProvenienza] = useState<ValoreProvenienzaModulo>(() => provenienzaProposta(clienteAttuale, strutture.lista))
  const [documenti, setDocumenti] = useState<string[]>([])
  const [spostaDoc, setSpostaDoc] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  // Dopo un cambio riuscito ma documenti non spostati: si riprova solo quella parte
  const [riprovaDocumenti, setRiprovaDocumenti] = useState<{ nuovo: ClienteBreve } | null>(null)
  const campoRicerca = useRef<HTMLInputElement>(null)

  const avvisi = avvisiCambioCliente({ pagamenti, confermaInviata, segmenti, nomeVecchio })
  const rigaDocumenti = testoDocumentiDaSpostare(documenti.length, nomeVecchio)

  // Ricerca con una piccola attesa mentre si scrive; con campo vuoto gli ultimi clienti
  useEffect(() => {
    let vivo = true
    const t = setTimeout(async () => {
      if (vivo) setCercando(true)
      const r = await cercaClientiPerCambio(testo, clienteAttuale?.id)
      if (!vivo) return
      setRisultati(r.clienti); setErroreRicerca(r.errore); setCercando(false)
    }, testo ? 250 : 0)
    return () => { vivo = false; clearTimeout(t) }
  }, [testo, clienteAttuale?.id])

  useEffect(() => {
    let vivo = true
    documentiDelCliente(clienteAttuale?.id).then(ids => { if (vivo) setDocumenti(ids) })
    return () => { vivo = false }
  }, [clienteAttuale?.id])

  useEffect(() => { if (modo === 'cerca') campoRicerca.current?.focus() }, [modo])

  // Chiusura con Esc, come le altre finestre
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, salvando])

  async function spostaDocumentiPoiChiudi(nuovo: ClienteBreve) {
    if (spostaDoc && documenti.length > 0 && clienteAttuale?.id) {
      const e = await spostaDocumenti(documenti, clienteAttuale.id, nuovo.id, () => {})
      if (e) { setRiprovaDocumenti({ nuovo }); setErrore(`${MESSAGGIO_DOCUMENTI_NON_SPOSTATI}: ${e.replace(/^Non salvato, /, '')}`); return }
    }
    onCambiato(nuovo)
  }

  async function salva() {
    if (salvando) return
    setErrore(null)
    let nuovo: ClienteBreve | null = scelto
    setSalvando(true)
    try {
      if (riprovaDocumenti) { await spostaDocumentiPoiChiudi(riprovaDocumenti.nuovo); return }
      if (modo === 'nuovo') {
        const m = nuovoClienteDaModulo({ ...modulo, provenienza: provenienza.provenienza, struttura: provenienza.struttura }, strutture.disponibile)
        if (!m.ok) { setErrore(m.errore); return }
        const creato = await creaClienteNuovo(m.campi, strutture.lista)
        if (creato.errore !== null) { setErrore(creato.errore); return }
        const cliente = creato.cliente
        nuovo = cliente
        // Il cliente ora esiste: se il passaggio sotto fallisce si riprova
        // senza crearne un doppione
        setScelto(cliente); setModo('cerca'); setTesto(cliente.full_name ?? '')
      }
      if (!nuovo) { setErrore('Scegli un cliente dall’elenco o creane uno nuovo'); return }
      if (stessoCliente(booking, nuovo.id)) { setErrore('È già il cliente di questa prenotazione'); return }
      const fissato = nuovo
      const e = await scriviCambioCliente(booking, fissato.id, () => {})
      if (e) { setErrore(e); return }
      await spostaDocumentiPoiChiudi(fissato)
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'w-full min-w-0 appearance-none bg-white ed-campo p-3 text-[15px] focus:outline-none focus:border-green-mid'

  return (
    <div className="fixed inset-0 ed-velo flex items-end sm:items-center justify-center z-[70] sm:p-4" onClick={() => { if (!salvando) onClose() }}>
      <div role="dialog" aria-labelledby="cambia-cliente-titolo" data-cambia-cliente
        className="scheda-in ed-foglio rounded-t-2xl sm:rounded-2xl p-4 pb-[max(16px,env(safe-area-inset-bottom))] w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 id="cambia-cliente-titolo" className="ed-titolo-medio">Cambia cliente</h2>
        <p className="text-sm text-stone mt-1 mb-3">
          Solo questa prenotazione passa a un altro cliente. <span className="font-semibold text-green-dark">{nomeVecchio}</span> resta com’è, con le sue altre prenotazioni; date, prezzo, note, letti e pagamenti non cambiano.
        </p>

        {avvisi.length > 0 && (
          <ul className="rounded-xl px-3 py-2.5 mb-3 text-sm space-y-1" style={{ background: '#F6F2EA', border: '1px solid #C9BFA8', color: '#5a4b2a' }} data-avvisi>
            {avvisi.map(a => <li key={a}>⚠️ {a}</li>)}
          </ul>
        )}

        {!riprovaDocumenti && (
          <div className="flex gap-2 mb-3" role="tablist">
            <button type="button" role="tab" aria-selected={modo === 'cerca'} onClick={() => setModo('cerca')}
              className={modo === 'cerca' ? 'ed-pillola' : 'ed-pillola-tenue'}>Cliente esistente</button>
            <button type="button" role="tab" aria-selected={modo === 'nuovo'} onClick={() => { setModo('nuovo'); setScelto(null) }}
              className={modo === 'nuovo' ? 'ed-pillola' : 'ed-pillola-tenue'}>Nuovo cliente</button>
          </div>
        )}

        {!riprovaDocumenti && modo === 'cerca' && (
          <div>
            <input ref={campoRicerca} value={testo} onChange={e => { setTesto(e.target.value); setScelto(null) }}
              placeholder="Cerca nome o telefono…" aria-label="Cerca cliente" autoComplete="off" className={`${campo} mb-2`} />
            {erroreRicerca && <AvvisoAzione testo={erroreRicerca} className="mb-2" />}
            <div className="ed-lista max-h-64 overflow-y-auto" role="listbox" aria-label="Clienti">
              {risultati.map(c => (
                <button key={c.id} type="button" role="option" aria-selected={scelto?.id === c.id}
                  onClick={() => setScelto(c)}
                  className={`w-full text-left py-2.5 px-2 flex items-center justify-between gap-3 transition-colors ${scelto?.id === c.id ? 'bg-sage rounded-lg' : ''}`}>
                  <span className="min-w-0">
                    <span className="block font-semibold text-green-dark truncate">{c.full_name || 'Senza nome'}</span>
                    {c.phone && <span className="block text-xs text-stone">{telefonoLeggibile(normalizzaTelefono(c.phone))}</span>}
                  </span>
                  {scelto?.id === c.id && <span className="text-green-mid font-bold shrink-0">✓</span>}
                </button>
              ))}
              {!cercando && risultati.length === 0 && !erroreRicerca && (
                <p className="text-sm text-stone py-3 px-2">{testo ? 'Nessun cliente con questo nome o telefono.' : 'Nessun altro cliente in archivio.'}{' '}
                  <button type="button" className="underline underline-offset-2 text-green-mid" onClick={() => setModo('nuovo')}>Crea un nuovo cliente</button>
                </p>
              )}
            </div>
          </div>
        )}

        {!riprovaDocumenti && modo === 'nuovo' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm text-gray-500 mb-1">Nome</p>
                <input value={modulo.nome} onChange={e => setModulo({ ...modulo, nome: e.target.value })} autoCapitalize="words" autoComplete="off" placeholder="Nome" aria-label="Nome" className={campo} />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Cognome</p>
                <input value={modulo.cognome} onChange={e => setModulo({ ...modulo, cognome: e.target.value })} autoCapitalize="words" autoComplete="off" placeholder="Cognome" aria-label="Cognome" className={campo} />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Telefono</p>
              <input value={modulo.telefono} onChange={e => setModulo({ ...modulo, telefono: e.target.value })} type="tel" inputMode="tel" autoComplete="off" placeholder="+39…" aria-label="Telefono" className={campo} />
            </div>
            <CampoProvenienza compatto valore={provenienza} onChange={setProvenienza} strutture={strutture.lista} disponibile={strutture.disponibile} />
          </div>
        )}

        {rigaDocumenti && !riprovaDocumenti && (
          <label className="flex items-start gap-2.5 mt-3 text-sm text-green-dark cursor-pointer" data-sposta-documenti>
            <input type="checkbox" checked={spostaDoc} onChange={e => setSpostaDoc(e.target.checked)} className="mt-0.5 accent-[#2D6A4F]" />
            <span>{rigaDocumenti}</span>
          </label>
        )}

        {errore && <AvvisoAzione testo={errore} className="mt-3" />}

        <div className="mt-4 space-y-2">
          <button type="button" onClick={salva} disabled={salvando || (!riprovaDocumenti && modo === 'cerca' && !scelto)}
            className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50 transition-transform duration-100 active:scale-[0.98]">
            {salvando ? 'Salvo…' : riprovaDocumenti ? 'Riprova a spostare i documenti' : modo === 'nuovo' ? 'Crea e passa la prenotazione' : scelto ? `Passa la prenotazione a ${scelto.full_name || 'questo cliente'}` : 'Scegli un cliente'}
          </button>
          <button type="button" onClick={riprovaDocumenti ? () => onCambiato(riprovaDocumenti.nuovo) : onClose} disabled={salvando} className="w-full text-gray-500 py-2 text-sm">
            {riprovaDocumenti ? 'Lascia i documenti dove sono' : 'Annulla'}
          </button>
        </div>
      </div>
    </div>
  )
}
