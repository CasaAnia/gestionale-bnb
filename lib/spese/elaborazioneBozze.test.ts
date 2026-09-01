// ============================================================================
// Test LOCALI dell'elaborazione «SOLO BOZZE» (scheda E01–E07): archivio
// finto, scrittore registratore, nessuna rete. La foto letta diventa
// bozze con dubbi dichiarati — MAI spese definitive.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  costruisciPacchettoBozze, elaboraDocumento,
  type ContestoElaborazione, type LetturaDocumento, type PacchettoBozze,
  type RichiestaSostituzione, type ScrittoreBozze,
} from './elaborazioneBozze.ts'

const CONTESTO: Omit<ContestoElaborazione, 'documentId'> = {
  gruppi: [
    { id: 'g-casa', ambito: 'personale' }, { id: 'g-matteo', ambito: 'personale' },
    { id: 'g-bnb', ambito: 'azienda' },
  ],
  sottoCanoniche: [{ id: 'sc-pane', canonical_category_id: 'c-alim' }],
}

// una lettura MISTA realistica: due sorelle, dubbi, esclusa, arrotondamento
const letturaMista = (): LetturaDocumento => ({
  totale: 12.5,
  sorelle: [
    {
      ambito: 'personale', destinatario: 'g-casa', data: '2026-08-29',
      negozio: 'Mercato di Rozzano', arrotondamento_cent: 1,
      dubbi: [{ campo: 'store', confidence: 0.55, motivo: 'nome del negozio poco leggibile' }],
      voci: [
        { raw_name: 'FRUTTA MISTA KG1', name: 'Frutta mista', amount: 4.5, sottocategoria: 'Frutta' },
        { raw_name: 'PANE COMUNE', name: 'Pane comune', amount: 2.5, sottocategoria: 'Pane', canonical_category_id: 'c-alim', canonical_subcategory_id: 'sc-pane', dubbi: [{ campo: 'amount', confidence: 0.6, motivo: 'importo poco leggibile' }] },
        { raw_name: 'PANE COMUNE', name: 'Pane (letto due volte)', amount: 2.5, sottocategoria: 'Pane', escludi: true },
        { raw_name: null, name: 'Sacchetto', amount: 0.5, sottocategoria: 'Sacchetti' },
      ],
    },
    {
      ambito: 'azienda', destinatario: 'g-bnb', data: '2026-08-29',
      negozio: 'Mercato di Rozzano', metodo: 'contanti',
      voci: [{ raw_name: 'ACETO ALCOL X2', name: 'Aceto di alcol', qty: 2, amount: 4.99, sottocategoria: 'Detersivi e pulizia' }],
    },
  ],
})
// 4,50+2,50+0,50+0,01 (arrot.) + 4,99 = 12,50 ✓ (l'esclusa non conta)

// SCRITTORE REGISTRATORE: archivio finto + registro di OGNI metodo
// chiamato (per la controprova del perimetro E07)
function scrittoreFinto(statoIniziale = 'da_elaborare') {
  const archivio = {
    documento: { status: statoIniziale, doc_total: null as number | null, error_message: null as string | null },
    bozze: new Map<string, Record<string, unknown>>(),
    righe: [] as Record<string, unknown>[],
  }
  const chiamate: string[] = []
  let n = 0
  const guasti = { bozzaRotta: false, rigaRotta: false }
  const scrittore: ScrittoreBozze = {
    async leggiDocumento(id) { chiamate.push('leggiDocumento'); void id; return { documento: { status: archivio.documento.status } } },
    async rimuoviBozzeDi() {
      chiamate.push('rimuoviBozzeDi')
      archivio.bozze.clear(); archivio.righe = []
      return {}
    },
    async inserisciBozza(b) {
      chiamate.push('inserisciBozza')
      if (guasti.bozzaRotta) return { errore: 'inserimento negato (finto)' }
      const id = `boz-${++n}`
      archivio.bozze.set(id, b as Record<string, unknown>)
      return { id }
    },
    async inserisciRiga(r) {
      chiamate.push('inserisciRiga')
      if (guasti.rigaRotta) return { errore: 'inserimento negato (finto)' }
      archivio.righe.push(r as Record<string, unknown>)
      return {}
    },
    async aggiornaDocumento(id, campi) {
      chiamate.push('aggiornaDocumento')
      void id
      Object.assign(archivio.documento, campi)
      return {}
    },
  }
  return { scrittore, archivio, chiamate, guasti }
}

