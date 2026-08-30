// ============================================================================
// Test Fase 4 blocco 3 — REVISIONE delle bozze: logica pura + servizi con
// cliente SIMULATO. Casi obbligatori: documento semplice e misto, quota
// zero, arrotondamenti, righe escluse, nota vuota, quadratura errata,
// doppio clic, errore di salvataggio, risposta persa.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aggiungiRiga, apriRevisione, blocchiConferma, bozzaCorrente, correzioniDa,
  dubbiDi, modificaBozza, modificaRiga, modificaTotale, quadratura,
  togliRigaNuova, totaliSorella, type BozzaGrezza, type RigaGrezza,
} from './revisione.ts'
import { confermaRevisione, salvaModifiche, scartaRevisione, type ClienteRevisione } from './revisioneScrittura.ts'
import { creaGuardiaInvio } from './scrittura.ts'

const AMBITI: Record<string, 'personale' | 'azienda'> = { 'g-casa': 'personale', 'g-bnb': 'azienda' }
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

// il cliente SIMULATO: registra le chiamate, campi validati contro la 0021
const CAMPI_BOZZA = new Set(['expense_date', 'group_id', 'category_id', 'subcategory', 'canonical_category_id', 'canonical_subcategory_id', 'store', 'description', 'payment_method', 'room_id', 'expense_nature', 'arrotondamento_cent'])
const CAMPI_RIGA = new Set(['name', 'qty', 'unit_price', 'discount', 'amount', 'group_id', 'category_id', 'subcategory', 'canonical_category_id', 'canonical_subcategory_id', 'necessity', 'planning', 'excluded'])
function clienteFinto(risposte: Partial<Record<keyof ClienteRevisione, unknown>> = {}) {
  const chiamate: { azione: string; payload?: unknown }[] = []
  const rispondi = (k: keyof ClienteRevisione, base: unknown) => {
    const r = risposte[k]
    if (typeof r === 'function') (r as () => never)()
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
      chiamate.push({ azione: 'riga', payload: { id, campi } }); return rispondi('aggiornaRiga', { righe: 1 })
    },
    async aggiungiRiga(r) { chiamate.push({ azione: 'nuova', payload: r }); return rispondi('aggiungiRiga', { id: 'nuova-1' }) },
    async confermaDocumento(id, correzioni) { chiamate.push({ azione: 'conferma', payload: { id, correzioni } }); return rispondi('confermaDocumento', { ids: ['spesa-1'] }) },
    async scartaDocumento(id, motivo) { chiamate.push({ azione: 'scarta', payload: { id, motivo } }); return rispondi('scartaDocumento', {}) },
  }
  return { cliente, chiamate }
}
const esplode = () => { throw new Error('Failed to fetch') }

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
  const esito = await confermaRevisione(cliente, s)
  assert.deepEqual(esito, { ok: true })
  const conferma = chiamate.find(c => c.azione === 'conferma')!.payload as { correzioni: Record<string, unknown>[] }
  assert.deepEqual(conferma.correzioni, [{ field: 'store', proposed: 'Mercato', corrected: 'Mercato di Rozzano', draft_id: 'b1' }])
  // NESSUN inserimento diretto nelle spese definitive: solo bozza + rpc
  assert.deepEqual(chiamate.map(c => c.azione), ['bozza', 'conferma'])
})

