// Revisione indipendente di 127277d: soli servizi simulati, nessuna rete.
// Gli assert descrivono il comportamento CORRETTO: i difetti restano ROSSI
// sul candidato. Non cambiare gli assert per far passare il codice difettoso.
// Esecuzione: node --test scripts/revisioni/cablaggio-127277d.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creaServerContratto } from '../../lib/spese/contrattoServerFinto.ts'
import { orchestrazioneContratto } from '../../lib/spese/orchestrazioneRevisione.ts'
import { depositoOperazioniDurevole } from '../../lib/spese/depositoOperazioniDurevole.ts'
import { depositoRevisioneLocale } from '../../lib/spese/revisioneDurevole.ts'
import { ponteContrattoDurevole } from '../../lib/spese/ponteContratto.ts'
import { improntaSha256 } from '../../lib/spese/improntaTesto.ts'
import { apriRevisione, modificaBozza, modificaTotale, aggiungiRiga, tracciaDa, riconciliaPresa, applicaVincoli } from '../../lib/spese/revisione.ts'

const BOZZA = {
  id: 'b1', document_id: 'd1', status: 'da_controllare', expense_date: '2026-08-31',
  group_id: 'g1', category_id: null, subcategory: null, canonical_category_id: null,
  canonical_subcategory_id: null, store: 'Iper', description: null, payment_method: 'contanti',
  room_id: null, expense_nature: null, arrotondamento_cent: 0, confidence: null,
}
const RIGA = {
  id: 'r1', draft_id: 'b1', raw_name: null, name: 'Pane', qty: 1, unit_price: null,
  discount: 0, amount: 5, group_id: null, category_id: null, subcategory: null,
  canonical_category_id: null, canonical_subcategory_id: null, necessity: null,
  planning: null, excluded: false, user_added: false, confidence: null,
}
function differita() {
  let risolvi
  const promessa = new Promise(r => { risolvi = r })
  return { promessa, risolvi }
}
function scenario(rivesti = c => c, guasti = {}) {
  const doc = { id: 'd1', kind: 'scontrino', status: 'in_revisione', revisione_rev: 0, doc_total: 5 }
  const mondo = {
    documenti: new Map([['d1', doc]]),
    bozze: new Map([['b1', structuredClone(BOZZA)]]),
    righe: new Map([['r1', structuredClone(RIGA)]]),
  }
  const server = creaServerContratto(mondo, improntaSha256)
  const mappa = new Map()
  let scrittureTraccia = 0
  const memoria = {
    getItem: k => mappa.get(k) ?? null,
    setItem: (k, v) => {
      if (k === 'rev' && ++scrittureTraccia === guasti.tracciaAlla) throw Error('custodia non scrivibile (simulata)')
      mappa.set(k, v)
    },
    removeItem: k => mappa.delete(k),
  }
  const cliente = rivesti(server.cliente)
  // Ricrea TUTTI i depositi sul medesimo magazzino; il server sopravvive.
  const servizi = () => ({
    cliente,
    depositoRevisione: depositoRevisioneLocale('rev', () => memoria),
    depositoOperazioni: depositoOperazioniDurevole(memoria, 'ops'),
    ponte: ponteContrattoDurevole(memoria, 'ponte'),
  })
  const { depositoRevisione: dep, depositoOperazioni: ops, ponte } = servizi()
  const orch = (extra = {}) => orchestrazioneContratto({ ...servizi(), revisioneIniziale: doc.revisione_rev, ...extra })
  const stato = () => apriRevisione('d1', doc.doc_total,
    structuredClone([...mondo.bozze.values()]),
    structuredClone([...mondo.righe].map(([id, r]) => ({ ...r, id }))), dep.leggi('d1').traccia)
  return { doc, mondo, server, mappa, memoria, cliente, dep, ops, ponte, orch, stato }
}
const conVoce = s => modificaTotale(aggiungiRiga(modificaBozza(s, 'b1', { store: 'Corretto' }),
  { draft_id: 'b1', name: 'Sacchetto', amount: 1, qty: 1, discount: 0 }, 'nuova-1'), 600)

