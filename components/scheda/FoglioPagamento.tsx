'use client'
// ============================================================================
// «AGGIUNGI PAGAMENTO» (16/09/2026), rifatto il 20/09/2026 sera sul disegno
// approvato da Ania (punto 5, colonna DOPO di pagamento-prima-dopo.html):
//   «Resta da incassare» con la cifra del conto autorevole · due tasti,
//   «Saldo completo» e «Altro importo» · QUANTO (già scritto col residuo e in
//   sola lettura nel saldo; vuoto e da scrivere nell'altro importo) con la
//   spiegazione · QUANDO (il calendario del telefono, già su oggi) · COME
//   (Contanti · Bonifico) · NOTA · un filo · «Dopo il pagamento resta» con la
//   cifra prevista e la frase sull'esito · «Salva il pagamento» · «Annulla».
//
// Il residuo in cima è quello del conto della scheda (contoPrenotazione, di
// TUTTA la prenotazione, mai del solo tratto): qui non si ricalcola niente.
// Le regole stanno in lib/pagamentoFoglio (pure) e il salvataggio in
// lib/pagamentiDati, col contratto unico dei movimenti: qui non si scrive
// niente sul database direttamente. Aprire il foglio e scegliere un tasto
// non registra nulla: si scrive solo con «Salva il pagamento».
//
// Se il conto cambia mentre il foglio è aperto (un incasso da un altro
// telefono, letto al momento del salvataggio, oppure la scheda che rilegge)
// la cifra in cima si aggiorna, nel saldo si riscrive il campo e lo si dice:
// non si salva mai un importo diverso da quello mostrato.
// ============================================================================
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import CampoData from '@/components/nuova/CampoData'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, stileCampo, MATTONE } from '@/components/nuova/PezziNuova'
import {
  TITOLO_PAGAMENTO, SALVA_PAGAMENTO, ETICHETTA_QUANTO, ETICHETTA_QUANDO, ETICHETTA_COME, ETICHETTA_NOTA, ERRORE_IMPORTO, ERRORE_GIORNO,
  RESTA_DA_INCASSARE, MODO_SALDO, MODO_ALTRO, GRUPPO_MODI, SPIEGA_SALDO, SPIEGA_ALTRO, DOPO_IL_PAGAMENTO_RESTA, NIENTE_DA_SALDARE,
  OLTRE_IL_TOTALE_FOGLIO, CONTO_CAMBIATO,
  MODI_PAGAMENTO, modoProposto, modoIniziale, importoProposto, importoInCent, residuoPrevisto,
  type ModoPagamento, type ModoImporto,
} from '@/lib/pagamentoFoglio'
import { euroScheda } from '@/lib/schedaPrenotazione'
import {
  registraPagamento, verificaPagamento, tentativoIncerto, COMANDO_RIPROVA_PAGAMENTO, PAGAMENTO_NON_RIPROVABILE, type ContoRiletto, type EsitoPagamento, type RigaPagabile, type TentativoIncerto,
  COMANDO_VERIFICA_PAGAMENTO, PAGAMENTO_NON_TROVATO, TENTATIVO_IN_SOSPESO, MESSAGGIO_ESITO_INCERTO,
} from '@/lib/pagamentiDati'
import { dataConGiorno } from '@/lib/dateItaliane'

export type PagamentoSalvato = Extract<EsitoPagamento, { esito: 'ok' }> & { importo: number; metodo: ModoPagamento; ritrovato?: boolean }

/** Il conto autorevole della scheda: le tre cifre di contoPrenotazione */
export type ContoFoglio = { totaleCent: number; ricevutiCent: number }