// ---- documento MISTO: sorelle separate, quote e arrotondamenti ------------
const misto = () => apriRevisione('doc-m', 12.5,
  [bozza({ id: 'bm', group_id: 'g-casa', arrotondamento_cent: 1 }),
   bozza({ id: 'bb', group_id: 'g-bnb', room_id: 'r-lena', arrotondamento_cent: -1 })],
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

test('QUADRATURA ERRATA: conferma bloccata a schermo, e il rifiuto del server arriva col suo messaggio', async () => {
  let s = misto()
  s = modificaRiga(s, 'r1', { amount: 4 })             // −50 cent: non quadra più
  const q = quadratura(s)
  assert.equal(q.ok, false)
  assert.equal(q.diffCent, 50)
  assert.ok(blocchiConferma(s, ambitoDi)[0].includes('non quadra'))
  // se qualcuno forzasse comunque: il server rifiuta e il messaggio passa
  const { cliente } = clienteFinto({ confermaDocumento: { errore: 'Quadratura non esatta: righe+arrotondamento=1200 cent, documento=1250 cent' } })
  const esito = await confermaRevisione(cliente, s)
  assert.equal(esito.ok, false)
  assert.ok(!esito.ok && esito.errore.includes('Quadratura'))
})

test('gruppo mancante e metodo mancante (Casa Ania): blocchi espliciti', () => {
  let s = misto()
  s = modificaBozza(s, 'bm', { group_id: null })
  s = modificaBozza(s, 'bb', { payment_method: null })
  const blocchi = blocchiConferma(s, ambitoDi)
  assert.ok(blocchi.some(b => b.includes('destinatario')))
  assert.ok(blocchi.some(b => b.includes('metodo di pagamento')))
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

test('righe nuove: inserite via servizio (user_added dal trigger), rimovibili prima del salvataggio, MAI tra le correzioni', async () => {
  let s = apriRevisione('doc-1', 6,
    [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sbagliata', amount: 99 }, 'loc-2')
  s = togliRigaNuova(s, 'loc-2')
  s = modificaTotale(s, 550)
  assert.equal(quadratura(s).ok, true)
  assert.equal(correzioniDa(s).some(c => c.field === 'name'), false)
  const { cliente, chiamate } = clienteFinto()
  assert.deepEqual(await salvaModifiche(cliente, s), { ok: true })
  const nuove = chiamate.filter(c => c.azione === 'nuova')
  assert.equal(nuove.length, 1)
  assert.deepEqual((nuove[0].payload as { name: string }).name, 'Sacchetto')
  // il totale modificato è una correzione a livello di documento
  assert.deepEqual(correzioniDa(s)[0], { field: 'doc_total', proposed: 6, corrected: 5.5 })
})

test('DOPPIO CLIC sulla conferma: la guardia fa partire UNA sola RPC', async () => {
  const s = misto()
  const { cliente, chiamate } = clienteFinto()
  const guardia = creaGuardiaInvio()
  const invia = () => guardia(() => confermaRevisione(cliente, s))
  await Promise.all([invia(), invia()])
  assert.equal(chiamate.filter(c => c.azione === 'conferma').length, 1)
})

test('ERRORE DI SALVATAGGIO: ci si ferma al primo errore, la conferma NON parte, niente successi finti', async () => {
  let s = misto()
  s = modificaBozza(s, 'bm', { store: 'Nuovo negozio' })
  s = modificaRiga(s, 'r5', { amount: 5 })
  const { cliente, chiamate } = clienteFinto({ aggiornaBozza: { errore: 'permesso negato' } })
  const esito = await confermaRevisione(cliente, s)
  assert.equal(esito.ok, false)
  assert.ok(!esito.ok && esito.errore.includes('permesso negato'))
  assert.equal(chiamate.some(c => c.azione === 'conferma'), false)
  // zero righe toccate ≠ successo
  const { cliente: zero } = clienteFinto({ aggiornaBozza: { righe: 0 } })
  const esito2 = await salvaModifiche(zero, s)
  assert.ok(!esito2.ok && esito2.errore.includes('nessuna riga toccata'))
})

test('RISPOSTA PERSA: esito INCERTO dichiarato, niente successo finto, invito a verificare (la RPC è idempotente)', async () => {
  const s = misto()
  const { cliente } = clienteFinto({ confermaDocumento: esplode })
  const esito = await confermaRevisione(cliente, s)
  assert.equal(esito.ok, false)
  assert.ok(!esito.ok && esito.incerto === true)
  assert.ok(!esito.ok && esito.errore.includes('NON riprovare alla cieca'))
  // conferma senza spese restituite: incerta, mai ok
  const { cliente: vuota } = clienteFinto({ confermaDocumento: { ids: [] } })
  const esito2 = await confermaRevisione(vuota, s)
  assert.ok(!esito2.ok && esito2.incerto === true)
  // scarto: motivo obbligatorio + esito incerto gestito
  const { cliente: c3 } = clienteFinto()
  assert.ok(!(await scartaRevisione(c3, 'doc-1', '  ')).ok)
  const { cliente: c4 } = clienteFinto({ scartaDocumento: esplode })
  const e4 = await scartaRevisione(c4, 'doc-1', 'foto doppia')
  assert.ok(!e4.ok && e4.incerto === true)
})
