// ============================================================================
// Test Fase 4 blocco 3 (con le correzioni) — REVISIONE delle bozze: logica
// pura + servizi con cliente SIMULATO rigoroso. Casi obbligatori: documento
// semplice e misto, quota zero, arrotondamenti, righe escluse, nota vuota,
// quadratura errata, doppio clic, errore di salvataggio, risposta persa;
// più le SEQUENZE delle correzioni: Salva ripetuto, Salva→Conferma,
// fallimento dopo un inserimento riuscito, risposta persa sull'INSERT,
// custodia degli originali attraverso riaperture, errori di rete
// RESTITUITI (non solo lanciati), coerenza destinatari per riga.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aggiungiRiga, apriRevisione, avvisoCoerenzaRiga, blocchiConferma,
  bozzaCorrente, CAMPI_RIGA_NUOVA, correzioniDa, dubbiDi, modificaBozza,
  modificaRiga, modificaTotale, payloadRigaNuova, quadratura,
  rigaCorrente, risolviRigaIncerta, stessaRigaNuova, togliRigaNuova,
  totaliSorella, tracciaDa,
  type BozzaGrezza, type RigaGrezza,
} from './revisione.ts'
import { confermaRevisione, salvaModifiche, scartaRevisione, type ClienteRevisione } from './revisioneScrittura.ts'
import { depositoRevisioneInMemoria, type DepositoRevisione } from './revisioneDurevole.ts'
import { creaGuardiaInvio } from './scrittura.ts'

const AMBITI: Record<string, 'personale' | 'azienda'> = { 'g-casa': 'personale', 'g-teo': 'personale', 'g-bnb': 'azienda' }
const ambitoDi = (g: string | null) => (g ? AMBITI[g] : 'personale')

