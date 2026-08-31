// ============================================================================
// Test LOCALI del CONTRATTO di revisione (parte approvata per lo
// sviluppo: giornale, batch atomico, versioni, chiusure coordinate,
// stati modificabili, identità completa) contro il server finto
// RIGOROSO. Niente pagine operative, niente Supabase: la verità
// dell'implementazione SQL resta DA DIMOSTRARE nel collaudo isolato.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  batchSalvaDa, canonico, corrisponde, manifestoConferma, manifestoSalva,
  type OperazioneContratto,
} from './contrattoRevisione.ts'
import {
  depositoOperazioniInMemoria, eseguiConferma, eseguiSalva, eseguiScarto,
  recuperaOperazione,
} from './contrattoScrittura.ts'
import { creaServerContratto, type MondoFinto } from './contrattoServerFinto.ts'
import { VETTORI } from './contrattoVettori.ts'
import { aggiungiRiga, apriRevisione, modificaBozza, modificaRiga, modificaTotale, type BozzaGrezza, type RigaGrezza } from './revisione.ts'

const sha = async (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')

const bozza = (x: Partial<BozzaGrezza> & { id: string }): BozzaGrezza => ({
  document_id: 'd1', status: 'da_controllare', expense_date: '2026-08-29',
  group_id: 'g-casa', category_id: null, subcategory: null,
  canonical_category_id: null, canonical_subcategory_id: null,
  store: 'Mercato', description: null, payment_method: 'contanti',
  room_id: null, expense_nature: null, arrotondamento_cent: 0, confidence: null, ...x,
})
const riga = (x: Partial<RigaGrezza> & { id: string; draft_id: string; amount: number }): RigaGrezza => ({
  raw_name: null, name: 'Voce', qty: 1, unit_price: null, discount: 0,
  group_id: null, category_id: null, subcategory: null,
  canonical_category_id: null, canonical_subcategory_id: null,
  necessity: null, planning: null, excluded: false, user_added: false, confidence: null, ...x,
})

function mondoBase(): MondoFinto {
  return {
    documenti: new Map([['d1', { status: 'in_revisione', revisione_rev: 0, doc_total: 5 }],
      ['d2', { status: 'in_revisione', revisione_rev: 0, doc_total: 3 }]]),
    bozze: new Map([
      ['b1', { document_id: 'd1', status: 'da_controllare', store: 'Mercato' }],
      ['b2', { document_id: 'd2', status: 'da_controllare', store: 'Altro' }],
      ['b3', { document_id: 'd1', status: 'confermata', store: 'Storica' }],
    ]),
    righe: new Map([['r1', { draft_id: 'b1', name: 'Voce', amount: 5, qty: 1, discount: 0 }]]),
  }
}
const statoBase = () => apriRevisione('d1', 5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])

test('VETTORI COMUNI: la canonicalizzazione del client produce esattamente forma e impronta fissate (base anche per il collaudo SQL)', async () => {
  for (const v of VETTORI) {
    assert.equal(canonico(v.valore), v.canonico, v.nome)
    assert.equal(await sha(canonico(v.valore)), v.sha256, v.nome)
  }
  // il campo undefined viene OMESSO (stesso canonico del vettore salvato)
  const conUndefined = { a: null, b: undefined, c: 'c' }
  const atteso = VETTORI.find(v => v.nome.includes('undefined'))!
  assert.equal(canonico(conUndefined), atteso.canonico)
})

test('APPLICAZIONE: un Salva = un batch atomico — modifiche, totale e voce nuova insieme; mappa client_ref→id; rev incrementata; custodia chiusa', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  s = modificaRiga(s, 'r1', { amount: 4.5 })
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  s = modificaTotale(s, 500)
  const esito = await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')
  assert.ok(esito.ok && !('nulla' in esito))
  assert.ok(esito.ok && !('nulla' in esito) && esito.revDopo === 1)
  assert.ok(esito.ok && !('nulla' in esito) && esito.mappaNuove['loc-1'].startsWith('srv-'))
  assert.equal(mondo.bozze.get('b1')!.store, 'Iper')
  assert.equal(mondo.righe.get('r1')!.amount, 4.5)
  assert.equal(mondo.documenti.get('d1')!.revisione_rev, 1)
  assert.equal(deposito.contenuto().length, 0)         // risposta arrivata → custodia chiusa
  // batch VUOTO: nessuna chiamata, nessuna custodia
  const pulito = statoBase()
  const niente = await eseguiSalva(cliente, deposito, pulito, 1, sha, 'op-vuota')
  assert.ok(niente.ok && 'nulla' in niente)
})

