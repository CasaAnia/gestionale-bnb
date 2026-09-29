'use client'
// ============================================================================
// «DATI DELLA CLIENTE» (16/09/2026): il foglio con i dati della cliente —
// nome e cognome, telefono, email, ricevuta e valutazione, come ci ha trovato
// con le strutture, la nota.
//
// I dati sono della CLIENTE (guests), non di questa prenotazione: valgono
// per tutti i suoi soggiorni, e il foglio lo dice. Le regole per passare dal
// modulo ai campi stanno in lib/datiCliente; qui c'è solo la scrittura, a
// esito controllato. Il motivo interno ha bisogno della colonna della 0046:
// senza, non si salva niente e il testo resta qui (stessa regola della
// scheda cliente).
//
// Ritocchi del 29/09/2026 (B2, riferimento 1 «Modifica dati»): rifatto nella
// veste del riferimento. FoglioMaison col nome in Cormorant 24 e sotto «DATI
// DELLA CLIENTE» in maiuscoletto ottone; l'avviso; i campi a filo con
// l'etichetta maiuscoletta sopra (Nome e Cognome affiancati, Telefono, Email ·
// può restare vuota); «PAGA DI SOLITO CON» Contanti | Bonifico (D1, dopo la
// 0062); «RICEVUTA» No | Sì 🧾 e «VALUTAZIONE» ★ | Normale | ! affiancate, con
// «Perché» quando è «!»; «COME CI HA TROVATO» e sotto le strutture note +
// «Altra…»; le note del cliente a filo; in fondo, nella riga fissa (B1), il
// tasto pieno «Salva» e «Annulla» sottolineato; poi la conferma B. Si apre da
// «Modifica dati» nella scheda della prenotazione e nella scheda cliente.
// Regole, errori e salvataggio sono quelli di prima.
// ============================================================================
import { useEffect, useState, type ReactNode } from 'react'
import FoglioMaison from '@/components/maison/FoglioMaison'
import type { Salvataggio } from '@/components/maison/SalvatoMaison'
import AvvisoAzione from '@/components/AvvisoAzione'
import CampiNomeCognome from '@/components/CampiNomeCognome'
import { supabase } from '@/lib/supabase'
import { leggiStrutture, ricordaStruttura } from '@/lib/provenienzaDati'
import { clienteConProvenienza, PROVENIENZE, type StrutturaNota } from '@/lib/provenienza'
import { colonnaRicevutaPresente, type Valutazione } from '@/lib/valutazione'
import { colonnaMancante } from '@/lib/colonnaMancante'
import { messaggioNonSalvato } from '@/lib/scritturaSicura'
import { moduloDaCliente, campiDaModulo, TITOLO_DATI_CLIENTE, AVVISO_TUTTI_I_SOGGIORNI, type ClienteSalvato, type ModuloCliente } from '@/lib/datiCliente'
import { colonnaPagamentoPresente, VOCI_PAGAMENTO_ABITUALE, ETICHETTA_PAGA_DI_SOLITO } from '@/lib/pagamentoAbituale'
import { nomeDaSalvare } from '@/lib/guestName'
import { ALTEZZE_FOGLI } from '@/lib/altezzeFogli'

export const ERRORE_MOTIVO_SENZA_0046 = 'Il motivo interno non può ancora essere registrato (serve la proposta 0046). Nessuna modifica alla cliente è stata salvata: il testo resta qui.'
export const ETICHETTA_NOTE_CLIENTE = 'Note del cliente · restano anche le prossime volte'
export const ALTRA_STRUTTURA_CHIP = 'Altra…'

// Le tre voci della valutazione come nel riferimento: un segno solo, «!» in mattone
const SEGNI: { chiave: Valutazione; segno: string; mattone?: boolean }[] = [
  { chiave: 'ottimo', segno: '★' },
  { chiave: 'normale', segno: 'Normale' },
  { chiave: 'problematico', segno: '!', mattone: true },
]

function Chip({ acceso, onClick, dati, mattone = false, children }: { acceso: boolean; onClick: () => void; dati: string; mattone?: boolean; children: ReactNode }) {
  return <button type="button" data-pastiglia={dati} aria-pressed={acceso} className={`${acceso ? 'on' : ''} ${mattone ? 'mat' : ''}`} onClick={onClick}>{children}</button>
}