test('C03: risposta persa, depositi ricreati, righe fresche, seconda apertura, conferma', async () => {
  let perdi = true
  const sc = scenario(base => ({ ...base, salvaRevisione: async p => {
    const r = await base.salvaRevisione(p)
    if (perdi) { perdi = false; throw Error('risposta persa') }
    return r
  } }))
  assert.equal((await sc.orch().salva(conVoce(sc.stato()))).incerto, true)
  assert.equal((await sc.orch().apertura('d1')).risolte, 1)
  assert.equal((await sc.orch().apertura('d1')).risolte, 0)
  const s = sc.stato()
  assert.equal(s.righe.length, 2)
  assert.equal(s.righeNuove.length, 0, 'la nuova voce deve tornare dalla fonte con il suo id')
  assert.equal(sc.dep.leggi('d1').traccia.originaliBozze.b1.store, 'Iper')
  const r = await sc.orch().conferma(s)
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(sc.doc.status, 'confermato')
})

for (const kind of ['conferma', 'scarto']) {
  for (const momento of ['prima', 'dopo']) {
    test(`C05: ${kind}, risposta persa ${momento} dell'effetto, recupero senza schermata`, async () => {
      let guasto = true
      const metodo = kind === 'conferma' ? 'confermaRevisione' : 'scartaRevisione'
      const sc = scenario(base => ({ ...base, [metodo]: async p => {
        if (guasto && momento === 'prima') throw Error('rete prima della richiesta')
        const r = await base[metodo](p)
        if (guasto) throw Error('risposta persa dopo effetto')
        return r
      } }))
      const r = kind === 'conferma'
        ? await sc.orch().conferma(sc.stato())
        : await sc.orch().scarta(sc.stato(), 'prova sintetica')
      assert.equal(r.incerto, true)
      guasto = false
      const recupero = await sc.orch().apertura('d1')
      assert.equal(recupero.risolte, 1)
      assert.equal(sc.dep.leggi('d1').traccia, undefined)
      assert.equal(sc.ops.elenca().ops.length, 0)
      assert.equal(sc.ponte.elenca().rifs.length, 0)
      assert.equal(sc.doc.status, kind === 'conferma' ? 'confermato' : 'scartato')
    })
  }
}

test('C07: recupero vecchio non cancella ponte/inCorso del nuovo Salva', async () => {
  const letturaEntrata = differita(), letturaSospesa = differita()
  const invioEntrato = differita(), invioSospeso = differita()
  let invii = 0, letture = 0
  const sc = scenario(base => ({ ...base,
    salvaRevisione: async p => {
      if (++invii === 1) { await base.salvaRevisione(p); throw Error('risposta persa') }
      invioEntrato.risolvi(); await invioSospeso.promessa
      return base.salvaRevisione(p)
    },
    esitoRevisione: async k => {
      const r = await base.esitoRevisione(k)
      if (++letture === 2) { letturaEntrata.risolvi(); await letturaSospesa.promessa }
      return r
    },
  }))
  await sc.orch().salva(modificaBozza(sc.stato(), 'b1', { store: 'Prima' }))
  const r1 = sc.orch().apertura('d1'), r2 = sc.orch().apertura('d1')
  const secondaInVolo = await Promise.race([
    letturaEntrata.promessa.then(() => true),
    Promise.all([r1, r2]).then(() => false),
  ])
  if (!secondaInVolo) {
    // Una soluzione single-flight/serializzata può chiudere entrambe
    // senza una seconda lettura concorrente: è un esito corretto.
    assert.equal(sc.ops.elenca().ops.length, 0)
    assert.equal(sc.ponte.elenca().rifs.length, 0)
    return
  }
  await r1
  const scrittura = sc.orch().salva(modificaBozza(sc.stato(), 'b1', { store: 'Dopo' }))
  await invioEntrato.promessa
  const prima = structuredClone(sc.ponte.leggi('d1').rif)
  assert.ok(prima)
  letturaSospesa.risolvi(); await r2
  const ponteDopo = sc.ponte.leggi('d1').rif
  const inCorsoDopo = sc.dep.leggi('d1').traccia.inCorso
  invioSospeso.risolvi(); await scrittura
  assert.equal(ponteDopo?.opKey, prima.opKey, 'il recupero precedente ha rimosso il ponte NUOVO')
  assert.ok(inCorsoDopo, 'il recupero precedente ha cancellato inCorso NUOVO')
})