test('E01 · scontrino MISTO → 2 sorelle, righe complete, confidence coi motivi, doc_total, in_revisione; MAI spese', async () => {
  const f = scrittoreFinto()
  const esito = await elaboraDocumento(f.scrittore, 'd1', { lettura: letturaMista() }, CONTESTO)
  assert.deepEqual(esito, { ok: true, bozze: 2, righe: 5 })
  assert.equal(f.archivio.documento.status, 'in_revisione')
  assert.equal(f.archivio.documento.doc_total, 12.5)
  assert.equal(f.archivio.documento.error_message, null)
  const bozze = [...f.archivio.bozze.values()]
  assert.deepEqual(bozze.map(b => b.group_id), ['g-casa', 'g-bnb'])
  assert.equal(bozze[0].arrotondamento_cent, 1)
  assert.equal((bozze[0].confidence as Record<string, { doubt_reason: string }>).store.doubt_reason, 'nome del negozio poco leggibile')
  assert.equal(bozze[1].payment_method, 'contanti')
  const pane = f.archivio.righe.find(r => r.name === 'Pane comune')!
  assert.equal(pane.raw_name, 'PANE COMUNE')
  assert.equal((pane.confidence as Record<string, { confidence: number }>).amount.confidence, 0.6)
  assert.equal(pane.canonical_subcategory_id, 'sc-pane')
  const esclusa = f.archivio.righe.find(r => r.excluded)!
  assert.equal(esclusa.name, 'Pane (letto due volte)')
  assert.ok(f.archivio.righe.every(r => r.user_added === false))
})

test('E02 · vincoli: quadratura senza dubbio, sottocategoria vuota, canonica incoerente, valori → RIFIUTI espliciti', () => {
  const ctx = { ...CONTESTO, documentId: 'd1' }
  const quadra = letturaMista(); quadra.totale = 13
  assert.match((costruisciPacchettoBozze(quadra, ctx) as { errore: string }).errore, /quadratura non esatta.*nessun dubbio/)
  // con il DUBBIO dichiarato la stessa lettura passa (deciderà Ania)
  quadra.dubbioTotale = { campo: 'doc_total', confidence: 0.4, motivo: 'totale poco leggibile' }
  assert.equal(costruisciPacchettoBozze(quadra, ctx).ok, true)
  const vuota = letturaMista(); vuota.sorelle[0].voci[0].sottocategoria = ' '
  assert.match((costruisciPacchettoBozze(vuota, ctx) as { errore: string }).errore, /sottocategoria vuota/)
  const incoerente = letturaMista()
  incoerente.sorelle[0].voci[1].canonical_category_id = 'c-altro'
  assert.match((costruisciPacchettoBozze(incoerente, ctx) as { errore: string }).errore, /canonica incoerente/)
  const negativa = letturaMista(); negativa.sorelle[0].voci[0].qty = 0
  assert.match((costruisciPacchettoBozze(negativa, ctx) as { errore: string }).errore, /qty/)
  const senzaMetodo = letturaMista(); delete senzaMetodo.sorelle[1].metodo
  assert.match((costruisciPacchettoBozze(senzaMetodo, ctx) as { errore: string }).errore, /metodo di pagamento è OBBLIGATORIO/)
  const totaleNull = letturaMista(); totaleNull.totale = null
  assert.match((costruisciPacchettoBozze(totaleNull, ctx) as { errore: string }).errore, /totale non letto/)
})

test('E03 · idempotenza: documento in revisione/confermato NON rielaborabile; da errore la rielaborazione SOSTITUISCE', async () => {
  for (const stato of ['in_revisione', 'confermato']) {
    const f = scrittoreFinto(stato)
    const esito = await elaboraDocumento(f.scrittore, 'd1', { lettura: letturaMista() }, CONTESTO)
    assert.equal(!esito.ok && esito.stato, 'rifiutata')
    assert.ok(!f.chiamate.includes('inserisciBozza'), 'nessuna bozza scritta')
  }
  // giro 1 in errore (lettura fallita), giro 2 buono: le bozze sono UNA serie sola
  const f = scrittoreFinto()
  await elaboraDocumento(f.scrittore, 'd1', { errore: 'foto illeggibile' }, CONTESTO)
  assert.equal(f.archivio.documento.status, 'errore')
  const secondo = await elaboraDocumento(f.scrittore, 'd1', { lettura: letturaMista() }, CONTESTO)
  assert.equal(secondo.ok, true)
  assert.equal(f.archivio.bozze.size, 2)
  assert.equal(f.archivio.righe.length, 5)
  assert.equal(f.archivio.documento.status, 'in_revisione')
})