// ── Le misure e i colori del riferimento approvato (solo dentro questo foglio) ──
const TESTO = '#30483b'
const VERDE_SCELTO = '#30674f'
const FILO_TASTO = '#c9d1c3'
const FILO_RESIDUO = '#d4c6aa'
const SPIEGAZIONE = '#6d7967'
const ERRORE = '#a83f2c'
const GEORGIA = 'Georgia, serif'
const MONETA: CSSProperties = { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
const ETICHETTA: CSSProperties = { fontSize: 10, letterSpacing: '1.3px', color: '#9c814e' }
const SPIEGA: CSSProperties = { marginTop: 6, fontSize: 12, color: SPIEGAZIONE }
const CAMPO: CSSProperties = { ...stileCampo, fontSize: 16, color: TESTO }

export default function FoglioPagamento({ booking, righe, conto, oggi, bonifico, onChiudi, onSalvato, onContoCambiato }: {
  booking: RigaPagabile
  /** tutte le camere della prenotazione, annullate comprese */
  righe: RigaPagabile[]
  /** il conto della scheda (contoPrenotazione): totale e ricevuto dell'intera prenotazione */
  conto: ContoFoglio
  oggi: string
  /** l'accordo aspetta un bonifico: la pastiglia proposta è quella */
  bonifico?: boolean | null
  onChiudi: () => void
  onSalvato: (esito: PagamentoSalvato) => void
  /** al salvataggio il conto riletto (camere, totale, pagamenti) era diverso: la scheda lo riceve e si aggiorna */
  onContoCambiato?: (riletto: ContoRiletto) => void
}) {
  const [contoLocale, setContoLocale] = useState({ totaleCent: Math.round(conto.totaleCent), ricevutiCent: Math.round(conto.ricevutiCent) })
  const { totaleCent, ricevutiCent } = contoLocale
  const residuoCent = totaleCent - ricevutiCent
  // Il tentativo incerto (rilievo 3): la scrittura è partita e la risposta
  // non è arrivata. Resta custodito sul telefono e si ritrova anche
  // riaprendo il foglio: i campi mostrano i SUOI dati (importo, giorno, modo,
  // nota) e restano fermi finché l'esito non è risolto — un importo cambiato
  // nel frattempo non deve diventare un secondo pagamento (21/09/2026).
  const [incerto, setIncerto] = useState<TentativoIncerto | null>(() => tentativoIncerto(booking))
  const [modo, setModo] = useState<ModoImporto>(incerto ? 'altro' : modoIniziale(residuoCent))
  const [importo, setImporto] = useState(incerto ? importoProposto(Math.round(incerto.importo * 100)) : modoIniziale(residuoCent) === 'saldo' ? importoProposto(residuoCent) : '')
  const [giorno, setGiorno] = useState(incerto ? incerto.giorno : oggi)
  const [metodo, setMetodo] = useState<ModoPagamento>(incerto ? (incerto.metodo === 'bonifico' ? 'bonifico' : 'contanti') : modoProposto(bonifico))
  const [nota, setNota] = useState(incerto ? incerto.nota : '')
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [avvisoConto, setAvvisoConto] = useState<string | null>(null)
  // dopo una verifica «non trovato» si può rimandare LO STESSO pagamento (stessa
  // chiave: se intanto è arrivato non si raddoppia); mai dopo l'INSERT di ripiego
  const [riprovabile, setRiprovabile] = useState(false)
  const [esitoVerifica, setEsitoVerifica] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)
  const campoImporto = useRef<HTMLInputElement>(null)
  const daFocalizzare = useRef(false)
  // Il freno contro il doppio clic dev'essere SINCRONO: lo stato `salvando`
  // si aggiorna al prossimo disegno, e due o tre tocchi arrivati prima
  // farebbero partire altrettanti salvataggi (li salverebbe solo la chiave
  // idempotente). Con il ref il secondo tocco trova la porta già chiusa.
  const inCorso = useRef(false)

  // Il conto della scheda è cambiato mentre il foglio era aperto (rilettura):
  // la cifra in cima segue, nel saldo il campo si riscrive, e lo si dice.
  const totaleDellaScheda = Math.round(conto.totaleCent), ricevutiDellaScheda = Math.round(conto.ricevutiCent)
  const ultimoConto = useRef(`${totaleDellaScheda}/${ricevutiDellaScheda}`)
  useEffect(() => {
    const adesso = `${totaleDellaScheda}/${ricevutiDellaScheda}`
    if (adesso === ultimoConto.current) return
    ultimoConto.current = adesso
    aggiornaConto({ totaleCent: totaleDellaScheda, ricevutiCent: ricevutiDellaScheda })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totaleDellaScheda, ricevutiDellaScheda])

  function aggiornaConto(nuovo: { totaleCent: number; ricevutiCent: number }) {
    const nuovoResiduo = Math.round(nuovo.totaleCent) - Math.round(nuovo.ricevutiCent)
    setContoLocale({ totaleCent: Math.round(nuovo.totaleCent), ricevutiCent: Math.round(nuovo.ricevutiCent) })
    ultimoConto.current = `${Math.round(nuovo.totaleCent)}/${Math.round(nuovo.ricevutiCent)}`
    setAvvisoConto(CONTO_CAMBIATO(nuovoResiduo))
    if (modo === 'saldo') {
      if (nuovoResiduo > 0) setImporto(importoProposto(nuovoResiduo))
      else { setModo('altro'); setImporto('') }
    }
  }

  const cent = importoInCent(importo)
  const importoScrittoMale = importo.trim() !== '' && cent == null
  const previsto = residuoPrevisto(residuoCent, cent)
  const nienteDaSaldare = residuoCent <= 0

  function scegliSaldo() {
    if (nienteDaSaldare) return
    setModo('saldo')
    setImporto(importoProposto(residuoCent))
    setErrore(null)
  }
  function scegliAltro() {
    setModo('altro')
    setImporto('')
    setErrore(null)
    daFocalizzare.current = true
  }
  useEffect(() => {
    if (modo === 'altro' && daFocalizzare.current) { daFocalizzare.current = false; campoImporto.current?.focus() }
  }, [modo])

  async function salva() {
    if (inCorso.current || salvando) return
    if (incerto && !riprovabile) return
    if (cent == null) { setErrore(ERRORE_IMPORTO); return }
    if (!giorno) { setErrore(ERRORE_GIORNO); return }
    inCorso.current = true
    setSalvando(true)
    setErrore(null)
    setEsitoVerifica(null)
    // con un tentativo in sospeso si rimanda QUELLO, coi suoi dati: stessa chiave
    const dati = incerto
      ? { importo: incerto.importo, metodo: (incerto.metodo === 'bonifico' ? 'bonifico' : 'contanti') as ModoPagamento, giorno: incerto.giorno, nota: incerto.nota }
      : { importo: cent / 100, metodo, giorno, nota }
    let esito: EsitoPagamento
    try {
      esito = await registraPagamento(booking, righe, dati, { totaleAttesoCent: totaleCent, ricevutiAttesiCent: ricevutiCent })
    } finally {
      inCorso.current = false
      setSalvando(false)
    }
    if (esito.esito === 'errore') {
      if (esito.incerto) {
        setIncerto(esito.incerto)
        setRiprovabile(false)   // di nuovo incerto: prima si verifica
        setErrore(esito.messaggio)
        return
      }
      if (esito.contoCambiato) {
        // il conto riletto (camere, totale, pagamenti) è diverso da quello mostrato:
        // niente scritto, le cifre si aggiornano qui e nella scheda, si ricontrolla
        aggiornaConto(esito.contoCambiato.conto)
        onContoCambiato?.(esito.contoCambiato)
        return
      }
      setErrore(esito.messaggio)
      return
    }
    // rimandato e già arrivato la volta prima → «Ritrovati e confermati»; scritto adesso → «Registrati»
    onSalvato({ ...esito, importo: dati.importo, metodo: dati.metodo, ritrovato: !!esito.giaRegistrato })
  }

  async function verifica() {
    if (verificando || inCorso.current) return
    setVerificando(true)
    setErrore(null)
    setEsitoVerifica(null)
    let esito: Awaited<ReturnType<typeof verificaPagamento>>
    try { esito = await verificaPagamento(booking, righe) } finally { setVerificando(false) }
    if (esito.esito === 'ritrovato') {
      onSalvato({ esito: 'ok', pagamenti: esito.pagamenti, pagato: esito.pagato, avviso: esito.avviso, importo: esito.tentativo.importo, metodo: (esito.tentativo.metodo === 'bonifico' ? 'bonifico' : 'contanti'), ritrovato: true })
      return
    }
    if (esito.esito === 'errore') { setErrore(esito.messaggio); return }
    if (esito.esito === 'nessun_tentativo') { setIncerto(null); return }
    // non trovato: NON è detto che sia fallito (la richiesta può essere ancora
    // in corso). Il tentativo resta, coi suoi dati e la sua chiave: si può
    // rimandare tale e quale; dopo l'INSERT di ripiego no, ci si ferma.
    setRiprovabile(esito.riprovabile)
    setEsitoVerifica(esito.riprovabile ? PAGAMENTO_NON_TROVATO : PAGAMENTO_NON_RIPROVABILE)
  }

  const tasto = (scelto: boolean, spento = false): CSSProperties => ({
    fontSize: 13, fontWeight: 600, lineHeight: 1.5, borderRadius: 8, padding: '12px 6px', minWidth: 0,
    border: `1px solid ${scelto ? VERDE_SCELTO : FILO_TASTO}`,
    background: scelto ? VERDE_SCELTO : 'transparent', color: scelto ? '#fff' : TESTO,
    opacity: spento ? 0.45 : 1, cursor: spento ? 'default' : 'pointer',
  })

  return (
    <Foglio titolo={TITOLO_PAGAMENTO} misuraTitolo={23} onChiudi={onChiudi}>
      <div data-foglio-pagamento style={{ color: TESTO, fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>
        {/* In cima: quanto resta da incassare, dal conto autorevole della scheda */}
        <div data-resta-da-incassare className="flex items-baseline justify-between gap-[10px]" style={{ marginBottom: nienteDaSaldare ? 8 : 20 }}>
          <span>{RESTA_DA_INCASSARE}</span>
          <strong data-residuo-attuale style={{ ...MONETA, font: `26px ${GEORGIA}`, fontWeight: 400 }}>{euroScheda(Math.max(0, residuoCent))}</strong>
        </div>
        {residuoCent < 0 && <p data-oltre-il-totale style={{ ...SPIEGA, marginTop: 0, marginBottom: 12 }}>{OLTRE_IL_TOTALE_FOGLIO(-residuoCent)}</p>}
        {nienteDaSaldare && residuoCent === 0 && <p data-niente-da-saldare style={{ ...SPIEGA, marginTop: 0, marginBottom: 12 }}>{NIENTE_DA_SALDARE}</p>}

        {/* I due tasti: saldo completo, oppure un altro importo */}
        <div role="group" aria-label={GRUPPO_MODI} className="grid grid-cols-2 gap-2">
          <button type="button" data-modo="saldo" aria-pressed={modo === 'saldo'} disabled={nienteDaSaldare || !!incerto} onClick={scegliSaldo} data-senza-sottolinea style={tasto(modo === 'saldo', nienteDaSaldare || !!incerto)}>{MODO_SALDO}</button>
          <button type="button" data-modo="altro" aria-pressed={modo === 'altro'} disabled={!!incerto} onClick={scegliAltro} data-senza-sottolinea style={tasto(modo === 'altro')}>{MODO_ALTRO}</button>
        </div>

        <RigaCampo etichetta={ETICHETTA_QUANTO} ottone stileEtichetta={ETICHETTA} className="mt-[19px]">
          <input ref={campoImporto} type="text" inputMode="decimal" autoComplete="off" data-campo="importo" value={importo} readOnly={modo === 'saldo' || !!incerto}
            aria-describedby="pagamento-spiegazione" onChange={e => { if (!incerto) setImporto(e.target.value) }}
            style={{ ...CAMPO, color: modo === 'saldo' || incerto ? '#6f7c69' : TESTO }} />
        </RigaCampo>
        <p id="pagamento-spiegazione" data-spiegazione style={SPIEGA}>{modo === 'saldo' ? SPIEGA_SALDO : SPIEGA_ALTRO}</p>

        <CampoData etichetta={ETICHETTA_QUANDO} valore={giorno} onValore={v => { if (!incerto) setGiorno(v) }} dati="giorno" ottone stileEtichetta={ETICHETTA} className="mt-[11px]" />
        <Etichetta testo={ETICHETTA_COME} ottone stileEtichetta={{ ...ETICHETTA, marginTop: 19 }} />
        <FilaPastiglie>
          {MODI_PAGAMENTO.map(m => (
            <Pastiglia key={m.chiave} dati={`modo-${m.chiave}`} acceso={metodo === m.chiave} onClick={() => { if (!incerto) setMetodo(m.chiave) }}>{m.testo}</Pastiglia>
          ))}
        </FilaPastiglie>
        <RigaCampo etichetta={ETICHETTA_NOTA} ottone stileEtichetta={ETICHETTA} className="mt-[19px]">
          <input type="text" data-campo="nota" value={nota} readOnly={!!incerto} onChange={e => { if (!incerto) setNota(e.target.value) }} style={{ ...CAMPO, color: incerto ? '#6f7c69' : TESTO }} />
        </RigaCampo>

        {/* Il filo e, sotto, quanto resterà dopo questo pagamento: si aggiorna mentre si scrive */}
        <div aria-live="polite">
          <div data-dopo-resta className="flex flex-wrap items-baseline justify-between gap-[10px]" style={{ marginTop: 23, padding: '14px 0 0', borderTop: `1px solid ${FILO_RESIDUO}` }}>
            <span>{DOPO_IL_PAGAMENTO_RESTA}</span>
            <strong data-residuo-previsto style={{ ...MONETA, font: `25px ${GEORGIA}`, fontWeight: 400 }}>{previsto.cifra}</strong>
          </div>
          {previsto.esito && <p data-esito style={SPIEGA}>{previsto.esito}</p>}
          {previsto.oltre && <p data-oltre-il-dovuto style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: MATTONE }}>{previsto.oltre}</p>}
          {importoScrittoMale && <p data-errore-importo style={{ marginTop: 8, fontSize: 13, color: ERRORE }}>{ERRORE_IMPORTO}</p>}
          {avvisoConto && <p data-conto-cambiato style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: MATTONE }}>{avvisoConto}</p>}
        </div>
        {errore && errore !== MESSAGGIO_ESITO_INCERTO && <AvvisoAzione testo={errore} className="mt-3" />}
        {incerto && (
          <div data-tentativo-incerto role="alert" style={{ marginTop: 14, padding: '12px 0 0', borderTop: `1px solid ${FILO_RESIDUO}` }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: MATTONE }}>
              {errore === MESSAGGIO_ESITO_INCERTO ? MESSAGGIO_ESITO_INCERTO : TENTATIVO_IN_SOSPESO(euroScheda(Math.round(incerto.importo * 100)), incerto.metodo, dataConGiorno(incerto.giorno))}
            </p>
            {errore === MESSAGGIO_ESITO_INCERTO && <p style={{ ...SPIEGA, marginTop: 4 }}>{TENTATIVO_IN_SOSPESO(euroScheda(Math.round(incerto.importo * 100)), incerto.metodo, dataConGiorno(incerto.giorno))}</p>}
            <button type="button" data-verifica-pagamento onClick={verifica} disabled={verificando} data-senza-sottolinea
              style={{ ...tasto(true), width: '100%', marginTop: 10, opacity: verificando ? 0.5 : 1 }}>{verificando ? 'Controllo…' : COMANDO_VERIFICA_PAGAMENTO}</button>
          </div>
        )}
        {esitoVerifica && <p data-esito-verifica style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: TESTO }}>{esitoVerifica}</p>}

        <PiedeFoglio azione={incerto ? COMANDO_RIPROVA_PAGAMENTO : SALVA_PAGAMENTO} onAzione={salva} salvando={salvando} disabilitato={cent == null || (!!incerto && !riprovabile)} onAnnulla={onChiudi} dati="pagamento" />
      </div>
    </Foglio>
  )
}
