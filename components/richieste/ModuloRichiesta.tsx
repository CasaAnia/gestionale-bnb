'use client'
import { conInizialiNomeCognome } from '@/lib/maiuscole'
import CampiNomeCognome from '@/components/CampiNomeCognome'
import { useEffect, useMemo, useRef, useState } from 'react'
import SalvatoMaison, { type Salvataggio } from '@/components/maison/SalvatoMaison'
import { COSA_SALVATA } from '@/lib/salvatoMaison'
import { nomeCompleto } from '@/lib/guestName'
import { pezzoCliente } from '@/lib/rigaRichiesta'
import StrisciaNotti from '@/components/StrisciaNotti'
import { supabase } from '@/lib/supabase'
import { frasiDisponibilita, notti, ordinaCamere, type PrenotazioneMinima } from '@/lib/disponibilita'
import { selezioneNottiValida, elencoNotti } from '@/lib/nottiRichieste'
import { giorniTra, spostaGiorni } from '@/lib/richiesteCalendario'
import { capienzaCamera } from '@/lib/tariffe'
import { avvisoCameraPersone } from '@/lib/cameraPerPersone'
import { riassuntoPersone, type CanaleRichiesta, type ValoriModifica } from '@/lib/richieste'
import { normalizzaTelefono, telefonoLeggibile, numeroUsabile } from '@/lib/whatsapp'
import CampoProvenienza from '@/components/CampoProvenienza'
import { campiProvenienza, normalizzaProvenienza, type Provenienza, type StrutturaNota } from '@/lib/provenienza'
import { leggiStrutture, ricordaStruttura, cercaClientePerTelefono, salvaProvenienzaCliente, type ClienteTrovato } from '@/lib/provenienzaDati'
import { ETICHETTA_RICEVUTA_BREVE } from '@/lib/valutazione'

// Il modulo della richiesta (pezzo 9): lo STESSO per «Nuova richiesta» e per
// «Modifica» (precompilato). Sotto «Persone», appena arrivo e partenza sono
// validi, la striscia delle notti: ogni notte parte dal valore di Persone; un
// tocco cicla 1 → … → massimo (la capienza più alta fra le camere con brande).
// Il valore salvato è null quando tutte le notti sono uguali a Persone.

type Camera = { id: string; name: string; active: boolean; has_extra_bed?: boolean | null; base_price?: number | string | null; double_price?: number | string | null }

export type ValoriModulo = {
  canale: CanaleRichiesta
  nome: string; cognome: string
  arrivo: string; partenza: string
  persone: number
  nottiRichieste?: string[] | null
  personePerNotte: number[] | null
  cameraId: string
  telefono: string
  note: string
  // Provenienza (08/09/2026): «Come ci ha trovato» + nome della struttura
  provenienza: Provenienza
  struttura: string
}

// Veste «Maison» (29/09/2026, telefono 12 del riferimento): campi a filo,
// etichetta maiuscoletta piccola sopra, valore in Cormorant
const INPUT = 'ric-fld'
const ETICHETTA = 'fl2'
const MAX_PERSONE_SENZA_CAMERE = 4

// Giorno dopo, senza passare dal fuso orario del telefono.
function giornoDopo(iso: string): string {
  const t = Date.parse(iso + 'T00:00:00Z')
  return Number.isNaN(t) ? '' : new Date(t + 86400000).toISOString().slice(0, 10)
}

export const VALORI_VUOTI: ValoriModulo = { canale: 'telefono', nome: '', cognome: '', arrivo: '', partenza: '', persone: 1, personePerNotte: null, cameraId: '', telefono: '', note: '', provenienza: 'non_so', struttura: '' }