test('REPLAY per op_key: stesso batch ripetuto → RIPETUTA con lo STESSO esito e la STESSA mappa, senza doppioni', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  let s = statoBase()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  const primo = await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')
  const righePrima = mondo.righe.size
  const secondo = await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')
  assert.ok(primo.ok && !('nulla' in primo) && secondo.ok && !('nulla' in secondo))
  assert.ok(secondo.ok && !('nulla' in secondo) && secondo.ripetuta === true)
  assert.deepEqual(secondo.ok && !('nulla' in secondo) ? secondo.mappaNuove : null,
    primo.ok && !('nulla' in primo) ? primo.mappaNuove : undefined)
  assert.equal(mondo.righe.size, righePrima)           // NESSUN secondo inserimento
})

test('IDENTITÀ: stessa chiave con KIND, DOCUMENTO o CONTENUTO diversi → CHIAVE_RIUSATA, mai un esito estraneo', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  assert.ok((await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')).ok)
  // stessa chiave, kind diverso (conferma)
  const kindDiverso = await eseguiConferma(cliente, deposito, 'd1', 1, [], sha, 'op-1')
  assert.ok(!kindDiverso.ok && 'sentinella' in kindDiverso && kindDiverso.sentinella === 'CHIAVE_RIUSATA')
  // stessa chiave, documento diverso
  let s2 = apriRevisione('d2', 3, [bozza({ id: 'b2', document_id: 'd2' })], [])
  s2 = modificaBozza(s2, 'b2', { store: 'Cambiato' })
  const docDiverso = await eseguiSalva(cliente, deposito, s2, 0, sha, 'op-1')
  assert.ok(!docDiverso.ok && 'sentinella' in docDiverso && docDiverso.sentinella === 'CHIAVE_RIUSATA')
  assert.equal(mondo.bozze.get('b2')!.store, 'Altro')  // niente scritto
  // stessa chiave, contenuto diverso
  let s3 = statoBase()
  s3 = modificaBozza(s3, 'b1', { store: 'Esselunga' })
  const contenutoDiverso = await eseguiSalva(cliente, deposito, s3, 0, sha, 'op-1')
  assert.ok(!contenutoDiverso.ok && 'sentinella' in contenutoDiverso && contenutoDiverso.sentinella === 'CHIAVE_RIUSATA')
})

test('SUPERATA: base_rev vecchio → conflitto esplicito, niente scritto; vale anche per conferma e scarto tardivi', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  // B salva (rev 0→1)
  let sB = statoBase()
  sB = modificaBozza(sB, 'b1', { store: 'Nuovo di B' })
  assert.ok((await eseguiSalva(cliente, deposito, sB, 0, sha, 'op-B')).ok)
  // il Salva di A, rimasto alla revisione 0 → SUPERATA
  let sA = statoBase()
  sA = modificaBozza(sA, 'b1', { store: 'Vecchio di A' })
  const salvaA = await eseguiSalva(cliente, deposito, sA, 0, sha, 'op-A')
  assert.ok(!salvaA.ok && 'conflitto' in salvaA && salvaA.conflitto === 'superata')
  assert.equal(mondo.bozze.get('b1')!.store, 'Nuovo di B')
  // la CONFERMA tardiva di A (rev 0) NON approva i valori di B
  const confermaA = await eseguiConferma(cliente, deposito, 'd1', 0, [], sha, 'op-CA')
  assert.ok(!confermaA.ok && 'conflitto' in confermaA && confermaA.conflitto === 'superata')
  assert.equal(mondo.documenti.get('d1')!.status, 'in_revisione')
  // lo SCARTO tardivo idem: il lavoro di B non viene buttato
  const scartoA = await eseguiScarto(cliente, deposito, 'd1', 0, 'non serve', sha, 'op-SA')
  assert.ok(!scartoA.ok && 'conflitto' in scartoA && scartoA.conflitto === 'superata')
  assert.equal(mondo.documenti.get('d1')!.status, 'in_revisione')
})