export default function FoglioCliente({ cliente, onChiudi, onSalvato }: {
  cliente: ClienteSalvato & { id: string }
  onChiudi: () => void
  /** i campi appena scritti su guests (dopo la conferma B): chi apre il foglio li mette dove servono */
  onSalvato: (campi: Record<string, unknown>, avviso: string | null) => void
}) {
  const [dati, setDati] = useState<ModuloCliente>(() => moduloDaCliente(cliente))
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[] }>({ disponibile: false, lista: [] })
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [salvato, setSalvato] = useState<(Salvataggio & { campi: Record<string, unknown>; avviso: string | null }) | null>(null)
  const cambia = (pezzo: Partial<ModuloCliente>) => setDati(d => ({ ...d, ...pezzo }))
  const conPagamento = colonnaPagamentoPresente(cliente)
  const conProvenienza = clienteConProvenienza(cliente) && strutture.disponibile
  // il titolo è il nome com'è salvato (non quello che si sta scrivendo)
  const nome = (cliente.full_name ?? '').trim() || nomeDaSalvare({ nome: dati.nome, cognome: dati.cognome }) || 'Cliente'

  useEffect(() => {
    let vivo = true
    void leggiStrutture().then(r => { if (vivo) setStrutture({ disponibile: r.disponibile, lista: r.strutture }) })
    return () => { vivo = false }
  }, [])

  async function salva() {
    if (salvando || salvato) return
    const m = campiDaModulo(dati, cliente, { colonnaRicevuta: colonnaRicevutaPresente(cliente), conProvenienza, colonnaPagamento: conPagamento })
    if (!m.ok) { setErrore(m.errore); return }
    setSalvando(true)
    setErrore(null)
    let esito: { error: { code?: string; message?: string } | null }
    try { esito = await supabase.from('guests').update(m.campi).eq('id', cliente.id) } catch (err) { esito = { error: { message: String((err as Error)?.message ?? err) } } }
    if (esito.error) {
      setSalvando(false)
      setErrore(colonnaMancante(esito.error) === 'motivo_problematico' ? ERRORE_MOTIVO_SENZA_0046 : messaggioNonSalvato(esito.error))
      return
    }
    // un nome di struttura nuovo entra nell'elenco (se non riesce non blocca: il cliente è salvato)
    let avviso: string | null = null
    if (m.campi.provenienza === 'altra_struttura' && typeof m.campi.struttura_nome === 'string') {
      const e = await ricordaStruttura(m.campi.struttura_nome, strutture.lista)
      if (e) avviso = `Salvato, ma il nome della struttura non è stato aggiunto all’elenco: ${e}`
    }
    setSalvando(false)
    // la conferma B (spunta, «Salvato»), poi il foglio si chiude da sé
    setSalvato({ cosa: `${TITOLO_DATI_CLIENTE} · ${nome}`, quando: new Date(), campi: m.campi, avviso })
  }

  const strutturaLibera = !!dati.struttura && !strutture.lista.some(s => s.nome === dati.struttura)
  return (
    <FoglioMaison titolo={nome} sottotitolo={TITOLO_DATI_CLIENTE} altezza={ALTEZZE_FOGLI.cliente} dati="cliente"
      onChiudi={salvato ? () => {} : onChiudi}
      salvato={salvato} onFineSalvato={() => { if (salvato) onSalvato(salvato.campi, salvato.avviso) }}
      piede={
        <div className="cli-piede" data-piede-foglio>
          <button type="button" className="cli-cta" data-azione-foglio="cliente" onClick={() => void salva()} disabled={salvando || !!salvato}>{salvando ? 'Salvo…' : 'Salva'}</button>
          <p><button type="button" className="mz-lnk q" data-annulla-foglio onClick={onChiudi} disabled={salvando}>Annulla</button></p>
        </div>
      }>
      <div className="cli-foglio" data-dati-cliente>
        <p className="cli-avviso" data-vale-per-tutti>{AVVISO_TUTTI_I_SOGGIORNI}</p>
        {/* Nome e cognome: SOLO il componente condiviso (regola fissa n. 1, maiuscola mentre si scrive) */}
        <CampiNomeCognome nome={dati.nome} cognome={dati.cognome} onNome={v => cambia({ nome: v })} onCognome={v => cambia({ cognome: v })}
          classeFila="cli-g2" classeCampo="cli-in"
          avvolgi={(etichetta, campo) => <label className="cli-fld"><span className="fl2">{etichetta}</span>{campo}</label>} />
        <label className="cli-fld"><span className="fl2">Telefono</span>
          <input type="tel" inputMode="tel" className="cli-in" data-campo="telefono" value={dati.telefono} onChange={e => cambia({ telefono: e.target.value })} />
        </label>
        <label className="cli-fld"><span className="fl2">Email · può restare vuota</span>
          <input type="email" inputMode="email" autoCapitalize="none" className="cli-in" data-campo="email" value={dati.email} onChange={e => cambia({ email: e.target.value })} />
        </label>
        {conPagamento && (
          <div className="cli-fld" data-paga-di-solito><span className="fl2">{ETICHETTA_PAGA_DI_SOLITO}</span>
            <span className="cli-chips">
              {VOCI_PAGAMENTO_ABITUALE.map(v => (
                <Chip key={v.chiave} dati={`pagamento-${v.chiave}`} acceso={dati.pagamento === v.chiave}
                  onClick={() => cambia({ pagamento: dati.pagamento === v.chiave ? null : v.chiave })}>{v.testo}</Chip>
              ))}
            </span>
          </div>
        )}
        <div className="cli-due">
          <div><p className="cli-fl2x">Ricevuta</p>
            <span className="cli-chips">
              <Chip dati="ricevuta-no" acceso={!dati.ricevuta} onClick={() => cambia({ ricevuta: false })}>No</Chip>
              <Chip dati="ricevuta-si" acceso={dati.ricevuta} onClick={() => cambia({ ricevuta: true })}>Sì 🧾</Chip>
            </span>
          </div>
          <div><p className="cli-fl2x">Valutazione</p>
            <span className="cli-chips">
              {SEGNI.map(v => (
                <Chip key={v.chiave} dati={`valutazione-${v.chiave}`} acceso={dati.valutazione === v.chiave} mattone={v.mattone}
                  onClick={() => cambia({ valutazione: v.chiave, motivo: v.chiave === 'problematico' ? dati.motivo : '' })}>{v.segno}</Chip>
              ))}
            </span>
          </div>
        </div>
        {dati.valutazione === 'problematico' && (
          <label className="cli-fld"><span className="fl2">Perché</span>
            <input type="text" className="cli-in" data-campo="motivo" placeholder="resta solo per noi" value={dati.motivo} onChange={e => cambia({ motivo: e.target.value })} />
          </label>
        )}
        {conProvenienza && (
          <>
            <p className="cli-fl2x">Come ci ha trovato</p>
            <span className="cli-chips">
              {PROVENIENZE.map(p => (
                <Chip key={p.chiave} dati={`provenienza-${p.chiave}`} acceso={dati.provenienza === p.chiave}
                  onClick={() => cambia({ provenienza: p.chiave, struttura: p.chiave === 'altra_struttura' ? dati.struttura : '' })}>{p.label}</Chip>
              ))}
            </span>
            {dati.provenienza === 'altra_struttura' && (
              <>
                <span className="cli-chips" data-strutture>
                  {strutture.lista.map(s => (
                    <Chip key={s.nome} dati={`struttura-${s.nome}`} acceso={dati.struttura === s.nome} onClick={() => cambia({ struttura: s.nome })}>{s.nome}</Chip>
                  ))}
                  <Chip dati="struttura-altra" acceso={strutturaLibera} onClick={() => cambia({ struttura: ' ' })}>{ALTRA_STRUTTURA_CHIP}</Chip>
                </span>
                {strutturaLibera && (
                  <label className="cli-fld"><span className="fl2">Quale struttura</span>
                    <input type="text" className="cli-in" data-campo="struttura" value={dati.struttura.trimStart()} onChange={e => cambia({ struttura: e.target.value })} />
                  </label>
                )}
              </>
            )}
          </>
        )}
        <label className="cli-fld cli-note"><span className="fl2">{ETICHETTA_NOTE_CLIENTE}</span>
          <textarea rows={2} className="cli-in" data-campo="note" value={dati.note} onChange={e => cambia({ note: e.target.value })} />
        </label>
        {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      </div>
    </FoglioMaison>
  )
}
