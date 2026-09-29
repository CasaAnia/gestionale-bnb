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
//
// Dal 28/09/2026 la veste «Maison» (riferimento approvato da Ania): foglio
// dal basso ad altezza fissa, titolo = nome, sotto «camera · date · Aggiungi
// pagamento»; «Resta da incassare» grande in Cormorant; «Saldo completo |
// Altro importo» a filo; Quanto e Quando a filo; Come con due sole scelte,
// Contanti e Bonifico; la nota; «Dopo il pagamento resta … · Il conto sarà
// saldato.»; «Annulla» e «Salva il pagamento» pieno. Dopo il salvataggio la
// conferma B (spunta e «Salvato»), poi il foglio si chiude da solo. Logica
// invariata (lib/pagamentoFoglio, lib/pagamentiDati).
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import FoglioMaison, { PiedeMaison } from '@/components/maison/FoglioMaison'
import type { Salvataggio } from '@/components/maison/SalvatoMaison'
import AvvisoAzione from '@/components/AvvisoAzione'
import { apriSelettore } from '@/components/nuova/CampoData'
import { COSA_SALVATA } from '@/lib/salvatoMaison'
import { nomeConAltri } from '@/lib/guestName'
import { periodoCompatto, MESI_LUNGHI } from '@/lib/dateItaliane'
import {
  TITOLO_PAGAMENTO, SALVA_PAGAMENTO, ETICHETTA_QUANTO, ETICHETTA_QUANDO, ETICHETTA_COME, ETICHETTA_NOTA, ERRORE_IMPORTO, ERRORE_GIORNO,
  RESTA_DA_INCASSARE, MODO_SALDO, MODO_ALTRO, GRUPPO_MODI, SPIEGA_SALDO, SPIEGA_ALTRO, DOPO_IL_PAGAMENTO_RESTA, NIENTE_DA_SALDARE,
  OLTRE_IL_TOTALE_FOGLIO, CONTO_CAMBIATO, LIMITE_SALVATAGGIO_MS, ERRORE_SALVATAGGIO_SCADUTO, conLimite, type Scadenza,
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

/** Il foglio ha un'altezza fissa, quella del caso più lungo + 24 px + «Annulla
 *  · Salva il pagamento» (ritocchi del 29/09/2026, B1): «Altro importo» con la
 *  nota, sul conto già saldato (le due righe d'avviso in più), misurata a 390
 *  px: 611 (prima 700). L'avviso di un esito incerto, quando capita, scorre dentro. */
export const ALTEZZA_FOGLIO_PAGAMENTO = 611
/** «28 settembre 2026» */
const giornoInParole = (iso: string) => { const [a, m, g] = iso.split('-').map(Number); return iso ? `${g} ${MESI_LUNGHI[m - 1]} ${a}` : 'da scegliere' }

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
  const [incerto, setIncerto] = useState<TentativoIncerto | null>(() => tentativoIncerto(booking, righe))
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
  // Il numero del salvataggio: una risposta arrivata dopo il limite di tempo
  // vale solo se nel frattempo non ne è partito un altro
  const giroSalva = useRef(0)
  // Conferma B (28/09/2026): la spunta, poi il foglio si chiude da solo e la scheda (o la Home) riceve l'esito
  const [salvato, setSalvato] = useState<(Salvataggio & { esito: PagamentoSalvato }) | null>(null)
  const nome = nomeConAltri(booking) || 'Ospite'
  const camere = [...new Set(righe.filter(r => r.status !== 'annullata').map(r => String((r as { rooms?: { name?: string | null } | null }).rooms?.name ?? '').split(' ').slice(-1)[0]).filter(Boolean))].join(' → ')
  const arrivo = righe.filter(r => r.status !== 'annullata').reduce((m, r) => (!m || r.check_in < m ? r.check_in : m), '')
  const partenza = righe.filter(r => r.status !== 'annullata').reduce((m, r) => (r.check_out > m ? r.check_out : m), '')
  const sottotitolo = [camere, arrivo && partenza ? periodoCompatto(arrivo, partenza) : '', TITOLO_PAGAMENTO].filter(Boolean).join(' · ')

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
    // Mai più «Salvo…» per sempre (29/09/2026, pagamento di Ledi): dopo 10
    // secondi il foglio lo dice e «Salva» torna attivo. Riprovare non
    // raddoppia (stessa chiave custodita, e il controllo del gemello).
    const giro = ++giroSalva.current
    const richiesta = registraPagamento(booking, righe, dati, { totaleAttesoCent: totaleCent, ricevutiAttesiCent: ricevutiCent })
    let risposta: Scadenza<EsitoPagamento> | null
    try {
      risposta = await conLimite(richiesta, LIMITE_SALVATAGGIO_MS)
    } catch {
      risposta = null   // la richiesta è finita con un errore: lo si dice, niente «Salvo…»
    } finally {
      inCorso.current = false
      setSalvando(false)
    }
    if (!risposta || risposta.scaduto) {
      setErrore(ERRORE_SALVATAGGIO_SCADUTO)
      // la risposta arriva tardi ed è buona: se intanto non è partito un altro
      // salvataggio, il foglio si chiude con «Salvato» come sempre
      if (risposta) richiesta.then(tardi => {
        if (tardi.esito === 'ok' && giro === giroSalva.current && !inCorso.current) {
          setErrore(null)
          setSalvato({ cosa: COSA_SALVATA.pagamento(nome, !!tardi.giaRegistrato), quando: new Date(), esito: { ...tardi, importo: dati.importo, metodo: dati.metodo, ritrovato: !!tardi.giaRegistrato } })
        }
      }).catch(() => { /* già detto: riprova */ })
      return
    }
    const esito = risposta.valore
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
    setSalvato({ cosa: COSA_SALVATA.pagamento(nome, !!esito.giaRegistrato), quando: new Date(), esito: { ...esito, importo: dati.importo, metodo: dati.metodo, ritrovato: !!esito.giaRegistrato } })
  }

  async function verifica() {
    if (verificando || inCorso.current) return
    setVerificando(true)
    setErrore(null)
    setEsitoVerifica(null)
    let esito: Awaited<ReturnType<typeof verificaPagamento>>
    try { esito = await verificaPagamento(booking, righe) } finally { setVerificando(false) }
    if (esito.esito === 'ritrovato') {
      setSalvato({ cosa: COSA_SALVATA.pagamento(nome, true), quando: new Date(), esito: { esito: 'ok', pagamenti: esito.pagamenti, pagato: esito.pagato, avviso: esito.avviso, importo: esito.tentativo.importo, metodo: (esito.tentativo.metodo === 'bonifico' ? 'bonifico' : 'contanti'), ritrovato: true } })
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

  return (
    <FoglioMaison titolo={nome} sottotitolo={sottotitolo} altezza={ALTEZZA_FOGLIO_PAGAMENTO} onChiudi={salvato ? () => {} : onChiudi} dati="pagamento"
      salvato={salvato} onFineSalvato={() => { if (salvato) onSalvato(salvato.esito) }}
      piede={<PiedeMaison azione={incerto ? COMANDO_RIPROVA_PAGAMENTO : SALVA_PAGAMENTO} onAzione={salva} salvando={salvando} disabilitato={cent == null || (!!incerto && !riprovabile) || !!salvato} onAnnulla={onChiudi} dati="pagamento" />}>
      <div data-foglio-pagamento>
        {/* In cima: quanto resta da incassare, dal conto autorevole della scheda */}
        <div data-resta-da-incassare>
          <span className="mz-lab">{RESTA_DA_INCASSARE}</span>
          <strong data-residuo-attuale className="mz-grande" style={{ fontWeight: 300, display: 'block' }}>{euroScheda(Math.max(0, residuoCent))}</strong>
        </div>
        {residuoCent < 0 && <p data-oltre-il-totale className="mz-hint">{OLTRE_IL_TOTALE_FOGLIO(-residuoCent)}</p>}
        {nienteDaSaldare && residuoCent === 0 && <p data-niente-da-saldare className="mz-hint">{NIENTE_DA_SALDARE}</p>}

        {/* Il tipo di pagamento: saldo completo, oppure un altro importo */}
        <span className="mz-lab">{GRUPPO_MODI}</span>
        <div role="group" aria-label={GRUPPO_MODI} className="mz-seg">
          <button type="button" data-modo="saldo" aria-pressed={modo === 'saldo'} disabled={nienteDaSaldare || !!incerto} onClick={scegliSaldo} className={modo === 'saldo' ? 'on' : ''}>{MODO_SALDO}</button>
          <button type="button" data-modo="altro" aria-pressed={modo === 'altro'} disabled={!!incerto} onClick={scegliAltro} className={modo === 'altro' ? 'on' : ''}>{MODO_ALTRO}</button>
        </div>
        <p id="pagamento-spiegazione" data-spiegazione className="mz-hint">{modo === 'saldo' ? SPIEGA_SALDO : SPIEGA_ALTRO}</p>

        <div className="mz-g3" style={{ marginTop: 14 }}>
          <label><span className="mz-lab">{ETICHETTA_QUANTO}</span>
            <input ref={campoImporto} type="text" inputMode="decimal" autoComplete="off" data-campo="importo" value={importo} readOnly={modo === 'saldo' || !!incerto}
              aria-describedby="pagamento-spiegazione" onChange={e => { if (!incerto) setImporto(e.target.value) }} className="mz-fld grande" /></label>
          <label style={{ gridColumn: 'span 2' }}><span className="mz-lab">{ETICHETTA_QUANDO}</span>
            <span className="relative block">
              <span className="mz-fld grande" data-data-scritta>{giornoInParole(giorno)}</span>
              <input type="date" data-campo="giorno" value={giorno} onChange={e => { if (!incerto) setGiorno(e.target.value) }} onClick={e => apriSelettore(e.currentTarget)}
                style={{ position: 'absolute', inset: '-8px 0', width: '100%', opacity: 0, cursor: 'pointer' }} />
            </span></label>
        </div>
        <span className="mz-lab">{ETICHETTA_COME}</span>
        <div className="mz-chips">
          {MODI_PAGAMENTO.map(m => (
            <button key={m.chiave} type="button" data-pastiglia={`modo-${m.chiave}`} aria-pressed={metodo === m.chiave} className={`mz-chip ${metodo === m.chiave ? 'on' : ''}`} onClick={() => { if (!incerto) setMetodo(m.chiave) }}>{m.testo}</button>
          ))}
        </div>
        <label className="block"><span className="mz-lab">{ETICHETTA_NOTA}</span>
          <input type="text" data-campo="nota" value={nota} readOnly={!!incerto} onChange={e => { if (!incerto) setNota(e.target.value) }} className="mz-fld ui" /></label>

        {/* Quanto resterà dopo questo pagamento: si aggiorna mentre si scrive */}
        <div aria-live="polite">
          <p data-dopo-resta className="mz-hint" style={{ marginTop: 14 }}>
            {DOPO_IL_PAGAMENTO_RESTA} <b data-residuo-previsto style={{ fontWeight: 500, color: 'var(--m-ink)' }}>{previsto.cifra}</b>
            {previsto.esito && <span data-esito> · {previsto.esito}</span>}
          </p>
          {previsto.oltre && <p data-oltre-il-dovuto className="mz-errore">{previsto.oltre}</p>}
          {importoScrittoMale && <p data-errore-importo className="mz-errore">{ERRORE_IMPORTO}</p>}
          {avvisoConto && <p data-conto-cambiato className="mz-errore">{avvisoConto}</p>}
        </div>
        {errore && errore !== MESSAGGIO_ESITO_INCERTO && <AvvisoAzione testo={errore} className="mt-3" />}
        {incerto && (
          <div data-tentativo-incerto role="alert" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--m-line)' }}>
            <p className="mz-errore" style={{ marginTop: 0 }}>
              {errore === MESSAGGIO_ESITO_INCERTO ? MESSAGGIO_ESITO_INCERTO : TENTATIVO_IN_SOSPESO(euroScheda(Math.round(incerto.importo * 100)), incerto.metodo, dataConGiorno(incerto.giorno))}
            </p>
            {errore === MESSAGGIO_ESITO_INCERTO && <p className="mz-hint">{TENTATIVO_IN_SOSPESO(euroScheda(Math.round(incerto.importo * 100)), incerto.metodo, dataConGiorno(incerto.giorno))}</p>}
            <button type="button" data-verifica-pagamento onClick={verifica} disabled={verificando} className="mz-lnk" style={{ marginTop: 10 }}>{verificando ? 'Controllo…' : COMANDO_VERIFICA_PAGAMENTO}</button>
          </div>
        )}
        {esitoVerifica && <p data-esito-verifica className="mz-note">{esitoVerifica}</p>}
      </div>
    </FoglioMaison>
  )
}