test('STATI (lista positiva) e PERIMETRO: tutto respinto in blocco, atomicità garantita', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  // documento approvata_da_pagare → NON modificabile (le bozze alimentano il pagamento)
  mondo.documenti.get('d1')!.status = 'approvata_da_pagare'
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  const chiuso = await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')
  assert.ok(!chiuso.ok && 'sentinella' in chiuso && chiuso.sentinella === 'DOCUMENTO_NON_MODIFICABILE')
  assert.equal(mondo.bozze.get('b1')!.store, 'Mercato')
  mondo.documenti.get('d1')!.status = 'in_revisione'
  // bozza STORICA (confermata) nel batch → tutto respinto, anche la parte valida
  let s2 = apriRevisione('d1', 5, [bozza({ id: 'b1' }), bozza({ id: 'b3', status: 'da_controllare' })], [])
  s2 = modificaBozza(s2, 'b1', { store: 'Iper' })
  s2 = modificaBozza(s2, 'b3', { store: 'Toccata' })   // b3 nel mondo è 'confermata'
  const storica = await eseguiSalva(cliente, deposito, s2, 0, sha, 'op-2')
  assert.ok(!storica.ok && 'sentinella' in storica && storica.sentinella === 'BOZZA_NON_MODIFICABILE')
  assert.equal(mondo.bozze.get('b1')!.store, 'Mercato')  // ATOMICITÀ: nemmeno b1
  // bozza di un ALTRO documento → RIFERIMENTO_ESTRANEO
  let s3 = statoBase()
  s3 = { ...s3, modificheBozze: { b2: { store: 'Furto' } } }
  const estranea = await eseguiSalva(cliente, deposito, s3, 0, sha, 'op-3')
  assert.ok(!estranea.ok && 'sentinella' in estranea && estranea.sentinella === 'RIFERIMENTO_ESTRANEO')
  // riga inesistente → IDENTIFICATIVO_MANCANTE
  let s4 = statoBase()
  s4 = { ...s4, modificheRighe: { fantasma: { amount: 1 } } }
  const mancante = await eseguiSalva(cliente, deposito, s4, 0, sha, 'op-4')
  assert.ok(!mancante.ok && 'sentinella' in mancante && mancante.sentinella === 'IDENTIFICATIVO_MANCANTE')
  // client_ref duplicati → CLIENT_REF_DUPLICATO
  let s5 = statoBase()
  s5 = aggiungiRiga(s5, { draft_id: 'b1', name: 'Una', amount: 1 }, 'loc-x')
  s5 = { ...s5, righeNuove: [...s5.righeNuove, { ...s5.righeNuove[0], name: 'Due' }] }
  const doppio = await eseguiSalva(cliente, deposito, s5, 0, sha, 'op-5')
  assert.ok(!doppio.ok && 'sentinella' in doppio && doppio.sentinella === 'CLIENT_REF_DUPLICATO')
  // campo estraneo → CAMPO_NON_CONSENTITO
  let s6 = statoBase()
  s6 = { ...s6, modificheBozze: { b1: { confidence: {} } as never } }
  const estraneo = await eseguiSalva(cliente, deposito, s6, 0, sha, 'op-6')
  assert.ok(!estraneo.ok && 'sentinella' in estraneo && estraneo.sentinella === 'CAMPO_NON_CONSENTITO')
})

test('RISPOSTA PERSA (effetto applicato): incerto con custodia; RECUPERO per chiave → applicata con la mappa; reinvio stessa chiave → RIPETUTA', async () => {
  const mondo = mondoBase()
  const { cliente, guasti } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  let s = statoBase()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  guasti.perdiRisposta = true
  const perso = await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')
  guasti.perdiRisposta = false
  assert.ok(!perso.ok && 'incerto' in perso)
  assert.equal(deposito.contenuto().length, 1)         // la custodia RESTA
  // recupero per chiave: applicata, con la mappa per chiudere la pendenza
  const op = deposito.contenuto()[0]
  const recupero = await recuperaOperazione(cliente, deposito, op)
  assert.equal(recupero.stato, 'applicata')
  assert.ok(recupero.stato === 'applicata' && recupero.mappaNuove['loc-1'])
  assert.equal(deposito.contenuto().length, 0)
  // un reinvio (anche cieco) con la stessa chiave sarebbe comunque innocuo
  const righePrima = mondo.righe.size
  const reinvio = await eseguiSalva(cliente, depositoOperazioniInMemoria(), s, 0, sha, 'op-1')
  assert.ok(reinvio.ok && !('nulla' in reinvio) && reinvio.ripetuta === true)
  assert.equal(mondo.righe.size, righePrima)
})