test('E04 · lettura fallita o scrittura interrotta → errore col motivo, NESSUNA bozza parziale', async () => {
  const f1 = scrittoreFinto()
  const esito = await elaboraDocumento(f1.scrittore, 'd1', { errore: 'foto sfocata: rifare' }, CONTESTO)
  assert.equal(!esito.ok && esito.stato, 'documento_errore')
  assert.equal(f1.archivio.documento.error_message, 'foto sfocata: rifare')
  assert.equal(f1.archivio.bozze.size, 0)
  // scrittura delle RIGHE che cade a metà: niente parziali visibili
  const f2 = scrittoreFinto()
  f2.guasti.rigaRotta = true
  const rotto = await elaboraDocumento(f2.scrittore, 'd1', { lettura: letturaMista() }, CONTESTO)
  assert.equal(!rotto.ok && rotto.stato, 'errore_scrittura')
  assert.equal(f2.archivio.bozze.size, 0, 'le bozze inserite prima del guasto sono state ritirate')
  assert.equal(f2.archivio.righe.length, 0)
  assert.equal(f2.archivio.documento.status, 'errore')
  assert.match(f2.archivio.documento.error_message ?? '', /interrotta/)
})

test('E05 · possibile duplicato: ANNOTATO come dubbio, elaborazione conclusa, scarto mai automatico', async () => {
  const f = scrittoreFinto()
  const esito = await elaboraDocumento(f.scrittore, 'd1', { lettura: letturaMista() },
    { ...CONTESTO, duplicato: { messaggio: 'possibile duplicato di «Mercato di Rozzano» del 29/08 (stessa foto)' } })
  assert.equal(esito.ok, true)                                     // NON scartato
  assert.equal(f.archivio.documento.status, 'in_revisione')
  const prima = [...f.archivio.bozze.values()][0]
  assert.match((prima.confidence as Record<string, { doubt_reason: string }>).duplicato.doubt_reason, /possibile duplicato/)
})

test('E06 · nota di Ania non attribuibile con certezza → DUBBIO dichiarato, mai un\'ipotesi silenziosa', async () => {
  const f = scrittoreFinto()
  const lettura = letturaMista()
  lettura.notaNonAttribuita = 'metà è di Casa Ania'
  const esito = await elaboraDocumento(f.scrittore, 'd1', { lettura }, { ...CONTESTO, nota: 'metà è di Casa Ania' })
  assert.equal(esito.ok, true)
  const prima = [...f.archivio.bozze.values()][0]
  assert.match((prima.confidence as Record<string, { doubt_reason: string }>).nota.doubt_reason, /non attribuibile con certezza/)
})

// SCRITTORE ATOMICO finto (revisione R1): il primitivo sostituisciBozze
// è UNA transazione simulata — arbitraggio sullo stato dentro di lui,
// e un guasto lascia l'archivio ESATTAMENTE com'era (rollback totale)
function scrittoreAtomicoFinto(statoIniziale = 'da_elaborare') {
  const archivio = {
    documento: { status: statoIniziale, doc_total: null as number | null, error_message: null as string | null },
    bozze: [] as PacchettoBozze['bozze'], righe: [] as PacchettoBozze['righe'],
  }
  const guasti = { transazioneRotta: false }
  const scrittore: ScrittoreBozze = {
    async leggiDocumento() { return { documento: { status: archivio.documento.status } } },
    async sostituisciBozze(_id: string, richiesta: RichiestaSostituzione) {
      if (!richiesta.statiAmmessi.includes(archivio.documento.status))
        return { ok: false as const, statoAttuale: archivio.documento.status, errore: `stato «${archivio.documento.status}» non ammesso` }
      if (guasti.transazioneRotta)
        return { ok: false as const, errore: 'transazione annullata (finto): ROLLBACK, nessun effetto' }
      if (richiesta.errore !== undefined) {
        archivio.bozze = []; archivio.righe = []
        archivio.documento = { status: 'errore', doc_total: null, error_message: richiesta.errore }
        return { ok: true as const, bozze: 0, righe: 0 }
      }
      archivio.bozze = [...richiesta.pacchetto.bozze]
      archivio.righe = [...richiesta.pacchetto.righe]
      archivio.documento = { status: 'in_revisione', doc_total: richiesta.pacchetto.documento.doc_total, error_message: null }
      return { ok: true as const, bozze: richiesta.pacchetto.bozze.length, righe: richiesta.pacchetto.righe.length }
    },
  }
  return { scrittore, archivio, guasti }
}