// Dai valori del modulo a quelli da salvare (stessa normalizzazione del telefono della proposta WhatsApp)
// conProvenienza = colonne della 0036 disponibili: solo allora i campi entrano nel payload
export function valoriDaSalvare(v: ValoriModulo, conProvenienza = false): ValoriModifica {
  return conInizialiNomeCognome({
    nome: v.nome, cognome: v.cognome, arrivo: v.arrivo, partenza: v.partenza,
    persone: v.persone, persone_per_notte: v.personePerNotte,
    ...(v.nottiRichieste != null ? { notti_richieste: v.nottiRichieste } : {}),
    camera_id: v.cameraId || null, canale: v.canale,
    telefono: telefonoLeggibile(normalizzaTelefono(v.telefono)) || null,
    note: v.note.trim() || null,
    ...(conProvenienza ? campiProvenienza(v.provenienza, v.struttura) : {}),
  })
}

// Le persone per notte «pulite»: null se tutte uguali al valore base
export function normalizzaPersonePerNotte(perNotte: number[] | null, base: number, nottiN: number): number[] | null {
  if (!perNotte || perNotte.length !== nottiN) return null
  return perNotte.every(x => x === base) ? null : perNotte
}

export default function ModuloRichiesta({ iniziale, etichettaSalva, onSalva, notaSotto, onSalvato }: {
  iniziale?: ValoriModulo
  etichettaSalva: string
  onSalva: (valori: ValoriModifica) => Promise<string | null>   // torna l'errore da mostrare, oppure null
  notaSotto?: string
  /** dopo la conferma di salvataggio «B» (1,2 s): la pagina decide dove andare */
  onSalvato?: () => void
}) {
  const [v, setV] = useState<ValoriModulo>(iniziale ?? VALORI_VUOTI)
  const [camere, setCamere] = useState<Camera[]>([])
  const [occupazione, setOccupazione] = useState<{ chiave: string; prenotazioni: PrenotazioneMinima[]; errore: string | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [salvato, setSalvato] = useState<Salvataggio | null>(null)
  // «Solo alcune notti» e «Persone notte per notte»: le due strisce si aprono a comando
  const [personeAperte, setPersoneAperte] = useState(() => !!iniziale?.personePerNotte)
  const [errore, setErrore] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  // Strutture note (0036): disponibile = false finché la migrazione non c'è
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[] }>({ disponibile: false, lista: [] })
  const set = <K extends keyof ValoriModulo>(k: K, val: ValoriModulo[K]) => setV(x => ({ ...x, [k]: val }))

  useEffect(() => {
    let vivo = true
    leggiStrutture().then(r => { if (vivo) { setStrutture({ disponibile: r.disponibile, lista: r.strutture }); if (r.errore) setAvviso(r.errore) } })
    return () => { vivo = false }
  }, [])

  // Provenienza del CLIENTE (0037): se il telefono è di un cliente esistente
  // i chip si precompilano con la sua provenienza (una volta per cliente) e
  // accanto compare «Già stato da noi · N soggiorni»
  const [cliente, setCliente] = useState<ClienteTrovato | null>(null)
  const precompilatoPer = useRef<string | null>(null)
  useEffect(() => {
    const tel = v.telefono.trim()
    let vivo = true
    const t = setTimeout(() => {
      if (!tel) { setCliente(null); return }
      const oggi = new Date(); const iso = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`
      cercaClientePerTelefono(tel, iso).then(c => {
        if (!vivo) return
        setCliente(c)
        if (c && c.conColonne && precompilatoPer.current !== c.id) {
          precompilatoPer.current = c.id
          setV(x => ({ ...x, provenienza: normalizzaProvenienza(c.provenienza), struttura: c.struttura_nome ?? '' }))
        }
      })
    }, 400)
    return () => { vivo = false; clearTimeout(t) }
  }, [v.telefono])

  useEffect(() => {
    supabase.from('rooms').select('id, name, active, has_extra_bed, base_price, double_price').eq('active', true).then(({ data, error }) => {
      if (error) setErrore(`Camere non caricate: ${error.message}`)
      setCamere(ordinaCamere((data || []) as Camera[]))
    })
  }, [])

  const { arrivo, partenza, persone } = v
  const dateValide = notti(arrivo, partenza) > 0
  const nottiN = dateValide ? notti(arrivo, partenza) : 0
  // massimo per notte: la capienza più alta fra le camere con brande (Lena: 4)
  const maxPersone = useMemo(() => Math.max(MAX_PERSONE_SENZA_CAMERE, ...camere.filter(c => c.has_extra_bed).map(c => capienzaCamera(c))), [camere])

  // Riga indicativa: SOLO prenotazioni confermate/completate che si sovrappongono.
  useEffect(() => {
    if (!dateValide) return
    const chiave = `${arrivo}|${partenza}`
    let alive = true
    supabase.from('bookings')
      .select('room_id, check_in, check_out, status, num_guests, extra_bed, extra_bed_dates')
      .in('status', ['confermata', 'completata'])
      .lt('check_in', partenza).gt('check_out', arrivo)
      .then(({ data, error }) => {
        if (!alive) return
        setOccupazione({ chiave, prenotazioni: (data || []) as PrenotazioneMinima[], errore: error ? error.message : null })
      })
    return () => { alive = false }
  }, [arrivo, partenza, dateValide])

  const personeMax = v.personePerNotte ? Math.max(...v.personePerNotte) : persone
  // Avviso della camera troppo piccola: guarda la notte più piena
  const avvisoCamera = useMemo(
    () => avvisoCameraPersone(camere.find(c => c.id === v.cameraId) ?? null, personeMax, camere),
    [camere, v.cameraId, personeMax],
  )
  const rigaDisponibilita = dateValide && occupazione && occupazione.chiave === `${arrivo}|${partenza}`
    ? (v.nottiRichieste ? `${v.nottiRichieste.length} notti scelte: disponibilità verificata nella proposta` : occupazione.errore ? `${nottiN} notti · disponibilità non leggibile (${occupazione.errore})` : frasiDisponibilita(camere, occupazione.prenotazioni, arrivo, partenza, personeMax))
    : (dateValide ? `${nottiN === 1 ? '1 notte' : `${nottiN} notti`} · controllo le camere…` : '')

  // Le date cambiano → le notti cambiano: la striscia riparte da «Persone»
  // (una striscia con un numero diverso di caselle sarebbe un dato incoerente)
  // Cambiando l'arrivo la partenza segue con le stesse notti, come nella Nuova prenotazione
  function cambiaArrivo(val: string) {
    setV(x => { const durata = x.arrivo && x.partenza && x.partenza > x.arrivo ? notti(x.arrivo, x.partenza) : 1; const fine = val ? spostaGiorni(val, durata) : x.partenza; return { ...x, arrivo: val, partenza: fine, personePerNotte: null, ...(x.nottiRichieste != null ? { nottiRichieste: x.nottiRichieste.filter(g => g >= val && g < fine) } : {}) } })
  }
  function cambiaPartenza(val: string) { setV(x => ({ ...x, partenza: val, personePerNotte: null, ...(x.nottiRichieste != null ? { nottiRichieste: x.nottiRichieste.filter(g => g >= x.arrivo && g < val) } : {}) })) }
  function cambiaPersone(n: number) { setV(x => ({ ...x, persone: n, personePerNotte: null })) }
  const valoriStriscia = v.personePerNotte ?? Array.from({ length: nottiN }, () => persone)

  async function salva() {
    setErrore(null)
    if (!v.nome.trim() || !v.cognome.trim()) { setErrore('Nome e cognome sono obbligatori.'); return }
    // Il numero è obbligatorio in ogni richiesta (Ania, 12/09/2026): dal sito
    // senza numero non parte nemmeno, e senza numero non si può né chiamare né
    // scrivere. La regola è quella del sito, lib/whatsapp.
    if (!numeroUsabile(v.telefono)) { setErrore('Il numero di telefono è obbligatorio: senza non si può né chiamare né scrivere.'); return }
    if (!arrivo || !partenza) { setErrore('Indica arrivo e partenza.'); return }
    if (partenza <= arrivo) { setErrore('La partenza deve essere almeno una notte dopo l’arrivo.'); return }
    if (v.nottiRichieste != null && !selezioneNottiValida(v.nottiRichieste, arrivo, partenza)) { setErrore('Seleziona almeno una notte compresa nelle date della richiesta.'); return }
    if (v.personePerNotte && v.personePerNotte.length !== nottiN) { setErrore('La striscia delle notti non corrisponde alle date: ricontrolla le persone per notte.'); return }
    setSaving(true)
    const e = await onSalva(valoriDaSalvare({ ...v, personePerNotte: normalizzaPersonePerNotte(v.personePerNotte, persone, nottiN) }, strutture.disponibile))
    // La provenienza è del cliente: se esiste già, si aggiorna la sua (vale per tutti i suoi soggiorni)
    if (!e && strutture.disponibile && cliente?.conColonne) {
      const errCliente = await salvaProvenienzaCliente(cliente.id, campiProvenienza(v.provenienza, v.struttura))
      if (errCliente) setAvviso(`Richiesta salvata, ma la provenienza del cliente non è stata aggiornata: ${errCliente}`)
    }
    // Nome di struttura nuovo → entra nell'elenco (non blocca il salvataggio)
    if (!e && strutture.disponibile && v.provenienza === 'altra_struttura') {
      const errStruttura = await ricordaStruttura(v.struttura, strutture.lista)
      if (errStruttura) setAvviso(`Richiesta salvata, ma il nome della struttura non è stato aggiunto all'elenco: ${errStruttura}`)
    }
    setSaving(false)
    if (e) { setErrore(e); return }
    // Conferma «B»: la spunta al centro, poi la pagina va avanti da sola
    if (onSalvato) setSalvato({ cosa: COSA_SALVATA.richiesta(nomeCompleto({ nome: v.nome, cognome: v.cognome })), quando: new Date() })
  }

  const telefonoInArchivio = cliente ? (cliente.soggiorniConclusi > 0 ? `${pezzoCliente(cliente.soggiorniConclusi, true)}` : 'Cliente già in archivio') : null
  const tuttiINotti = giorniTra(arrivo, partenza)
  return (
    <div className="ric-modulo" data-modulo-richiesta>
      {/* CANALE */}
      <section className="sec">
        <p className="k">Canale</p>
        <div className="ric-chips piatte" data-senza-sottolinea>
          {([['telefono', 'Telefono'], ['whatsapp', 'WhatsApp'], ...(v.canale === 'web' ? [['web', 'Dal sito']] : [])] as [CanaleRichiesta, string][]).map(([c, label]) => (
            <button key={c} type="button" onClick={() => set('canale', c)} aria-pressed={v.canale === c} className={v.canale === c ? 'on' : ''}>{label}</button>
          ))}
        </div>
      </section>

      {/* CLIENTE: Nome, Cognome, Telefono (con «già ospite» se il numero è in archivio), Da dove arriva */}
      <section className="sec">
        <p className="k">Cliente</p>
        <div className="ric-campi">
          <CampiNomeCognome nome={v.nome} cognome={v.cognome} onNome={x => set('nome', x)} onCognome={x => set('cognome', x)} classeFila="ric-campi-nome"
            classeCampo={INPUT} placeholderNome="Anna" placeholderCognome="Rossi"
            avvolgi={(etichetta, campo) => <label key={etichetta} className="ric-campo"><span className={ETICHETTA}>{etichetta}</span>{campo}</label>} />
        </div>
        <label className="ric-campo">
          <span className="fl2">Telefono</span>
          <input type="tel" inputMode="tel" value={v.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+39 333 1234567" className={INPUT} />
        </label>
        {v.telefono.trim() && (() => {
          const t = normalizzaTelefono(v.telefono)
          return <p className={`so ${t.avviso ? 'mat' : ''}`}>{t.avviso ? `${t.avviso} · verrà salvato come ${telefonoLeggibile(t)}` : `Verrà salvato come ${telefonoLeggibile(t)}`}</p>
        })()}
        {telefonoInArchivio && <p className="so verde" data-cliente-in-archivio>{telefonoInArchivio.charAt(0).toUpperCase() + telefonoInArchivio.slice(1)}{cliente?.full_name ? ` · ${cliente.full_name}` : ''}{cliente?.ricevuta ? ` · ${ETICHETTA_RICEVUTA_BREVE}` : ''}</p>}
        <div className="ric-campo">
          <span className="fl2">Da dove arriva</span>
          <CampoProvenienza valore={{ provenienza: v.provenienza, struttura: v.struttura }} onChange={x => setV(y => ({ ...y, provenienza: x.provenienza, struttura: x.struttura }))}
            strutture={strutture.lista} disponibile={strutture.disponibile} maison />
        </div>
        {avviso && <p className="so">{avviso}</p>}
      </section>

      {/* SOGGIORNO: Arrivo e Partenza affiancati, Persone − / +, Camera, le due strisce a comando */}
      <section className="sec">
        <p className="k">Soggiorno</p>
        <div className="ric-due">
          <label className="ric-campo">
            <span className="fl2">Arrivo</span>
            <input type="date" value={arrivo} onChange={e => cambiaArrivo(e.target.value)} className={INPUT} />
          </label>
          <label className="ric-campo">
            <span className="fl2">Partenza</span>
            <input type="date" value={partenza} min={arrivo ? giornoDopo(arrivo) : undefined} onChange={e => cambiaPartenza(e.target.value)} className={INPUT} />
          </label>
        </div>
        {arrivo && partenza && partenza <= arrivo && <p className="so mat">La partenza deve essere dopo l’arrivo.</p>}
        {rigaDisponibilita && <p className="so ott" aria-live="polite">{rigaDisponibilita}</p>}
        <div className="ric-due">
          <div className="ric-campo">
            <span className="fl2">Persone</span>
            <span className="ric-pm">
              <button type="button" onClick={() => cambiaPersone(Math.max(1, persone - 1))} disabled={persone <= 1} aria-label="Una persona in meno">−</button>
              <b>{persone}</b>
              <button type="button" onClick={() => cambiaPersone(Math.min(10, persone + 1))} disabled={persone >= 10} aria-label="Una persona in più">+</button>
            </span>
          </div>
          <label className="ric-campo">
            <span className="fl2">Camera</span>
            <select value={v.cameraId} onChange={e => set('cameraId', e.target.value)} className={INPUT}>
              <option value="">Qualsiasi</option>
              {camere.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        {/* La camera chiesta non regge le persone: si avvisa e basta, si salva lo stesso (Ania, 12/09/2026) */}
        {avvisoCamera && <p data-avviso-camera className="so mat">{avvisoCamera}</p>}
        {dateValide && (
          <div className="ric-ac">
            <button type="button" className="mz-lnk q" aria-pressed={v.nottiRichieste != null} data-solo-alcune-notti
              onClick={() => setV(x => ({ ...x, nottiRichieste: x.nottiRichieste != null ? null : giorniTra(x.arrivo, x.partenza) }))}>Solo alcune notti</button>
            <button type="button" className="mz-lnk q" aria-pressed={personeAperte} data-persone-notte onClick={() => setPersoneAperte(a => !a)}>Persone notte per notte</button>
          </div>
        )}
        {dateValide && v.nottiRichieste != null && (
          <div className="ric-strisce" data-notti-selezionate>
            <p className="so">Richiesta soltanto per le notti selezionate</p>
            <div className="ric-chips piatte" data-senza-sottolinea>
              {tuttiINotti.map(g => (
                <button type="button" role="checkbox" aria-checked={v.nottiRichieste!.includes(g)} key={g} className={v.nottiRichieste!.includes(g) ? 'on' : ''}
                  onClick={() => setV(x => ({ ...x, nottiRichieste: x.nottiRichieste!.includes(g) ? x.nottiRichieste!.filter(n => n !== g) : [...x.nottiRichieste!, g].sort() }))}>
                  {Number(g.slice(8))}/{Number(g.slice(5, 7))}
                </button>
              ))}
            </div>
            <p className="so">{v.nottiRichieste.length > 0 ? `Notti del ${elencoNotti(v.nottiRichieste)}. Le altre sono escluse.` : 'Nessuna notte scelta.'}</p>
          </div>
        )}
        {dateValide && personeAperte && (
          <div className="ric-strisce" data-persone-per-notte>
            <p className="so">Persone notte per notte · tocca una notte per cambiarla (1–{maxPersone})</p>
            <StrisciaNotti arrivo={arrivo} partenza={partenza} nottiSelezionate={v.nottiRichieste ?? undefined} valori={v.nottiRichieste ? v.nottiRichieste.map(g => valoriStriscia[tuttiINotti.indexOf(g)]) : valoriStriscia} min={1} max={maxPersone}
              onChange={vals => { const tutte = v.nottiRichieste ? tuttiINotti.map((g, i) => { const k = v.nottiRichieste!.indexOf(g); return k < 0 ? valoriStriscia[i] : vals[k] }) : vals; set('personePerNotte', normalizzaPersonePerNotte(tutte, persone, nottiN)) }} />
            <p className="so" aria-live="polite">
              {v.nottiRichieste ? 'Persone indicate solo per le notti scelte' : riassuntoPersone(arrivo, valoriStriscia)}
              {v.personePerNotte ? '' : ` · tutte le notti in ${persone}`}
            </p>
          </div>
        )}
      </section>

      {/* NOTE */}
      <section className="sec">
        <p className="k">Note</p>
        <textarea value={v.note} onChange={e => set('note', e.target.value)} rows={2} placeholder="Es. arriva tardi, chiede il letto aggiuntivo…" aria-label="Note" className="ric-fld area" />
      </section>

      {errore && <p role="alert" className="ric-avviso">{errore}</p>}

      <div className="sec">
        <button type="button" onClick={salva} disabled={saving || !!salvato} className="ric-cta" data-salva-richiesta>{saving ? 'Salvataggio…' : etichettaSalva}</button>
        {notaSotto && <p className="so centro">{notaSotto}</p>}
      </div>
      {salvato && (
        <div className="mz fixed inset-0 z-[80]" data-salvato-richiesta>
          <SalvatoMaison salvato={salvato} onFine={() => onSalvato?.()} />
        </div>
      )}
    </div>
  )
}

// Da una richiesta salvata ai valori del modulo (per «Modifica»)
export function valoriDaRichiesta(r: { canale: CanaleRichiesta; nome: string; cognome: string; arrivo: string; partenza: string; persone: number; persone_per_notte?: number[] | null; notti_richieste?: string[] | null; camera_id: string | null; telefono: string | null; note: string | null; provenienza?: string | null; struttura_nome?: string | null }): ValoriModulo {
  const n = giorniTra(r.arrivo, r.partenza).length
  return {
    canale: r.canale, nome: r.nome, cognome: r.cognome, arrivo: r.arrivo, partenza: r.partenza, persone: Number(r.persone) || 1,
    nottiRichieste: r.notti_richieste,
    personePerNotte: Array.isArray(r.persone_per_notte) && r.persone_per_notte.length === n ? r.persone_per_notte : null,
    cameraId: r.camera_id ?? '', telefono: r.telefono ?? '', note: r.note ?? '',
    provenienza: normalizzaProvenienza(r.provenienza), struttura: r.struttura_nome ?? '',
  }
}