test('ASSENTE vs ESTRANEA vs ILLEGGIBILE: il recupero chiude solo a corrispondenza PIENA', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  // assente: la richiesta non è MAI arrivata → reinvio sicuro con la stessa chiave
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  const batch = batchSalvaDa(s, 0)
  const op: OperazioneContratto = { opKey: 'op-mai', kind: 'salva', documentId: 'd1', baseRev: 0, impronta: await sha(manifestoSalva(batch)), clientRefs: [] }
  assert.equal((await recuperaOperazione(cliente, deposito, op)).stato, 'assente')
  const reinvio = await eseguiSalva(cliente, deposito, s, 0, sha, 'op-mai')
  assert.ok(reinvio.ok)
  // e se «l'originale» arrivasse DOPO il reinvio: stessa chiave → RIPETUTA
  const tardivo = await cliente.salvaRevisione({ op_key: 'op-mai', document_id: 'd1', base_rev: 0, modifiche: batch })
  assert.equal(tardivo.esito, 'RIPETUTA')
  // estranea: impronta custodita diversa → l'esito NON chiude la pendenza
  const manomessa = { ...op, impronta: 'impronta-diversa' }
  deposito.salva(manomessa)
  const estranea = await recuperaOperazione(cliente, deposito, manomessa)
  assert.equal(estranea.stato, 'estranea')
  assert.equal(deposito.contenuto().length, 1)         // pendenza conservata
  assert.equal(corrisponde(manomessa, await cliente.esitoRevisione('op-mai')), false)
  // illeggibile: lettura fallita ≠ assente
  const rotto = { ...cliente, esitoRevisione: async () => { throw new Error('Failed to fetch') } }
  const illeggibile = await recuperaOperazione(rotto, deposito, manomessa)
  assert.equal(illeggibile.stato, 'illeggibile')
  assert.equal(deposito.contenuto().length, 1)
})

test('CHIUSURE COORDINATE: conferma versionata applicata e giornalata (manifesto con kind e correzioni), replay identico; scarto col motivo nel manifesto', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  const correzioni = [{ field: 'store', proposed: 'Mercato', corrected: 'Iper', draft_id: 'b1' }]
  const prima = await eseguiConferma(cliente, deposito, 'd1', 0, correzioni, sha, 'op-c')
  assert.ok(prima.ok && !('nulla' in prima) && prima.spese?.length === 1)
  assert.equal(mondo.documenti.get('d1')!.status, 'confermato')
  assert.equal(mondo.bozze.get('b1')!.status, 'confermata')
  // replay della conferma: stesso esito, niente di nuovo
  const replay = await eseguiConferma(cliente, deposito, 'd1', 0, correzioni, sha, 'op-c')
  assert.ok(replay.ok && !('nulla' in replay) && replay.ripetuta === true)
  assert.deepEqual(replay.ok && !('nulla' in replay) ? replay.spese : null, prima.ok && !('nulla' in prima) ? prima.spese : undefined)
  // correzioni DIVERSE sotto la stessa chiave → CHIAVE_RIUSATA
  const diverse = await eseguiConferma(cliente, deposito, 'd1', 0, [], sha, 'op-c')
  assert.ok(!diverse.ok && 'sentinella' in diverse && diverse.sentinella === 'CHIAVE_RIUSATA')
  // manifesto della conferma: ordinamento stabile delle correzioni
  assert.equal(
    manifestoConferma('d1', 0, [{ field: 'b', draft_id: 'x' }, { field: 'a', draft_id: 'x' }]),
    manifestoConferma('d1', 0, [{ field: 'a', draft_id: 'x' }, { field: 'b', draft_id: 'x' }]))
  // scarto su documento ormai confermato → lista positiva
  const scarto = await eseguiScarto(cliente, deposito, 'd1', 1, 'tardi', sha, 'op-s')
  assert.ok(!scarto.ok && 'sentinella' in scarto && scarto.sentinella === 'DOCUMENTO_NON_MODIFICABILE')
})

test('CONCORRENZA: due invii identici in parallelo (stessa chiave) → UNA sola applicazione; la serializzazione per documento regge', async () => {
  const mondo = mondoBase()
  const { cliente, giornale } = creaServerContratto(mondo, sha)
  let s = statoBase()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  const [a, b] = await Promise.all([
    eseguiSalva(cliente, depositoOperazioniInMemoria(), s, 0, sha, 'op-par'),
    eseguiSalva(cliente, depositoOperazioniInMemoria(), s, 0, sha, 'op-par'),
  ])
  assert.ok(a.ok && b.ok)
  const ripetute = [a, b].filter(x => x.ok && !('nulla' in x) && x.ripetuta).length
  assert.equal(ripetute, 1)                            // una applica, l'altra è replay
  assert.equal(mondo.documenti.get('d1')!.revisione_rev, 1)
  assert.equal(giornale.size, 1)
})

test('CUSTODIA NEGATA: l\'operazione NON parte (nessuna chiamata al servizio)', async () => {
  const mondo = mondoBase()
  const { cliente, giornale } = creaServerContratto(mondo, sha)
  const negato = { salva: () => ({ errore: 'spazio esaurito' }), leggi: () => ({}), rimuovi: () => ({}) }
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  const esito = await eseguiSalva(cliente, negato, s, 0, sha, 'op-1')
  assert.ok(!esito.ok && 'errore' in esito && esito.errore.includes('NON la invio'))
  assert.equal(giornale.size, 0)
  assert.equal(mondo.bozze.get('b1')!.store, 'Mercato')
})