test('R1 · scrittore ATOMICO: il giro buono passa dal SOLO primitivo e produce bozze+stato in un colpo', async () => {
  const f = scrittoreAtomicoFinto()
  const esito = await elaboraDocumento(f.scrittore, 'd1', { lettura: letturaMista() }, CONTESTO)
  assert.deepEqual(esito, { ok: true, bozze: 2, righe: 5 })
  assert.equal(f.archivio.documento.status, 'in_revisione')
  assert.equal(f.archivio.documento.doc_total, 12.5)
  assert.equal(f.archivio.bozze.length, 2)
  assert.equal(f.archivio.righe.length, 5)
})

test('R1 · scrittore ATOMICO, ROLLBACK: il primitivo che fallisce non lascia NIENTE — né bozze né stati cambiati', async () => {
  const f = scrittoreAtomicoFinto()
  f.guasti.transazioneRotta = true
  const esito = await elaboraDocumento(f.scrittore, 'd1', { lettura: letturaMista() }, CONTESTO)
  assert.equal(!esito.ok && esito.stato, 'errore_scrittura')
  assert.match(!esito.ok ? esito.errore : '', /ROLLBACK/)
  // l'archivio è ESATTAMENTE quello di partenza: questa è l'atomicità
  assert.deepEqual(f.archivio.documento, { status: 'da_elaborare', doc_total: null, error_message: null })
  assert.equal(f.archivio.bozze.length, 0)
  assert.equal(f.archivio.righe.length, 0)
})

test('R1 · scrittore ATOMICO, CONCORRENZA: due elaborazioni simultanee → una sola riesce, mai bozze doppie', async () => {
  const f = scrittoreAtomicoFinto()
  const esiti = await Promise.all([
    elaboraDocumento(f.scrittore, 'd1', { lettura: letturaMista() }, CONTESTO),
    elaboraDocumento(f.scrittore, 'd1', { lettura: letturaMista() }, CONTESTO),
  ])
  assert.equal(esiti.filter(e => e.ok).length, 1, `esiti: ${JSON.stringify(esiti)}`)
  const rifiutata = esiti.find(e => !e.ok)!
  assert.equal(!rifiutata.ok && rifiutata.stato, 'rifiutata')
  assert.equal(f.archivio.bozze.length, 2)
  assert.equal(f.archivio.righe.length, 5)
})

test('R1 · errore LANCIATO dallo scrittore (non solo restituito): esito onesto e niente parziali', async () => {
  const f = scrittoreFinto()
  const scrittoreCheEsplode: ScrittoreBozze = {
    ...(f.scrittore as Extract<ScrittoreBozze, { rimuoviBozzeDi: unknown }>),
    async inserisciRiga() { throw new Error('rete caduta (finto)') },
  }
  const esito = await elaboraDocumento(scrittoreCheEsplode, 'd1', { lettura: letturaMista() }, CONTESTO)
  assert.equal(!esito.ok && esito.stato, 'errore_scrittura')
  assert.match(!esito.ok ? esito.errore : '', /rete caduta/)
  assert.equal(f.archivio.bozze.size, 0, 'nessuna bozza parziale dopo l\'eccezione')
  assert.equal(f.archivio.documento.status, 'errore')
})

