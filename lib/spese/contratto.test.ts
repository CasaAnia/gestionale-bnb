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
  rifiutoDimostrato,
  type OperazioneContratto,
} from './contrattoRevisione.ts'
import {
  depositoOperazioniInMemoria, eseguiConferma, eseguiSalva, eseguiScarto,
  recuperaOperazione, reinviaOperazione,
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
      ['b1', { document_id: 'd1', status: 'da_controllare', store: 'Mercato', group_id: 'g-casa', arrotondamento_cent: 0 }],
      ['b2', { document_id: 'd2', status: 'da_controllare', store: 'Altro', group_id: 'g-casa', arrotondamento_cent: 0 }],
      ['b3', { document_id: 'd1', status: 'confermata', store: 'Storica', group_id: 'g-casa', arrotondamento_cent: 0 }],
    ]),
    righe: new Map([['r1', { draft_id: 'b1', name: 'Voce', amount: 5, qty: 1, discount: 0 }]]),
  }
}
const statoBase = () => apriRevisione('d1', 5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])

test('VETTORI COMUNI: la canonicalizzazione del client produce esattamente forma e impronta fissate (base anche per il collaudo SQL)', async () => {
  for (const v of VETTORI) {
    if (v.tipo === 'manifesto_conferma') {
      // le CORREZIONI arrivano disordinate: il manifesto le ORDINA — la
      // futura funzione SQL deve fare lo stesso su questo vettore
      const inp = v.valore as { document_id: string; base_rev: number; correzioni: Record<string, unknown>[] }
      assert.equal(manifestoConferma(inp.document_id, inp.base_rev, inp.correzioni), v.canonico, v.nome)
      assert.equal(await sha(v.canonico), v.sha256, v.nome)
      continue
    }
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
  const op: OperazioneContratto = { opKey: 'op-mai', kind: 'salva', documentId: 'd1', baseRev: 0, impronta: await sha(manifestoSalva(batch)), clientRefs: [], richiesta: { kind: 'salva', modifiche: batch } }
  assert.equal((await recuperaOperazione(cliente, deposito, op)).stato, 'assente')
  // il REINVIO usa la RICHIESTA CUSTODITA, non lo stato della schermata
  deposito.salva(op)                                   // custodita (come dopo l'apertura)
  const reinvio = await reinviaOperazione(cliente, deposito, 'op-mai', sha)
  assert.ok(reinvio.ok)
  // e se «l'originale» arrivasse DOPO il reinvio: stessa chiave → RIPETUTA
  const tardivo = await cliente.salvaRevisione({ op_key: 'op-mai', document_id: 'd1', base_rev: 0, modifiche: batch })
  assert.equal((tardivo as { esito?: string }).esito, 'RIPETUTA')
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

// ---- correzioni della revisione su d0ff932 --------------------------------
test('RISPOSTE CONVALIDATE prima di toccare la custodia: malformate e trasporto conservano la pendenza; i rifiuti veri la chiudono', async () => {
  const deposito = depositoOperazioniInMemoria()
  let s = statoBase()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  const conRisposta = (r: unknown) => ({
    salvaRevisione: async () => r, confermaRevisione: async () => r,
    scartaRevisione: async () => r, esitoRevisione: async () => ({ stato: 'assente' }),
  }) as never
  // APPLICATA ma con la mappa VUOTA nonostante la voce inviata → NON è
  // un successo: pendenza conservata
  const senzaMappa = await eseguiSalva(conRisposta({ esito: 'APPLICATA', rev_dopo: 1, righe_nuove: [] }), deposito, s, 0, sha, 'op-1')
  assert.ok(!senzaMappa.ok && 'incerto' in senzaMappa)
  assert.ok(!senzaMappa.ok && 'errore' in senzaMappa && senzaMappa.errore.includes('MALFORMATA'))
  assert.equal(deposito.contenuto().length, 1)
  deposito.rimuovi('op-1')
  // errore di TRASPORTO restituito come {error:{message:'Failed to fetch'}}
  // → pendenza conservata (non «nulla è stato scritto»)
  const trasporto = await eseguiSalva(conRisposta({ error: { message: 'Failed to fetch' } }), deposito, s, 0, sha, 'op-2')
  assert.ok(!trasporto.ok && 'incerto' in trasporto)
  assert.equal(deposito.contenuto().length, 1)
  deposito.rimuovi('op-2')
  // {errore:'Failed to fetch'} restituito → idem, incerto
  const reteRestituita = await eseguiSalva(conRisposta({ errore: 'Failed to fetch' }), deposito, s, 0, sha, 'op-3')
  assert.ok(!reteRestituita.ok && 'incerto' in reteRestituita)
  assert.equal(deposito.contenuto().length, 1)
  deposito.rimuovi('op-3')
  // rifiuto VERO restituito CON LA PROVA (SQLSTATE applicativo P0001,
  // es. la quadratura della conferma) → definito, custodia chiusa
  const rifiuto = await eseguiConferma(conRisposta({ errore: 'Quadratura non esatta: righe+arrotondamento=500 cent, documento=3000 cent', codice: 'P0001' }), deposito, 'd1', 0, [], sha, 'op-4')
  assert.ok(!rifiuto.ok && 'errore' in rifiuto && !('incerto' in rifiuto) && rifiuto.errore.includes('Quadratura'))
  assert.equal(deposito.contenuto().length, 0)
  // lo STESSO messaggio SENZA la prova → incerta (una regex non dimostra
  // il rifiuto): pendenza conservata
  const senzaProva = await eseguiConferma(conRisposta({ errore: 'Quadratura non esatta: righe+arrotondamento=500 cent, documento=3000 cent' }), deposito, 'd1', 0, [], sha, 'op-4b')
  assert.ok(!senzaProva.ok && 'incerto' in senzaProva)
  assert.equal(deposito.contenuto().length, 1)
  deposito.rimuovi('op-4b')
  // revisione risultante non valida → pendenza conservata
  const revRotta = await eseguiSalva(conRisposta({ esito: 'APPLICATA', rev_dopo: 0, righe_nuove: [{ client_ref: 'loc-1', id: 'srv-1' }] }), deposito, s, 0, sha, 'op-5')
  assert.ok(!revRotta.ok && 'incerto' in revRotta)
  deposito.rimuovi('op-5')
  // esito sconosciuto → pendenza conservata
  const ignoto = await eseguiSalva(conRisposta({ esito: 'BOH' }), deposito, s, 0, sha, 'op-6')
  assert.ok(!ignoto.ok && 'incerto' in ignoto)
  assert.equal(deposito.contenuto().length, 1)
})

test('RIMOZIONE della custodia fallita → mai un successo silenzioso (avviso riportato), anche nel recupero', async () => {
  const mondo = mondoBase()
  const { cliente, guasti } = creaServerContratto(mondo, sha)
  const base = depositoOperazioniInMemoria()
  const zoppo = { salva: (o: never) => base.salva(o), leggi: (k: string) => base.leggi(k), rimuovi: () => ({ errore: 'spazio in sola lettura' }) }
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  const esito = await eseguiSalva(cliente, zoppo as never, s, 0, sha, 'op-1')
  assert.ok(esito.ok && !('nulla' in esito) && esito.avviso?.includes('custodia non rimossa'))
  // recupero con rimozione fallita → applicata CON avviso
  guasti.perdiRisposta = true
  let s2 = statoBase()
  s2 = modificaBozza(s2, 'b1', { store: 'Esselunga' })
  await eseguiSalva(cliente, base, s2, 1, sha, 'op-2').catch(() => {})
  guasti.perdiRisposta = false
  const op = base.contenuto()[0]
  const rec = await recuperaOperazione(cliente, zoppo as never, op)
  assert.ok(rec.stato === 'applicata' && rec.avviso?.includes('custodia non rimossa'))
})

test('RECUPERO: esito a giornale con identità giusta ma corpo MALFORMATO → pendenza conservata, nessun crash, custodia intatta', async () => {
  const mondo = mondoBase()
  const { cliente, giornale, guasti } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  let s = statoBase()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  guasti.perdiRisposta = true
  await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')
  guasti.perdiRisposta = false
  // MANOMISSIONE del corpo a giornale: la mappa sparisce (identità intatta)
  const reg = giornale.get('op-1')!
  reg.esito = { rev_dopo: reg.esito.rev_dopo } as never
  const op = deposito.contenuto()[0]
  const rec = await recuperaOperazione(cliente, deposito, op)
  assert.equal(rec.stato, 'illeggibile')
  assert.ok(rec.stato === 'illeggibile' && rec.errore.includes('MALFORMATO'))
  assert.equal(deposito.contenuto().length, 1)         // custodia INTATTA
})

test('CUSTODIA IMMUTABILE: una chiave pendente non cambia identità né contenuto; il reinvio usa la richiesta originale, non la schermata', async () => {
  const mondo = mondoBase()
  const { cliente, guasti } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  // Salva «Prima» applicato con risposta PERSA
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Prima' })
  guasti.perdiRisposta = true
  const perso = await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')
  guasti.perdiRisposta = false
  assert.ok(!perso.ok && 'incerto' in perso)
  // STESSA chiave riutilizzata con «Dopo»: il deposito RIFIUTA prima di
  // qualunque invio — la traccia originale non viene sovrascritta
  let s2 = statoBase()
  s2 = modificaBozza(s2, 'b1', { store: 'Dopo' })
  const riuso = await eseguiSalva(cliente, deposito, s2, 0, sha, 'op-1')
  assert.ok(!riuso.ok && 'errore' in riuso && riuso.errore.includes('non cambia identità'))
  const custodita = deposito.leggi('op-1').op!
  assert.equal((custodita.richiesta as { kind: string; modifiche: { bozze: Record<string, { store?: string }> } }).modifiche.bozze.b1.store, 'Prima')
  // SERIALIZZAZIONE e riapertura: il deposito si ricrea da JSON e il
  // reinvio parte dalla richiesta custodita, SENZA lo stato in memoria
  const ricreato = depositoOperazioniInMemoria(JSON.parse(JSON.stringify(deposito.contenuto())))
  const op = ricreato.contenuto()[0]
  const rec = await recuperaOperazione(cliente, ricreato, op)
  assert.equal(rec.stato, 'applicata')                 // era stata applicata: mappa e rev tornano
  assert.equal(mondo.bozze.get('b1')!.store, 'Prima')  // e «Dopo» non è mai partito
  // richiesta MAI arrivata: reinvio dalla custodia ricreata
  let s3 = statoBase()
  s3 = modificaRiga(s3, 'r1', { amount: 4 })
  const batch3 = batchSalvaDa(s3, 1)
  const op3: OperazioneContratto = { opKey: 'op-3', kind: 'salva', documentId: 'd1', baseRev: 1, impronta: await sha(manifestoSalva(batch3)), clientRefs: [], richiesta: { kind: 'salva', modifiche: batch3 } }
  const dep3 = depositoOperazioniInMemoria([op3])      // come dopo una riapertura
  assert.equal((await recuperaOperazione(cliente, dep3, dep3.contenuto()[0])).stato, 'assente')
  const reinvio = await reinviaOperazione(cliente, dep3, 'op-3', sha)
  assert.ok(reinvio.ok)
  assert.equal(mondo.righe.get('r1')!.amount, 4)
  // le modifiche SUCCESSIVE dell'utente non alterano l'operazione custodita
  const prima = JSON.stringify(deposito.leggi('op-1').op)
  s2 = modificaBozza(s2, 'b1', { store: 'Ancora diverso' })
  assert.equal(JSON.stringify(deposito.leggi('op-1').op), prima)
})

test('SERVER FINTO: respinge i valori vietati sulle righe esistenti e la conferma che non quadra; il batch misto lascia tutto intatto', async () => {
  const mondo = mondoBase()
  const { cliente, giornale } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  // amount NEGATIVO su una riga esistente → respinto, nulla applicato
  let s = statoBase()
  s = { ...s, modificheRighe: { r1: { amount: -1 } } }
  const negativo = await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')
  assert.ok(!negativo.ok && 'sentinella' in negativo && negativo.sentinella === 'MODIFICHE_MALFORMATE')
  assert.equal(mondo.righe.get('r1')!.amount, 5)
  // batch MISTO (bozza valida + riga invalida) → dati, revisione e
  // giornale INTATTI
  let s2 = statoBase()
  s2 = modificaBozza(s2, 'b1', { store: 'Iper' })
  s2 = { ...s2, modificheRighe: { r1: { amount: -1 } } }
  const misto = await eseguiSalva(cliente, deposito, s2, 0, sha, 'op-2')
  assert.ok(!misto.ok)
  assert.equal(mondo.bozze.get('b1')!.store, 'Mercato')
  assert.equal(mondo.documenti.get('d1')!.revisione_rev, 0)
  assert.equal(giornale.size, 0)
  // conferma che NON quadra (totale 30, righe per 5) → rifiuto DEFINITO
  // col messaggio del server, nessuna spesa simulata creata
  mondo.documenti.get('d1')!.doc_total = 30
  const nonQuadra = await eseguiConferma(cliente, deposito, 'd1', 0, [], sha, 'op-3')
  assert.ok(!nonQuadra.ok && 'errore' in nonQuadra && !('incerto' in nonQuadra) && nonQuadra.errore.includes('Quadratura non esatta'))
  assert.equal(mondo.documenti.get('d1')!.status, 'in_revisione')
  assert.equal(giornale.size, 0)
  // destinatario mancante → rifiutata anche quella
  mondo.documenti.get('d1')!.doc_total = 5
  ;(mondo.bozze.get('b1') as Record<string, unknown>).group_id = null
  const senzaGruppo = await eseguiConferma(cliente, deposito, 'd1', 0, [], sha, 'op-4')
  assert.ok(!senzaGruppo.ok && 'errore' in senzaGruppo && senzaGruppo.errore.includes('destinatario'))
})

// ---- correzioni della revisione su 3901b9c --------------------------------
test('SENZA PROVA DI RIFIUTO la pendenza resta: Bad Gateway, Service Unavailable e upstream failed non cancellano nulla (l\'effetto può esistere)', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  for (const messaggio of ['Bad Gateway', 'Service Unavailable', 'upstream request failed']) {
    const deposito = depositoOperazioniInMemoria()
    let s = statoBase()
    s = modificaBozza(s, 'b1', { store: 'Iper' })
    // l'operazione viene APPLICATA dal server, ma il trasporto
    // SOSTITUISCE la risposta con un errore qualunque
    const manomesso = {
      ...cliente,
      salvaRevisione: async (pp: never) => { await cliente.salvaRevisione(pp); return { error: { message: messaggio } } as never },
    }
    const esito = await eseguiSalva(manomesso, deposito, s, 0, sha, `op-${messaggio}`)
    assert.ok(!esito.ok && 'incerto' in esito, messaggio)          // MAI un rifiuto dedotto dal testo
    assert.equal(deposito.contenuto().length, 1, messaggio)        // pendenza CONSERVATA
    // e il recupero per chiave trova l'esito vero e la chiude
    const rec = await recuperaOperazione(cliente, deposito, deposito.contenuto()[0])
    assert.equal(rec.stato, 'applicata', messaggio)
    mondo.bozze.get('b1')!.store = 'Mercato'
    mondo.documenti.get('d1')!.revisione_rev = 0
  }
  // stessa regola per {errore:'Bad Gateway'} restituito senza codice
  const deposito = depositoOperazioniInMemoria()
  let s2 = statoBase()
  s2 = modificaBozza(s2, 'b1', { store: 'Iper' })
  const finto = { ...cliente, salvaRevisione: async () => ({ errore: 'Bad Gateway' }) as never }
  const esito = await eseguiSalva(finto, deposito, s2, 0, sha, 'op-bg')
  assert.ok(!esito.ok && 'incerto' in esito)
  assert.equal(deposito.contenuto().length, 1)
})

test('RECUPERO con risposte inattese: null, undefined e forme sconosciute → «illeggibile» controllato, custodia intatta, nessuna eccezione', async () => {
  const mondo = mondoBase()
  const { cliente, guasti } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  guasti.perdiRisposta = true
  await eseguiSalva(cliente, deposito, s, 0, sha, 'op-1')
  guasti.perdiRisposta = false
  const op = deposito.contenuto()[0]
  for (const rotta of [null, undefined, 42, 'boh', {}, { stato: 'sconosciuto' }, { stato: 'applicata' }]) {
    const finto = { ...cliente, esitoRevisione: async () => rotta as never }
    const rec = await recuperaOperazione(finto, deposito, op)
    assert.equal(rec.stato, 'illeggibile', JSON.stringify(rotta ?? String(rotta)))
    assert.equal(deposito.contenuto().length, 1)
  }
  // col giornale VERO si chiude normalmente
  assert.equal((await recuperaOperazione(cliente, deposito, op)).stato, 'applicata')
})

test('REINVIO dal deposito, mai dall\'argomento: una copia manomessa non parte; «Dopo» non viene mai inviato; discordanze conservano la pendenza', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  // custodita «Prima», richiesta MAI arrivata
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Prima' })
  const batch = batchSalvaDa(s, 0)
  const op: OperazioneContratto = { opKey: 'op-p', kind: 'salva', documentId: 'd1', baseRev: 0, impronta: await sha(manifestoSalva(batch)), clientRefs: [], richiesta: { kind: 'salva', modifiche: batch } }
  const deposito = depositoOperazioniInMemoria([op])
  // copia MANOMESSA: payload «Dopo», impronta lasciata invariata
  const copia = JSON.parse(JSON.stringify(op)) as OperazioneContratto
  ;(copia.richiesta as { modifiche: { bozze: Record<string, { store?: string }> } }).modifiche.bozze.b1.store = 'Dopo'
  // il reinvio RILEGGE dal deposito per chiave: la copia è irrilevante e
  // parte la richiesta ORIGINALE
  const reinvio = await reinviaOperazione(cliente, deposito, copia.opKey, sha)
  assert.ok(reinvio.ok)
  assert.equal(mondo.bozze.get('b1')!.store, 'Prima')  // «Dopo» MAI inviato
  // custodia DISCORDANTE (payload manomesso DENTRO il deposito, impronta
  // invariata): l'impronta ricalcolata non torna → nessuna chiamata,
  // pendenza conservata
  const depositoRotto = depositoOperazioniInMemoria([copia])
  mondo.documenti.get('d1')!.revisione_rev = 0
  mondo.bozze.get('b1')!.store = 'Mercato'
  const discordante = await reinviaOperazione(cliente, depositoRotto, copia.opKey, sha)
  assert.ok(!discordante.ok && 'errore' in discordante && discordante.errore.includes('NON corrisponde alla sua impronta'))
  assert.equal(mondo.bozze.get('b1')!.store, 'Mercato')          // niente inviato
  assert.equal(depositoRotto.contenuto().length, 1)              // pendenza conservata
  // deposito ASSENTE o ILLEGGIBILE → nessuna chiamata
  const vuoto = depositoOperazioniInMemoria()
  const nonTrovata = await reinviaOperazione(cliente, vuoto, 'op-p', sha)
  assert.ok(!nonTrovata.ok && 'errore' in nonTrovata && nonTrovata.errore.includes('non trovata'))
  const illeggibile = { salva: () => ({}), leggi: () => ({ errore: 'memoria guasta' }), rimuovi: () => ({}) }
  const guasto = await reinviaOperazione(cliente, illeggibile as never, 'op-p', sha)
  assert.ok(!guasto.ok && 'errore' in guasto && guasto.errore.includes('illeggibile'))
})

// ---- correzioni della revisione su 32e3b41 --------------------------------
test('SQLSTATE: ELENCO POSITIVO — 40003 (esito ignoto), 00000/01000/02000 e ZZZZZ non provano un rifiuto; provano P0001, 22P02, 23505, 42501', async () => {
  // unità: la regola stessa
  for (const non of ['40003', '00000', '01000', '02000', 'ZZZZZ', '08006', '57014', 'XX000', undefined, 'P1', ''])
    assert.equal(rifiutoDimostrato(non as never), false, String(non))
  for (const si of ['P0001', '22P02', '23505', '23502', '42501', '42883', '42P01'])
    assert.equal(rifiutoDimostrato(si), true, si)
  // sequenza del revisore: operazione APPLICATA, risposta sostituita da
  // un errore con code 40003 → la custodia NON si cancella (effetto e
  // giornale esistono) e il recupero la chiude con l'esito vero
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  for (const codice of ['40003', '00000', '01000', '02000', 'ZZZZZ']) {
    const deposito = depositoOperazioniInMemoria()
    let s = statoBase()
    s = modificaBozza(s, 'b1', { store: 'Iper' })
    const manomesso = {
      ...cliente,
      salvaRevisione: async (pp: never) => { await cliente.salvaRevisione(pp); return { error: { message: 'errore qualunque', code: codice } } as never },
    }
    const esito = await eseguiSalva(manomesso, deposito, s, 0, sha, `op-${codice}`)
    assert.ok(!esito.ok && 'incerto' in esito, codice)
    assert.equal(deposito.contenuto().length, 1, codice)
    assert.equal((await recuperaOperazione(cliente, deposito, deposito.contenuto()[0])).stato, 'applicata', codice)
    mondo.bozze.get('b1')!.store = 'Mercato'
    mondo.documenti.get('d1')!.revisione_rev = 0
  }
})

test('IL RIFIUTO DI UN TENTATIVO SUCCESSIVO NON RISOLVE IL PRIMO INCERTO: la pendenza resta e si chiude solo con l\'esito riferibile', async () => {
  const mondo = mondoBase()
  const { cliente } = creaServerContratto(mondo, sha)
  const deposito = depositoOperazioniInMemoria()
  // 1) PRIMO invio: il trasporto lo accetta (partirà davvero, più
  //    tardi), ma l'effetto resta SOSPESO e la risposta si perde
  let rilascia: () => void = () => {}
  let inSospeso: Promise<unknown> | null = null
  const trasporto = {
    ...cliente,
    salvaRevisione: async (pp: never) => {
      inSospeso = new Promise(res => { rilascia = () => res(cliente.salvaRevisione(pp)) })
      throw new Error('Failed to fetch')
    },
  }
  let s = statoBase()
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  const primo = await eseguiSalva(trasporto, deposito, s, 0, sha, 'op-1')
  assert.ok(!primo.ok && 'incerto' in primo)
  assert.equal(deposito.leggi('op-1').op?.tentativiIncerti, 1)   // responsabilità ANNOTATA durevolmente
  // 2) recupero → assente (il primo non ha ancora applicato)
  assert.equal((await recuperaOperazione(cliente, deposito, deposito.contenuto()[0])).stato, 'assente')
  // 3) REINVIO → rifiuto AUTENTICO (NON_MEMBRO, P0001): definisce il
  //    secondo tentativo ma NON la conclusione del primo → la custodia
  //    RESTA, e lo si dichiara
  const respinge = { ...cliente, salvaRevisione: async () => ({ errore: 'NON_MEMBRO', codice: 'P0001' }) as never }
  const reinvio = await reinviaOperazione(respinge, deposito, 'op-1', sha)
  assert.ok(!reinvio.ok && 'errore' in reinvio && !('incerto' in reinvio))
  assert.ok(!reinvio.ok && 'errore' in reinvio && reinvio.errore.includes('un invio precedente di questa operazione è ancora senza esito'))
  assert.equal(deposito.contenuto().length, 1)                   // pendenza CONSERVATA
  // 4) il PRIMO invio finalmente arriva: effetto e giornale esistono
  rilascia()
  await inSospeso
  assert.equal(mondo.bozze.get('b1')!.store, 'Iper')
  // 5) la pendenza si chiude SOLO ora, con l'esito riferibile per chiave
  const rec = await recuperaOperazione(cliente, deposito, deposito.contenuto()[0])
  assert.equal(rec.stato, 'applicata')
  assert.equal(deposito.contenuto().length, 0)
  // CONTROPROVA 1: al PRIMO E UNICO tentativo un rifiuto accertato
  // chiude normalmente la custodia (nessun invio precedente per aria)
  const dep2 = depositoOperazioniInMemoria()
  let s2 = statoBase()
  s2 = modificaBozza(s2, 'b1', { store: 'Altro' })
  const unico = await eseguiSalva(respinge, dep2, s2, 0, sha, 'op-unico')
  assert.ok(!unico.ok && 'errore' in unico && !('incerto' in unico))
  assert.ok(!unico.ok && 'errore' in unico && !unico.errore.includes('invio precedente'))
  assert.equal(dep2.contenuto().length, 0)
  // CONTROPROVA 2: con un incerto pregresso, SUPERATA È risolutiva (la
  // revisione è monotona: quel base_rev non applicherà mai più)
  const dep3 = depositoOperazioniInMemoria()
  let s3 = statoBase()
  s3 = modificaBozza(s3, 'b1', { store: 'Mai' })
  const perdente = { ...cliente, salvaRevisione: async () => { throw new Error('Failed to fetch') } }
  await eseguiSalva(perdente, dep3, s3, 0, sha, 'op-sup')        // incerto pregresso
  const superata = { ...cliente, salvaRevisione: async () => ({ esito: 'SUPERATA' }) as never }
  const chiusa = await reinviaOperazione(superata, dep3, 'op-sup', sha)
  assert.ok(!chiusa.ok && 'conflitto' in chiusa)
  assert.equal(dep3.contenuto().length, 0)                       // chiusa: mai più applicabile
})