const bozza = (x: Partial<BozzaGrezza> & { id: string }): BozzaGrezza => ({
  document_id: 'doc-1', status: 'da_controllare', expense_date: '2026-08-29',
  group_id: 'g-casa', category_id: 'c-spesa', subcategory: null,
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
const SOTTO_CANONICHE = [
  { id: 'can-frutta', canonical_category_id: 'can-alim' },
  { id: 'can-cartoleria', canonical_category_id: 'can-scuola' },
]

// il cliente SIMULATO: registra le chiamate, campi validati contro la 0021
// (UPDATE e INSERT hanno insiemi diversi: l'INSERT rifiuta ogni campo
// estraneo, idLocale/stato/id compresi — come farebbe il database)
const CAMPI_BOZZA = new Set(['expense_date', 'group_id', 'category_id', 'subcategory', 'canonical_category_id', 'canonical_subcategory_id', 'store', 'description', 'payment_method', 'room_id', 'expense_nature', 'arrotondamento_cent'])
const CAMPI_RIGA = new Set(['name', 'qty', 'unit_price', 'discount', 'amount', 'group_id', 'category_id', 'subcategory', 'canonical_category_id', 'canonical_subcategory_id', 'necessity', 'planning', 'excluded'])
const CAMPI_INSERT = new Set<string>(CAMPI_RIGA_NUOVA)
function clienteFinto(risposte: Partial<Record<keyof ClienteRevisione, unknown>> = {}) {
  const chiamate: { azione: string; payload?: unknown }[] = []
  let contatore = 0
  const rispondi = (k: keyof ClienteRevisione, base: unknown) => {
    const r = risposte[k]
    if (typeof r === 'function') {
      const v = (r as () => unknown)()                  // può LANCIARE o rispondere
      return (v ?? base) as never
    }
    return (r ?? base) as never
  }
  const cliente: ClienteRevisione = {
    async aggiornaDocTotale(id, totale) { chiamate.push({ azione: 'doc_total', payload: totale }); return rispondi('aggiornaDocTotale', { righe: 1 }) },
    async aggiornaBozza(id, campi) {
      for (const k of Object.keys(campi)) if (!CAMPI_BOZZA.has(k)) throw new Error(`campo NON consentito sulla bozza: ${k}`)
      chiamate.push({ azione: 'bozza', payload: { id, campi } }); return rispondi('aggiornaBozza', { righe: 1 })
    },
    async aggiornaRiga(id, campi) {
      for (const k of Object.keys(campi)) if (!CAMPI_RIGA.has(k)) throw new Error(`campo NON consentito sulla riga: ${k}`)
      // i NOT NULL della 0020 valgono anche in UPDATE
      const c = campi as Record<string, unknown>
      for (const k of ['name', 'qty', 'discount', 'amount']) if (k in c && c[k] == null) throw new Error(`NULL vietato su ${k}`)
      chiamate.push({ azione: 'riga', payload: { id, campi } }); return rispondi('aggiornaRiga', { righe: 1 })
    },
    async aggiungiRiga(r) {
      // VALORI e VINCOLI della 0020, non solo i nomi delle colonne:
      // qty numeric NOT NULL > 0 (default SOLO se assente dal payload),
      // discount NOT NULL ≥ 0, amount NOT NULL ≥ 0, name NOT NULL
      for (const k of Object.keys(r)) if (!CAMPI_INSERT.has(k)) throw new Error(`colonna inesistente nell'INSERT: ${k}`)
      const v = r as Record<string, unknown>
      if ('qty' in v && (v.qty == null || typeof v.qty !== 'number' || v.qty <= 0)) throw new Error('vincolo violato: qty NOT NULL > 0')
      if ('discount' in v && (v.discount == null || typeof v.discount !== 'number' || (v.discount as number) < 0)) throw new Error('vincolo violato: discount NOT NULL >= 0')
      if (v.amount == null || typeof v.amount !== 'number' || (v.amount as number) < 0) throw new Error('vincolo violato: amount NOT NULL >= 0')
      if (typeof v.name !== 'string' || !v.name) throw new Error('vincolo violato: name NOT NULL')
      chiamate.push({ azione: 'nuova', payload: r }); return rispondi('aggiungiRiga', { id: `srv-${++contatore}` })
    },
    async confermaDocumento(id, correzioni) { chiamate.push({ azione: 'conferma', payload: { id, correzioni } }); return rispondi('confermaDocumento', { ids: ['spesa-1'] }) },
    async scartaDocumento(id, motivo) { chiamate.push({ azione: 'scarta', payload: { id, motivo } }); return rispondi('scartaDocumento', {}) },
  }
  return { cliente, chiamate }
}
const esplode = () => { throw new Error('Failed to fetch') }
const dep = (): DepositoRevisione => depositoRevisioneInMemoria()

// ---- documento SEMPLICE: quadra, si conferma via RPC con le correzioni ----
test('documento semplice: quadratura esatta, conferma SOLO via RPC con le correzioni giuste', async () => {
  let s = apriRevisione('doc-1', 7.5,
    [bozza({ id: 'b1' })],
    [riga({ id: 'r1', draft_id: 'b1', amount: 5 }), riga({ id: 'r2', draft_id: 'b1', amount: 2.5 })])
  assert.equal(quadratura(s).ok, true)
  assert.deepEqual(blocchiConferma(s, ambitoDi), [])
  // correzione di un campo: l'ORIGINALE resta, la differenza diventa correzione
  s = modificaBozza(s, 'b1', { store: 'Mercato di Rozzano' })
  assert.equal(s.bozze[0].store, 'Mercato')            // mai mutato
  assert.equal(bozzaCorrente(s, 'b1').store, 'Mercato di Rozzano')
  const { cliente, chiamate } = clienteFinto()
  const esito = await confermaRevisione(cliente, dep(), s)
  assert.equal(esito.ok, true)
  const conferma = chiamate.find(c => c.azione === 'conferma')!.payload as { correzioni: Record<string, unknown>[] }
  assert.deepEqual(conferma.correzioni, [{ field: 'store', proposed: 'Mercato', corrected: 'Mercato di Rozzano', draft_id: 'b1' }])
  // NESSUN inserimento diretto nelle spese definitive: solo bozza + rpc
  assert.deepEqual(chiamate.map(c => c.azione), ['bozza', 'conferma'])
})

// ---- documento MISTO: sorelle separate, quote e arrotondamenti ------------
const misto = () => apriRevisione('doc-m', 12.5,
  [bozza({ id: 'bm', group_id: 'g-casa', arrotondamento_cent: 1 }),
   bozza({ id: 'bb', document_id: 'doc-m', group_id: 'g-bnb', room_id: 'r-lena', arrotondamento_cent: -1 })],
  [riga({ id: 'r1', draft_id: 'bm', amount: 4.5 }),
   riga({ id: 'r2', draft_id: 'bm', amount: 2.5 }),
   riga({ id: 'r3', draft_id: 'bm', amount: 0.5, user_added: true }),
   riga({ id: 'r4', draft_id: 'bm', amount: 2.5, excluded: true }),
   riga({ id: 'r5', draft_id: 'bb', amount: 5 })])

test('documento misto: quote per sorella (arrotondamenti ±1 cent), escluse e aggiunte contate, quadratura esatta', () => {
  const s = misto()
  const mia = totaliSorella(s, 'bm')
  assert.equal(mia.sommaCent, 750)
  assert.equal(mia.totaleCent, 751)                    // +1 cent di arrotondamento
  assert.equal(mia.escluse, 1)
  assert.equal(mia.aggiunte, 1)                        // la user_added
  const bnb = totaliSorella(s, 'bb')
  assert.equal(bnb.totaleCent, 499)                    // −1 cent
  assert.equal(quadratura(s).ok, true)                 // 751+499 = 1250
  assert.deepEqual(blocchiConferma(s, ambitoDi), [])   // metodo presente per l'azienda
})

test('QUOTA ZERO esplicita: sorella con tutte le righe escluse resta valida e la quadratura tiene', () => {
  let s = apriRevisione('doc-z', 5,
    [bozza({ id: 'b1' }), bozza({ id: 'b2', group_id: 'g-bnb' })],
    [riga({ id: 'r1', draft_id: 'b1', amount: 5 }), riga({ id: 'r2', draft_id: 'b2', amount: 3 })])
  s = modificaRiga(s, 'r2', { excluded: true })        // quota B&B → 0 esplicito
  assert.equal(totaliSorella(s, 'b2').totaleCent, 0)
  assert.equal(quadratura(s).ok, true)
  assert.deepEqual(blocchiConferma(s, ambitoDi), [])
})

test('QUADRATURA ERRATA: conferma bloccata a schermo (in entrambi i versi), e il rifiuto del server arriva col suo messaggio', async () => {
  let s = misto()
  s = modificaRiga(s, 'r1', { amount: 4 })             // −50 cent: non quadra più
  const q = quadratura(s)
  assert.equal(q.ok, false)
  assert.equal(q.diffCent, 50)
  assert.ok(blocchiConferma(s, ambitoDi)[0].includes('non quadra'))
  assert.ok(blocchiConferma(s, ambitoDi)[0].includes('mancano'))
  // troppo invece che poco: la frase cambia verso
  let s2 = misto()
  s2 = modificaRiga(s2, 'r1', { amount: 5 })           // +50 cent di troppo
  assert.ok(blocchiConferma(s2, ambitoDi)[0].includes('di troppo'))
  // se qualcuno forzasse comunque: il server rifiuta e il messaggio passa
  const { cliente } = clienteFinto({ confermaDocumento: { errore: 'Quadratura non esatta: righe+arrotondamento=1200 cent, documento=1250 cent' } })
  const esito = await confermaRevisione(cliente, dep(), s)
  assert.equal(esito.ok, false)
  assert.ok(!esito.ok && esito.errore.includes('Quadratura'))
  assert.ok(!esito.ok && !esito.incerto)               // rifiuto vero, non incerto
})

test('gruppo mancante e metodo mancante (Casa Ania): blocchi espliciti', () => {
  let s = misto()
  s = modificaBozza(s, 'bm', { group_id: null })
  s = modificaBozza(s, 'bb', { payment_method: null })
  const blocchi = blocchiConferma(s, ambitoDi)
  assert.ok(blocchi.some(b => b.includes('destinatario (gruppo)')))
  assert.ok(blocchi.some(b => b.includes('metodo di pagamento')))
})

test('COERENZA DESTINATARI: una voce con gruppo dell\'altro ambito blocca la conferma (anche una riga nuova)', () => {
  let s = misto()
  s = modificaRiga(s, 'r1', { group_id: 'g-bnb' })     // voce azienda su parte personale
  assert.ok(blocchiConferma(s, ambitoDi).some(b => b.includes('altro ambito')))
  // esclusa → non conta più
  s = modificaRiga(s, 'r1', { excluded: true })
  s = modificaTotale(s, 800)                           // riquadra (751-450+499... non serve: guardiamo solo i blocchi di ambito)
  assert.ok(!blocchiConferma(s, ambitoDi).some(b => b.includes('altro ambito')))
  // riga nuova col gruppo sbagliato
  let s2 = misto()
  s2 = aggiungiRiga(s2, { draft_id: 'bb', name: 'Voce fuori posto', amount: 1, group_id: 'g-casa' }, 'loc-x')
  assert.ok(blocchiConferma(s2, ambitoDi).some(b => b.includes('altro ambito')))
  // il gruppo della MADRE cambiato (stesso ambito) non tocca le righe
  let s3 = misto()
  s3 = modificaBozza(s3, 'bm', { group_id: 'g-teo' })
  assert.equal(rigaCorrente(s3, 'r1').group_id, null)  // le righe restano come sono
  assert.ok(!blocchiConferma(s3, ambitoDi).some(b => b.includes('altro ambito')))
})

test('coerenza quantità × prezzo: avviso NON bloccante solo quando i numeri non tornano', () => {
  assert.equal(avvisoCoerenzaRiga({ qty: 2, unit_price: 1.25, discount: 0, amount: 2.5, excluded: false }), null)
  assert.equal(avvisoCoerenzaRiga({ qty: 1, unit_price: null, discount: 0, amount: 2.5, excluded: false }), null)
  const avviso = avvisoCoerenzaRiga({ qty: 2, unit_price: 1, discount: 0, amount: 2.5, excluded: false })
  assert.ok(avviso && avviso.includes('non torna'))
  // esclusa: nessun avviso (non è nel conto)
  assert.equal(avvisoCoerenzaRiga({ qty: 2, unit_price: 1, discount: 0, amount: 2.5, excluded: true }), null)
})

test('NOTA VUOTA e valori nulli: correzione con corrected=null, mai valori inventati; dubbi solo dove dichiarati', () => {
  let s = apriRevisione('doc-1', 5,
    [bozza({ id: 'b1', description: 'da togliere', confidence: { store: { confidence: 0.55, doubt_reason: 'poco leggibile' } } })],
    [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = modificaBozza(s, 'b1', { description: null })
  const correzioni = correzioniDa(s)
  assert.deepEqual(correzioni, [{ field: 'description', proposed: 'da togliere', corrected: null, draft_id: 'b1' }])
  // dubbi col motivo (sotto soglia 0.8), MAI inventati su altri campi
  const dubbi = dubbiDi(s.bozze[0].confidence)
  assert.deepEqual(dubbi.map(d => d.campo), ['store'])
  assert.ok(dubbi[0].motivo.includes('55%') && dubbi[0].motivo.includes('poco leggibile'))
  // necessità/pianificazione facoltative: nessuna correzione se restano nulle
  assert.ok(!correzioni.some(c => c.field === 'necessity' || c.field === 'planning'))
})

// ---- righe nuove: payload esplicito, id ricordati, mai due INSERT ---------
test('righe nuove: payload SOLO con le colonne della 0021, rimovibili prima del salvataggio, MAI tra le correzioni', async () => {
  let s = apriRevisione('doc-1', 6,
    [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sbagliata', amount: 99 }, 'loc-2')
  s = togliRigaNuova(s, 'loc-2')
  s = modificaTotale(s, 550)
  assert.equal(quadratura(s).ok, true)
  assert.equal(correzioniDa(s).some(c => c.field === 'name'), false)
  const { cliente, chiamate } = clienteFinto()          // l'INSERT rifiuta campi estranei E vincoli violati
  const esito = await salvaModifiche(cliente, dep(), s)
  assert.equal(esito.ok, true)
  const nuove = chiamate.filter(c => c.azione === 'nuova')
  assert.equal(nuove.length, 1)
  const payload = nuove[0].payload as Record<string, unknown>
  assert.equal(payload.name, 'Sacchetto')
  assert.ok(!('idLocale' in payload) && !('stato' in payload) && !('id' in payload))
  // i NOT NULL della 0020: qty e discount viaggiano coi DEFAULT, mai null
  assert.equal(payload.qty, 1)
  assert.equal(payload.discount, 0)
  assert.equal(payload.unit_price, null)                // nullable vero
  // e la precisione prevista: qty/unit_price a 3 decimali passano interi
  const conDecimali = payloadRigaNuova({ draft_id: 'b1', name: 'Ciliegie', amount: 3.75, qty: 0.472, unit_price: 7.945 })
  assert.equal(conDecimali.qty, 0.472)
  assert.equal(conDecimali.unit_price, 7.945)
  // l'id restituito è RICORDATO nello stato: la riga è 'salvata'
  assert.deepEqual(esito.stato.righeNuove.map(r => ({ stato: r.stato, id: r.id })), [{ stato: 'salvata', id: 'srv-1' }])
  // il totale modificato è una correzione a livello di documento
  assert.deepEqual(correzioniDa(esito.stato)[0], { field: 'doc_total', proposed: 6, corrected: 5.5 })
})

test('SALVA RIPETUTO e SALVA→CONFERMA: la stessa riga nuova parte UNA volta sola', async () => {
  let s = apriRevisione('doc-1', 5.5,
    [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  const { cliente, chiamate } = clienteFinto()
  const deposito = dep()
  const primo = await salvaModifiche(cliente, deposito, s)
  assert.equal(primo.ok, true)
  // secondo Salva sullo stato aggiornato: NESSUN nuovo INSERT
  const secondo = await salvaModifiche(cliente, deposito, primo.stato)
  assert.equal(secondo.ok, true)
  assert.equal(chiamate.filter(c => c.azione === 'nuova').length, 1)
  // Salva→Conferma: ancora un solo INSERT, e UNA RPC
  const conferma = await confermaRevisione(cliente, deposito, secondo.stato)
  assert.equal(conferma.ok, true)
  assert.equal(chiamate.filter(c => c.azione === 'nuova').length, 1)
  assert.equal(chiamate.filter(c => c.azione === 'conferma').length, 1)
})

test('FALLIMENTO DOPO UN INSERIMENTO RIUSCITO: il primo id resta, al nuovo Salva parte solo la riga mancante', async () => {
  let s = apriRevisione('doc-1', 6,
    [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Prima', amount: 0.5 }, 'loc-1')
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Seconda', amount: 0.5 }, 'loc-2')
  let inseriti = 0
  const { cliente } = clienteFinto({
    // il primo INSERT risponde; il secondo è un RIFIUTO esplicito del
    // servizio (errore RESTITUITO): non inserita, si può ritentare
    aggiungiRiga: () => (++inseriti === 2 ? { errore: 'permesso negato' } : undefined),
  })
  const esito = await salvaModifiche(cliente, dep(), s)
  assert.equal(esito.ok, false)
  assert.ok(!esito.ok && !esito.incerto)
  const stati = esito.stato.righeNuove.map(r => r.stato)
  assert.deepEqual(stati, ['salvata', 'nuova'])
  // nuovo Salva con un cliente sano: parte SOLO la seconda
  const { cliente: sano, chiamate: dopo } = clienteFinto()
  const riprova = await salvaModifiche(sano, dep(), esito.stato)
  assert.equal(riprova.ok, true)
  assert.equal(dopo.filter(c => c.azione === 'nuova').length, 1)
  assert.equal((dopo.find(c => c.azione === 'nuova')!.payload as { name: string }).name, 'Seconda')
})

test('RESPONSABILITÀ PRIMA DELLA RICHIESTA: la custodia dice «in_invio» già mentre l\'INSERT è per aria — la pagina che muore lì non produce doppioni', async () => {
  let s = apriRevisione('doc-1', 5.5,
    [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  const deposito = dep()
  // un INSERT che NON risponde mai: la richiesta resta per aria
  let arrivata = false
  const { cliente } = clienteFinto({ aggiungiRiga: () => { arrivata = true; return new Promise(() => {}) as never } })
  const inCorso = salvaModifiche(cliente, deposito, s)   // NON si attende: pagina "morta"
  await new Promise(r => setTimeout(r, 10))
  assert.equal(arrivata, true)                           // la richiesta è partita…
  const traccia = deposito.leggi('doc-1').traccia!
  assert.equal(traccia.righeNuove[0].stato, 'in_invio')  // …e la custodia lo sapeva PRIMA
  // "riapertura": in_invio diventa INCERTA, e il Salva successivo NON reinvia
  const riaperto = apriRevisione('doc-1', 5.5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })], traccia)
  assert.equal(riaperto.righeNuove[0].stato, 'incerta')
  const { cliente: sano, chiamate } = clienteFinto()
  const dopo = await salvaModifiche(sano, dep(), riaperto)
  assert.equal(dopo.ok, true)
  assert.equal(chiamate.filter(c => c.azione === 'nuova').length, 0)   // NESSUN secondo INSERT
  assert.ok(blocchiConferma(riaperto, ambitoDi).some(b => b.includes('incerto')))
  void inCorso
})

test('CUSTODIA DELL\'INVIO NEGATA: l\'INSERT non parte proprio (senza traccia, un\'interruzione creerebbe un doppione)', async () => {
  let s = apriRevisione('doc-1', 5.5,
    [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  const vero = dep()
  // la custodia funziona finché non deve registrare un 'in_invio'
  const selettivo: DepositoRevisione = {
    salva: t => t.righeNuove.some(r => r.stato === 'in_invio') ? { errore: 'spazio esaurito' } : vero.salva(t),
    leggi: id => vero.leggi(id), rimuovi: id => vero.rimuovi(id),
  }
  const { cliente, chiamate } = clienteFinto()
  const esito = await salvaModifiche(cliente, selettivo, s)
  assert.ok(!esito.ok && esito.errore.includes('doppione'))
  assert.equal(chiamate.filter(c => c.azione === 'nuova').length, 0)
  assert.equal(esito.stato.righeNuove[0].stato, 'nuova')  // ritentabile, mai inviata
})

test('RISPOSTA PERSA sull\'INSERT: riga INCERTA, mai reinviata, conferma bloccata; si risolve SOLO a mano (niente «Reinserisci»)', async () => {
  let s = apriRevisione('doc-1', 5.5,
    [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  const { cliente } = clienteFinto({ aggiungiRiga: esplode })
  const esito = await salvaModifiche(cliente, dep(), s)
  assert.ok(!esito.ok && esito.incerto === true)
  assert.equal(esito.stato.righeNuove[0].stato, 'incerta')
  // un nuovo Salva NON la reinvia; la conferma è bloccata
  const { cliente: sano, chiamate } = clienteFinto()
  const riprova = await salvaModifiche(sano, dep(), esito.stato)
  assert.equal(riprova.ok, true)                       // nulla di nuovo da fare
  assert.equal(chiamate.filter(c => c.azione === 'nuova').length, 0)
  assert.ok(blocchiConferma(esito.stato, ambitoDi).some(b => b.includes('incerto')))
  // anche un'eccezione NON di rete a richiesta partita è esito ignoto
  const { cliente: strano } = clienteFinto({ aggiungiRiga: () => { throw new Error('boom interno') } })
  let s2 = apriRevisione('doc-1', 5.5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s2 = aggiungiRiga(s2, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-9')
  const e2 = await salvaModifiche(strano, dep(), s2)
  assert.ok(!e2.ok && e2.incerto === true && e2.stato.righeNuove[0].stato === 'incerta')
  // una risposta SENZA id, marcata incerta dall'adattatore, non è ritentabile
  const { cliente: vuoto } = clienteFinto({ aggiungiRiga: { errore: 'risposta senza id', incerto: true } })
  const e3 = await salvaModifiche(vuoto, dep(), s2)
  assert.ok(!e3.ok && e3.incerto === true && e3.stato.righeNuove[0].stato === 'incerta')
  // la risoluzione è solo esplicita: la voce si toglie, non si reinvia
  const risolto = risolviRigaIncerta(esito.stato, esito.stato.righeNuove[0].idLocale)
  assert.equal(risolto.righeNuove.length, 0)
})

// ---- custodia degli originali: sopravvivono a Salva, chiusura, riapertura -
test('ORIGINALI CUSTODITI: dopo Salva e riapertura dal database corretto, originale e correzioni restano', async () => {
  const bozzeDb = [bozza({ id: 'b1' })]
  const righeDb = [riga({ id: 'r1', draft_id: 'b1', amount: 5 })]
  let s = apriRevisione('doc-1', 5, bozzeDb, righeDb)
  s = modificaRiga(s, 'r1', { amount: 6 })             // 5 → 6
  s = modificaBozza(s, 'b1', { store: 'Iper' })        // Mercato → Iper
  s = modificaTotale(s, 600)                           // 5 → 6
  const deposito = dep()
  const { cliente } = clienteFinto()
  const esito = await salvaModifiche(cliente, deposito, s)
  assert.equal(esito.ok, true)
  // "riapertura": il database ora restituisce i valori GIÀ corretti
  const bozzeDopo = [bozza({ id: 'b1', store: 'Iper' })]
  const righeDopo = [riga({ id: 'r1', draft_id: 'b1', amount: 6 })]
  const traccia = deposito.leggi('doc-1').traccia
  assert.ok(traccia)
  const riaperto = apriRevisione('doc-1', 6, bozzeDopo, righeDopo, traccia)
  assert.equal(riaperto.bozze[0].store, 'Mercato')     // l'ORIGINALE, non Iper
  assert.equal(riaperto.righe[0].amount, 5)
  assert.equal(riaperto.docTotaleOriginaleCent, 500)
  assert.equal(rigaCorrente(riaperto, 'r1').amount, 6) // il corrente resta corretto
  const correzioni = correzioniDa(riaperto)
  assert.ok(correzioni.some(c => c.field === 'doc_total' && c.proposed === 5 && c.corrected === 6))
  assert.ok(correzioni.some(c => c.field === 'store' && c.proposed === 'Mercato' && c.corrected === 'Iper'))
  assert.ok(correzioni.some(c => c.field === 'amount' && c.proposed === 5 && c.corrected === 6))
  // SENZA traccia le correzioni sparirebbero: è proprio il caso coperto
  const senza = apriRevisione('doc-1', 6, bozzeDopo, righeDopo)
  assert.equal(correzioniDa(senza).length, 0)
})

test('MODIFICHE NON SALVATE custodite: chiusura e riapertura senza Salva non perdono nulla; a conferma riuscita la traccia si toglie', async () => {
  let s = apriRevisione('doc-1', 5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  const deposito = dep()
  deposito.salva(tracciaDa(s))                          // come fa la schermata a ogni modifica
  // riapertura: il database è ancora quello vecchio, la modifica torna pendente
  const riaperto = apriRevisione('doc-1', 5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })], deposito.leggi('doc-1').traccia)
  assert.equal(bozzaCorrente(riaperto, 'b1').store, 'Iper')
  assert.equal(riaperto.bozze[0].store, 'Mercato')
  // conferma riuscita → la custodia si svuota (le correzioni sono nel registro)
  const { cliente } = clienteFinto()
  const esito = await confermaRevisione(cliente, deposito, riaperto)
  assert.equal(esito.ok, true)
  assert.equal(deposito.leggi('doc-1').traccia, undefined)
})

test('RICONCILIAZIONE alla riapertura: la gemella IDENTICA viene PROPOSTA (mai collegata da sola); nome+importo non bastano', () => {
  let s = apriRevisione('doc-1', 5.5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  s = { ...s, righeNuove: s.righeNuove.map(r => ({ ...r, stato: 'incerta' as const })) }
  const traccia = tracciaDa(s)
  // caso 1: compare una riga user_added IDENTICA in tutti i campi del
  // payload → resta INCERTA ma con la gemella proposta; niente auto-drop
  const identica = riga({ id: 'srv-9', draft_id: 'b1', amount: 0.5, name: 'Sacchetto', user_added: true })
  const arrivata = apriRevisione('doc-1', 5.5, [bozza({ id: 'b1' })],
    [riga({ id: 'r1', draft_id: 'b1', amount: 5 }), identica], traccia)
  assert.equal(arrivata.righeNuove.length, 1)
  assert.equal(arrivata.righeNuove[0].stato, 'incerta')
  assert.equal(arrivata.righeNuove[0].gemella, 'srv-9')
  assert.ok(blocchiConferma(arrivata, ambitoDi).some(b => b.includes('incerto')))   // finché non decide l'utente
  // la risoluzione esplicita chiude la pendenza e la quadratura tiene
  const risolta = risolviRigaIncerta(arrivata, arrivata.righeNuove[0].idLocale)
  assert.equal(risolta.righeNuove.length, 0)
  assert.equal(quadratura(risolta).ok, true)
  // caso 2: stessa bozza, stesso nome e importo ma QUANTITÀ diversa → una
  // somiglianza non è un'identità: NESSUNA gemella proposta
  const diversa = riga({ id: 'srv-8', draft_id: 'b1', amount: 0.5, name: 'Sacchetto', qty: 2, user_added: true })
  assert.equal(stessaRigaNuova(diversa, s.righeNuove[0]), false)
  const ambigua = apriRevisione('doc-1', 5.5, [bozza({ id: 'b1' })],
    [riga({ id: 'r1', draft_id: 'b1', amount: 5 }), diversa], traccia)
  assert.equal(ambigua.righeNuove[0].gemella, undefined)
  // idem con un destinatario diverso
  const altroGruppo = riga({ id: 'srv-7', draft_id: 'b1', amount: 0.5, name: 'Sacchetto', group_id: 'g-teo', user_added: true })
  assert.equal(stessaRigaNuova(altroGruppo, s.righeNuove[0]), false)
  // caso 3: non è mai comparsa — resta incerta, senza gemella
  const persa = apriRevisione('doc-1', 5.5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })], traccia)
  assert.equal(persa.righeNuove.length, 1)
  assert.equal(persa.righeNuove[0].stato, 'incerta')
  assert.equal(persa.righeNuove[0].gemella, undefined)
})

test('CUSTODIA che si guasta DOPO l\'invio: l\'esito lo dice (avviso), la traccia precedente più prudente resta', async () => {
  let s = apriRevisione('doc-1', 5.5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  const vero = dep()
  // la custodia registra l'in_invio, poi si rompe (il post-risposta fallisce)
  const traballante: DepositoRevisione = {
    salva: t => t.righeNuove.some(r => r.stato === 'salvata') ? { errore: 'spazio esaurito' } : vero.salva(t),
    leggi: id => vero.leggi(id), rimuovi: id => vero.rimuovi(id),
  }
  const { cliente } = clienteFinto()
  const esito = await salvaModifiche(cliente, traballante, s)
  assert.equal(esito.ok, true)
  assert.ok(esito.ok && esito.avviso?.includes('custodia non aggiornata'))
  // in memoria la riga è salvata con l'id; su disco resta l'in_invio (più
  // prudente: alla riapertura diventerebbe incerta, mai un doppione)
  assert.deepEqual(esito.stato.righeNuove.map(r => r.stato), ['salvata'])
  assert.equal(vero.leggi('doc-1').traccia!.righeNuove[0].stato, 'in_invio')
})

test('CANONICHE: la sottocategoria incoerente con la categoria blocca (stessa FK composita della 0020); le correzioni le portano', () => {
  let s = apriRevisione('doc-1', 5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = modificaRiga(s, 'r1', { canonical_category_id: 'can-scuola', canonical_subcategory_id: 'can-frutta' })
  assert.ok(blocchiConferma(s, ambitoDi, SOTTO_CANONICHE).some(b => b.includes('sottocategoria')))
  // coerente: nessun blocco, e le canoniche diventano correzioni normali
  let s2 = apriRevisione('doc-1', 5, [bozza({ id: 'b1' })],
    [riga({ id: 'r1', draft_id: 'b1', amount: 5, canonical_category_id: 'can-alim', canonical_subcategory_id: 'can-frutta' })])
  s2 = modificaRiga(s2, 'r1', { canonical_category_id: 'can-scuola', canonical_subcategory_id: 'can-cartoleria' })
  assert.ok(!blocchiConferma(s2, ambitoDi, SOTTO_CANONICHE).some(b => b.includes('sottocategoria')))
  const correzioni = correzioniDa(s2)
  assert.ok(correzioni.some(c => c.field === 'canonical_category_id' && c.proposed === 'can-alim' && c.corrected === 'can-scuola'))
  assert.ok(correzioni.some(c => c.field === 'canonical_subcategory_id' && c.proposed === 'can-frutta' && c.corrected === 'can-cartoleria'))
})

test('CUSTODIA NEGATA: se gli originali non si possono mettere al sicuro, il Salva NON parte', async () => {
  let s = apriRevisione('doc-1', 5, [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  const negato: DepositoRevisione = {
    salva: () => ({ errore: 'spazio esaurito' }),
    leggi: () => ({}), rimuovi: () => ({}),
  }
  const { cliente, chiamate } = clienteFinto()
  const esito = await salvaModifiche(cliente, negato, s)
  assert.ok(!esito.ok && esito.errore.includes('al sicuro'))
  assert.equal(chiamate.length, 0)                     // NESSUNA scrittura remota
})

test('DOPPIO CLIC sulla conferma: la guardia fa partire UNA sola RPC', async () => {
  const s = misto()
  const { cliente, chiamate } = clienteFinto()
  const deposito = dep()
  const guardia = creaGuardiaInvio()
  const invia = () => guardia(() => confermaRevisione(cliente, deposito, s))
  await Promise.all([invia(), invia()])
  assert.equal(chiamate.filter(c => c.azione === 'conferma').length, 1)
})

test('ERRORE DI SALVATAGGIO: ci si ferma al primo errore, la conferma NON parte, niente successi finti', async () => {
  let s = misto()
  s = modificaBozza(s, 'bm', { store: 'Nuovo negozio' })
  s = modificaRiga(s, 'r5', { amount: 5 })
  const { cliente, chiamate } = clienteFinto({ aggiornaBozza: { errore: 'permesso negato' } })
  const esito = await confermaRevisione(cliente, dep(), s)
  assert.equal(esito.ok, false)
  assert.ok(!esito.ok && esito.errore.includes('permesso negato'))
  assert.equal(chiamate.some(c => c.azione === 'conferma'), false)
  // zero righe toccate ≠ successo
  const { cliente: zero } = clienteFinto({ aggiornaBozza: { righe: 0 } })
  const esito2 = await salvaModifiche(zero, dep(), s)
  assert.ok(!esito2.ok && esito2.errore.includes('nessuna riga toccata'))
})

test('ERRORE DI RETE RESTITUITO (non lanciato): è comunque un esito INCERTO, su salvataggio e conferma', async () => {
  let s = misto()
  s = modificaBozza(s, 'bm', { store: 'Nuovo negozio' })
  const { cliente } = clienteFinto({ aggiornaBozza: { errore: 'Failed to fetch' } })
  const esito = await salvaModifiche(cliente, dep(), s)
  assert.ok(!esito.ok && esito.incerto === true)
  assert.ok(!esito.ok && esito.errore.includes('incerto'))
  const { cliente: c2 } = clienteFinto({ confermaDocumento: { errore: 'network error while fetching' } })
  const esito2 = await confermaRevisione(c2, dep(), misto())
  assert.ok(!esito2.ok && esito2.incerto === true)
  assert.ok(!esito2.ok && esito2.errore.includes('NON riprovare alla cieca'))
})

test('RISPOSTA PERSA: esito INCERTO dichiarato, niente successo finto, invito a verificare (la RPC è idempotente)', async () => {
  const s = misto()
  const { cliente } = clienteFinto({ confermaDocumento: esplode })
  const esito = await confermaRevisione(cliente, dep(), s)
  assert.equal(esito.ok, false)
  assert.ok(!esito.ok && esito.incerto === true)
  assert.ok(!esito.ok && esito.errore.includes('NON riprovare alla cieca'))
  // conferma senza spese restituite: incerta, mai ok
  const { cliente: vuota } = clienteFinto({ confermaDocumento: { ids: [] } })
  const esito2 = await confermaRevisione(vuota, dep(), s)
  assert.ok(!esito2.ok && esito2.incerto === true)
  // scarto: motivo obbligatorio + esito incerto gestito (anche RESTITUITO)
  const { cliente: c3 } = clienteFinto()
  assert.ok(!(await scartaRevisione(c3, dep(), 'doc-1', '  ')).ok)
  const { cliente: c4 } = clienteFinto({ scartaDocumento: esplode })
  const e4 = await scartaRevisione(c4, dep(), 'doc-1', 'foto doppia')
  assert.ok(!e4.ok && e4.incerto === true)
  const { cliente: c5 } = clienteFinto({ scartaDocumento: { errore: 'Failed to fetch' } })
  const e5 = await scartaRevisione(c5, dep(), 'doc-1', 'foto doppia')
  assert.ok(!e5.ok && e5.incerto === true)
})