test('C07: dopo un recupero nel varco ponte/deposito il vecchio invio non parte', async () => {
  const entrato = differita(), sospeso = differita()
  let hash = 0
  const sc = scenario()
  const hasher = async testo => {
    if (++hash === 2) { entrato.risolvi(); await sospeso.promessa }
    return improntaSha256(testo)
  }
  const salvataggio = sc.orch({ hasher }).salva(modificaBozza(sc.stato(), 'b1', { store: 'Vecchio' }))
  const varcoPresente = await Promise.race([
    entrato.promessa.then(() => true),
    salvataggio.then(() => false),
  ])
  if (!varcoPresente) {
    // Eliminare il secondo hash e il varco è una correzione valida.
    assert.equal(sc.server.giornale.size, 1)
    return
  }
  assert.ok(sc.ponte.leggi('d1').rif)
  assert.equal(sc.ops.elenca().ops.length, 0)
  const recupero = await sc.orch().apertura('d1')
  // Se il recupero non può provare la cessazione del preparatore, deve
  // BLOCCARE. Se concede la ripresa, deve impedire il successivo invio vecchio.
  if (!recupero.bloccante) {
    const nuova = modificaBozza(sc.stato(), 'b1', { store: 'Nuovo' })
    assert.deepEqual(sc.dep.salva(tracciaDa(nuova)), {})
  }
  sospeso.risolvi(); await salvataggio
  if (!recupero.bloccante)
    assert.equal(sc.server.giornale.size, 0, 'operazione dichiarata mai partita: è invece partita DOPO la nuova generazione')
})

test('ponte: esito incompleto dopo successo non chiude la responsabilità', async () => {
  const sc = scenario(c => c, { tracciaAlla: 3 })
  const r = await sc.orch().salva(conVoce(sc.stato()))
  assert.equal(r.ok, true)
  assert.match(r.avviso, /traccia non aggiornata/)
  // Corruzione strutturale di JSON leggibile, NON un servizio diverso.
  const custodito = JSON.parse(sc.mappa.get('ponte:doc:d1'))
  custodito.esito.mappaNuove = {}
  sc.mappa.set('ponte:doc:d1', JSON.stringify(custodito))
  const rec = await sc.orch().apertura('d1')
  assert.ok(rec.bloccante, 'mappa mancante accettata: acquisizione falsamente conclusa')
  assert.ok(sc.mappa.get('ponte:doc:d1'), 'il riferimento deve restare recuperabile')
})

test('ponte: la stessa chiave non può cambiare identità né manifesto', () => {
  const sc = scenario()
  const rif = { opKey: 'k1', kind: 'salva', documentId: 'd1', baseRev: 0,
    impronta: 'originale', clientRefs: [], inInvio: [], generazione: 1 }
  assert.deepEqual(sc.ponte.salva(rif), {})
  const r = sc.ponte.salva({ ...rif, kind: 'scarto', impronta: 'estranea' })
  assert.ok(r.errore, 'identità della stessa chiave sovrascritta')
  assert.deepEqual(sc.ponte.leggi('d1').rif, rif)
})

test('chiusura recuperata: non scavalca la generazione per cancellare una traccia recente', async () => {
  const sc = scenario(base => ({ ...base, confermaRevisione: async p => {
    await base.confermaRevisione(p); throw Error('risposta persa')
  } }))
  await sc.orch().conferma(sc.stato())
  const precedente = sc.dep.leggi('d1').traccia
  const nuova = { ...precedente, generazione: 2, modificheBozze: { b1: { store: 'Modifica successiva' } } }
  sc.dep.salva(nuova)
  assert.match(sc.dep.rimuovi('d1', 1).errore, /superata/)
  await sc.orch().apertura('d1')
  assert.deepEqual(sc.dep.leggi('d1').traccia, nuova, 'Math.max ha aggirato la protezione della generazione')
})