test('R2 · contratto della NOTA: applicata col come → passa; ignorata, incoerente o senza come → RIFIUTI', () => {
  const ctx = { ...CONTESTO, documentId: 'd1', nota: 'metà è di Casa Ania' }
  // dichiarata APPLICATA col come: il pacchetto passa
  const applicata = letturaMista()
  applicata.notaApplicata = { nota: 'metà è di Casa Ania', come: 'la parte di Casa Ania è la sorella azienda' }
  assert.equal(costruisciPacchettoBozze(applicata, ctx).ok, true)
  // nessuna dichiarazione: RIFIUTO (la nota non si ignora)
  assert.match((costruisciPacchettoBozze(letturaMista(), ctx) as { errore: string }).errore, /nota di Ania presente.*non dichiara/)
  // applicata SENZA come: la dichiarazione non è verificabile
  const senzaCome = letturaMista()
  senzaCome.notaApplicata = { nota: 'metà è di Casa Ania', come: ' ' }
  assert.match((costruisciPacchettoBozze(senzaCome, ctx) as { errore: string }).errore, /senza dire COME/)
  // dichiara una nota DIVERSA da quella del documento
  const diversa = letturaMista()
  diversa.notaApplicata = { nota: 'tutto per Matteo', come: 'unica sorella' }
  assert.match((costruisciPacchettoBozze(diversa, ctx) as { errore: string }).errore, /nota diversa/)
  // applicata E non attribuibile insieme: la lettura deve scegliere
  const doppia = letturaMista()
  doppia.notaApplicata = { nota: 'metà è di Casa Ania', come: 'sorella azienda' }
  doppia.notaNonAttribuita = 'metà è di Casa Ania'
  assert.match((costruisciPacchettoBozze(doppia, ctx) as { errore: string }).errore, /deve scegliere/)
  // dichiarazione di una nota che il documento NON ha
  const inventata = letturaMista()
  inventata.notaApplicata = { nota: 'x', come: 'y' }
  assert.match((costruisciPacchettoBozze(inventata, { ...CONTESTO, documentId: 'd1' }) as { errore: string }).errore, /nota che il documento non ha/)
})

test('R2 · falsi dubbi INVISIBILI: confidence sopra soglia/non finita, motivo o campo vuoti → RIFIUTI', () => {
  const ctx = { ...CONTESTO, documentId: 'd1' }
  // dubbio sul totale con confidence 1 e motivo vuoto (riproduzione Codex)
  const invisibile = letturaMista(); invisibile.totale = 13
  invisibile.dubbioTotale = { campo: 'doc_total', confidence: 1, motivo: '' }
  assert.match((costruisciPacchettoBozze(invisibile, ctx) as { errore: string }).errore, /dubbio sul totale non valido/)
  // dubbio sul totale con campo NON pertinente
  const fuoriCampo = letturaMista(); fuoriCampo.totale = 13
  fuoriCampo.dubbioTotale = { campo: 'store', confidence: 0.4, motivo: 'boh' }
  assert.match((costruisciPacchettoBozze(fuoriCampo, ctx) as { errore: string }).errore, /deve essere doc_total/)
  // dubbio di VOCE senza motivo
  const senzaMotivo = letturaMista()
  senzaMotivo.sorelle[0].voci[0].dubbi = [{ campo: 'amount', confidence: 0.4, motivo: '  ' }]
  assert.match((costruisciPacchettoBozze(senzaMotivo, ctx) as { errore: string }).errore, /motivo vuoto/)
  // dubbio di SORELLA con confidence non finita
  const nonFinita = letturaMista()
  nonFinita.sorelle[0].dubbi = [{ campo: 'store', confidence: Number.NaN, motivo: 'illeggibile' }]
  assert.match((costruisciPacchettoBozze(nonFinita, ctx) as { errore: string }).errore, /non finita o non sotto la soglia/)
  // dubbio con campo vuoto
  const senzaCampo = letturaMista()
  senzaCampo.sorelle[0].voci[0].dubbi = [{ campo: '', confidence: 0.4, motivo: 'illeggibile' }]
  assert.match((costruisciPacchettoBozze(senzaCampo, ctx) as { errore: string }).errore, /campo mancante/)
})

test('E07 · PERIMETRO: l\'elaborazione chiama SOLO i metodi delle bozze, mai quelli delle spese (controprova)', async () => {
  const f = scrittoreFinto()
  // il registratore riceve ANCHE metodi da spese definitive: se il
  // modulo li toccasse, comparirebbero nel registro delle chiamate
  const esca = {
    ...f.scrittore,
    inserisciSpesa: async () => { f.chiamate.push('inserisciSpesa'); return {} },
    confermaDocumento: async () => { f.chiamate.push('confermaDocumento'); return {} },
    eliminaSpesa: async () => { f.chiamate.push('eliminaSpesa'); return {} },
  } as ScrittoreBozze
  const esito = await elaboraDocumento(esca, 'd1', { lettura: letturaMista() }, CONTESTO)
  assert.equal(esito.ok, true)
  const consentiti = new Set(['leggiDocumento', 'rimuoviBozzeDi', 'inserisciBozza', 'inserisciRiga', 'aggiornaDocumento'])
  assert.ok(f.chiamate.every(c => consentiti.has(c)),
    `metodi fuori perimetro chiamati: ${f.chiamate.filter(c => !consentiti.has(c)).join(', ')}`)
})