// Revisione successiva di 7a15fc1. I dieci assert precedenti sono intatti.
test('7a15fc1: apertura durante il PRIMO hash non crea vincoli legacy irrisolvibili', async () => {
  const sc = scenario()
  const entrato = differita(), sospeso = differita()
  let hash = 0
  const hasher = async testo => {
    if (++hash === 1) { entrato.risolvi(); await sospeso.promessa }
    return improntaSha256(testo)
  }
  const salvataggio = sc.orch({ hasher }).salva(modificaBozza(sc.stato(), 'b1', { store: 'Corretto' }))
  await entrato.promessa
  const apertura = await sc.orch().apertura('d1')
  let presa
  if (!apertura.bloccante) {
    // Stesso cancello del guscio: la traccia inCorso entra nella presa legacy.
    const traccia = sc.dep.leggi('d1').traccia
    presa = riconciliaPresa(traccia, sc.doc, [...sc.mondo.bozze.values()])
    if (presa.esito === 'vincolata') {
      const statoNuovo = applicaVincoli(sc.stato(), presa.vincoli)
      assert.deepEqual(sc.dep.salva(tracciaDa(statoNuovo)), {})
    }
  }
  sospeso.risolvi()
  assert.equal((await salvataggio).ok, true)
  const recupero = await sc.orch().apertura('d1')
  assert.equal(recupero.bloccante, undefined, JSON.stringify(recupero))
  const finale = sc.stato()
  const conferma = await sc.orch().conferma(finale)
  assert.equal(conferma.ok, true,
    `apertura=${JSON.stringify(apertura)}; presa=${presa?.esito}; vincoli=${JSON.stringify(finale.vincoli)}; conferma=${conferma.errore}`)
})

test('7a15fc1: ricaricare il server finto persistente non riusa gli id delle righe', async () => {
  const sc = scenario()
  const prima = modificaTotale(aggiungiRiga(sc.stato(),
    { draft_id: 'b1', name: 'Prima voce', amount: 1, qty: 1, discount: 0 }, 'prima'), 600)
  assert.equal((await sc.orch().salva(prima)).ok, true)
  // La stessa serializzazione della preview: documento, mappe e giornale.
  const dati = JSON.parse(JSON.stringify({
    documento: sc.doc, bozze: [...sc.mondo.bozze], righe: [...sc.mondo.righe], giornale: [...sc.server.giornale],
  }))
  const mondo = { documenti: new Map([['d1', dati.documento]]), bozze: new Map(dati.bozze), righe: new Map(dati.righe) }
  const ricreato = creaServerContratto(mondo, improntaSha256)
  for (const [k, v] of dati.giornale) ricreato.giornale.set(k, v)
  const orch = orchestrazioneContratto({
    cliente: ricreato.cliente, depositoRevisione: sc.dep, depositoOperazioni: sc.ops,
    ponte: sc.ponte, revisioneIniziale: dati.documento.revisione_rev,
  })
  let seconda = apriRevisione('d1', dati.documento.doc_total, [...mondo.bozze.values()],
    [...mondo.righe].map(([id, r]) => ({ ...r, id })), sc.dep.leggi('d1').traccia)
  seconda = modificaTotale(aggiungiRiga(seconda,
    { draft_id: 'b1', name: 'Seconda voce', amount: 1, qty: 1, discount: 0 }, 'seconda'), 700)
  assert.equal((await orch.salva(seconda)).ok, true)
  assert.deepEqual([...mondo.righe.values()].map(r => r.name).sort(),
    ['Pane', 'Prima voce', 'Seconda voce'].sort(), 'la seconda voce ha sovrascritto la prima nella preview')
})
