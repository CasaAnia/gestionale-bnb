// La riga sotto il nome nella scheda della richiesta (Ania, su bozza, 12/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { periodoConGiorni } from './dateItaliane.ts'
import { pezziNumerici, pezziNotti, pezziPersone, pezziCamera, pezziRigaRichiesta, pezziRigaElenco, titoloRigaRichiesta, etichettaRigaRichiesta, pezzoCliente, testoRiga, daQuantoArrivata } from './rigaRichiesta.ts'
import { etichettaAltre } from './richiesteStesseDate.ts'

const riga = (x: Parameters<typeof pezziRigaRichiesta>[0]) => testoRiga(pezziRigaRichiesta(x))
const forti = (p: { testo: string; forte: boolean }[]) => p.filter(x => x.forte).map(x => x.testo)

test('la riga si legge tutta di seguito, come sulla bozza', () => {
  assert.equal(
    riga({ periodo: periodoConGiorni('2026-10-29', '2026-10-31'), notti: 2, personeNotti: [3, 3], camera: 'Ambra' }),
    'gio 29 → sab 31 ott · 2 notti · 3 persone · Ambra',
  )
  assert.equal(
    riga({ periodo: periodoConGiorni('2026-11-02', '2026-11-04'), notti: 2, personeNotti: [1, 1], camera: null }),
    'lun 2 → mer 4 nov · 2 notti · 1 persona · camera qualsiasi',
  )
})

test('una notte sola e una persona sola si scrivono al singolare', () => {
  assert.equal(testoRiga(pezziNotti(1)), '1 notte')
  assert.equal(testoRiga(pezziNotti(2)), '2 notti')
  assert.equal(testoRiga(pezziPersone([1])), '1 persona')
  assert.equal(testoRiga(pezziPersone([2])), '2 persone')
})

test('persone che cambiano notte per notte: al posto del numero la sequenza', () => {
  assert.equal(testoRiga(pezziPersone([3, 3, 1])), '3 → 1 persone')
  assert.equal(testoRiga(pezziPersone([2, 1, 2])), '2 → 1 → 2 persone')
  // una sola persona per tutte le notti resta «1 persona», mai «1 → 1»
  assert.equal(testoRiga(pezziPersone([1, 1, 1])), '1 persona')
  // con troppi cambi vale la regola lunga già decisa
  assert.equal(testoRiga(pezziPersone([1, 3, 1, 3])), 'da 1 a 3 persone')
  // e nella riga intera
  assert.equal(
    riga({ periodo: periodoConGiorni('2026-10-29', '2026-11-01'), notti: 3, personeNotti: [3, 3, 1], camera: 'Lena' }),
    'gio 29 ott → dom 1 nov · 3 notti · 3 → 1 persone · Lena',
  )
})

test('la camera: il nome quando c’è, «camera qualsiasi» quando non c’è', () => {
  assert.deepEqual(pezziCamera('Ambra'), [{ testo: 'Ambra', forte: true }])
  assert.deepEqual(pezziCamera(' Lena '), [{ testo: 'Lena', forte: true }])
  // «qualsiasi» non è il nome di niente: resta piccolo e grigio
  assert.deepEqual(pezziCamera(null), [{ testo: 'camera qualsiasi', forte: false }])
  assert.deepEqual(pezziCamera(''), [{ testo: 'camera qualsiasi', forte: false }])
  assert.deepEqual(pezziCamera('   '), [{ testo: 'camera qualsiasi', forte: false }])
  // nell'elenco la parola «camera» non si scrive: resta il solo valore, forte
  assert.deepEqual(pezziCamera(null, { soloValore: true }), [{ testo: 'qualsiasi', forte: true }])
  assert.deepEqual(pezziCamera('', { soloValore: true }), [{ testo: 'qualsiasi', forte: true }])
  assert.deepEqual(pezziCamera('Ambra', { soloValore: true }), [{ testo: 'Ambra', forte: true }])
})

test('in Georgia ci vanno i numeri e il nome della camera, non le parole', () => {
  const p = pezziRigaRichiesta({ periodo: periodoConGiorni('2026-10-29', '2026-10-31'), notti: 2, personeNotti: [3, 3], camera: 'Ambra' })
  assert.deepEqual(forti(p), ['29', '31', '2', '3', 'Ambra'])
  // senza camera chiesta restano solo i numeri
  const q = pezziRigaRichiesta({ periodo: periodoConGiorni('2026-11-02', '2026-11-04'), notti: 2, personeNotti: [1, 1], camera: null })
  assert.deepEqual(forti(q), ['2', '4', '2', '1'])
  // la freccia e i puntini non sono numeri
  assert.equal(testoRiga(p.filter(x => !x.forte)).includes('→'), true)
})

test('pezziNumerici taglia il testo nei suoi numeri', () => {
  assert.deepEqual(pezziNumerici('gio 29'), [{ testo: 'gio ', forte: false }, { testo: '29', forte: true }])
  assert.deepEqual(pezziNumerici('Notti del 29 e 31 ott').filter(x => x.forte).map(x => x.testo), ['29', '31'])
  assert.deepEqual(pezziNumerici(''), [])
})

test('da quanto è arrivata: oggi, ieri, N giorni fa', () => {
  const adesso = new Date(2026, 8, 12, 20, 30)   // sab 12 set 2026, 20:30
  assert.equal(daQuantoArrivata(new Date(2026, 8, 12, 8, 5).toISOString(), adesso), 'oggi')
  // arrivata poco fa
  assert.equal(daQuantoArrivata(new Date(2026, 8, 12, 20, 29).toISOString(), adesso), 'oggi')
  // ieri sera tardi è «ieri», anche se sono passate poche ore
  assert.equal(daQuantoArrivata(new Date(2026, 8, 11, 23, 50).toISOString(), adesso), 'ieri')
  assert.equal(daQuantoArrivata(new Date(2026, 8, 10, 9, 0).toISOString(), adesso), '2 giorni fa')
  assert.equal(daQuantoArrivata(new Date(2026, 7, 30, 9, 0).toISOString(), adesso), '13 giorni fa')
  // data mancante o storta: non si scrive niente, mai «Invalid Date»
  assert.equal(daQuantoArrivata(null, adesso), '')
  assert.equal(daQuantoArrivata('non una data', adesso), '')
})

// ── LE DUE RIGHE DELL'ELENCO (Ania, dal telefono, 12/09/2026) ──────────────
// Prima riga come le righe «Da controllare» della Home: «chi · quando».
// Seconda riga: quanto, quanti e dove, coi soli numeri e la camera in forte.
const elenco = (x: Parameters<typeof pezziRigaElenco>[0]) => testoRiga(pezziRigaElenco(x))

test('la prima riga mette insieme il nome e le date, come nella Home', () => {
  assert.equal(
    titoloRigaRichiesta('Anna Sawicka', periodoConGiorni('2026-10-29', '2026-10-31')),
    'Anna Sawicka · gio 29 → sab 31 ott',
  )
  // un mese diverso fra arrivo e partenza: il periodo lo dice già
  assert.equal(
    titoloRigaRichiesta('Lunga Sosta', periodoConGiorni('2026-10-29', '2026-11-01')),
    'Lunga Sosta · gio 29 ott → dom 1 nov',
  )
  // se manca uno dei due pezzi non resta il puntino appeso
  assert.equal(titoloRigaRichiesta('Anna Sawicka', ''), 'Anna Sawicka')
  assert.equal(titoloRigaRichiesta('', 'gio 29 → sab 31 ott'), 'gio 29 → sab 31 ott')
  assert.equal(titoloRigaRichiesta('  Anna  ', '  gio 29  '), 'Anna · gio 29')
})

test('l’etichetta in alto dice quando è arrivata e da dove', () => {
  const adesso = new Date(2026, 8, 12, 20, 30)   // sab 12 set 2026
  const ieri = new Date(2026, 8, 11, 9, 0).toISOString()
  const oggi = new Date(2026, 8, 12, 8, 0).toISOString()
  assert.equal(etichettaRigaRichiesta(ieri, 'web', adesso), 'ieri · dal sito')
  assert.equal(etichettaRigaRichiesta(oggi, 'telefono', adesso), 'oggi · telefono')
  assert.equal(etichettaRigaRichiesta(oggi, 'whatsapp', adesso), 'oggi · WhatsApp')
  assert.equal(etichettaRigaRichiesta(new Date(2026, 8, 9, 9, 0).toISOString(), 'web', adesso), '3 giorni fa · dal sito')
  // le maiuscole le fa il disegno, non il testo
  assert.equal(etichettaRigaRichiesta(ieri, 'web', adesso).toUpperCase(), 'IERI · DAL SITO')
  // senza data resta il solo canale, senza puntino appeso
  assert.equal(etichettaRigaRichiesta(null, 'telefono', adesso), 'telefono')
  assert.equal(etichettaRigaRichiesta('non una data', 'web', adesso), 'dal sito')
})

test('nella seconda riga sono forti solo i numeri e la camera', () => {
  const p = pezziRigaElenco({ notti: 2, personeNotti: [3, 3], camera: 'Ambra' })
  assert.equal(testoRiga(p), '2 notti · 3 persone · Ambra')
  assert.deepEqual(forti(p), ['2', '3', 'Ambra'])
  // le parole di mezzo e i puntini restano normali
  assert.equal(testoRiga(p.filter(x => !x.forte)), ' notti · ' + ' persone · ')
  // le date non stanno più qui: sono salite nella prima riga
  assert.equal(/gio|ven|sab|dom|lun|mar|mer/.test(testoRiga(p)), false)

  // 1 persona e nessuna camera chiesta: «· qualsiasi», senza la parola «camera»
  const q = pezziRigaElenco({ notti: 2, personeNotti: [1, 1], camera: null })
  assert.equal(elenco({ notti: 2, personeNotti: [1, 1], camera: null }), '2 notti · 1 persona · qualsiasi')
  assert.equal(testoRiga(q).includes('camera'), false, 'la parola «camera» non si scrive più')
  assert.deepEqual(forti(q), ['2', '1', 'qualsiasi'])

  // persone che cambiano notte per notte: forte tutta la sequenza «3 → 1»
  const m = pezziRigaElenco({ notti: 2, personeNotti: [3, 1], camera: null })
  assert.equal(testoRiga(m), '2 notti · 3 → 1 persone · qualsiasi')
  assert.deepEqual(forti(m), ['2', '3', '→', '1', 'qualsiasi'])

  // una notte sola: «1 notte», mai «1 notti»
  const u = pezziRigaElenco({ notti: 1, personeNotti: [2], camera: 'Lena' })
  assert.equal(testoRiga(u), '1 notte · 2 persone · Lena')
  assert.deepEqual(forti(u), ['1', '2', 'Lena'])
  assert.equal(forti(u).some(x => /notte|persone|camera/.test(x)), false)

  // con troppi cambi vale la regola lunga: «da» e «a» non sono forti
  const tanti = pezziRigaElenco({ notti: 4, personeNotti: [1, 3, 1, 3], camera: 'Ambra' })
  assert.equal(testoRiga(tanti), '4 notti · da 1 a 3 persone · Ambra')
  assert.deepEqual(forti(tanti), ['4', '1', '3', 'Ambra'])
})

test('nella testa della proposta la riga resta intera, con la parola «camera»', () => {
  const p = pezziRigaRichiesta({ periodo: periodoConGiorni('2026-11-02', '2026-11-04'), notti: 2, personeNotti: [1, 1], camera: null })
  assert.equal(testoRiga(p), 'lun 2 → mer 4 nov · 2 notti · 1 persona · camera qualsiasi')
  assert.deepEqual(forti(p), ['2', '4', '2', '1'])
})

// ── LA CLIENTE CHE TORNA, NELL'ELENCO (Ania, 12/09/2026) ───────────────────
test('l’etichetta dice anche se la cliente è già stata qui', () => {
  const adesso = new Date(2026, 8, 12, 20, 30)
  const ieri = new Date(2026, 8, 11, 9, 0).toISOString()
  // chi torna: quante volte, al singolare e al plurale
  assert.equal(etichettaRigaRichiesta(ieri, 'web', adesso, pezzoCliente(3, true)), 'ieri · dal sito · già ospite 3 volte')
  assert.equal(etichettaRigaRichiesta(ieri, 'web', adesso, pezzoCliente(1, true)), 'ieri · dal sito · già ospite 1 volta')
  // in archivio ma senza soggiorni conclusi
  assert.equal(etichettaRigaRichiesta(ieri, 'telefono', adesso, pezzoCliente(0, true)), 'ieri · telefono · già in archivio')
  // prima volta: l'etichetta resta quella di prima, senza coda
  assert.equal(etichettaRigaRichiesta(ieri, 'telefono', adesso, pezzoCliente(0, false)), 'ieri · telefono')
  assert.equal(pezzoCliente(0, false), null)
  // a schermo si legge in maiuscolo, ma le maiuscole le fa il disegno
  assert.equal(etichettaRigaRichiesta(ieri, 'web', adesso, pezzoCliente(3, true)).toUpperCase(), 'IERI · DAL SITO · GIÀ OSPITE 3 VOLTE')
})

test('nella seconda riga, in fondo, quanto ha speso da noi', () => {
  const con = pezziRigaElenco({ notti: 5, personeNotti: [3, 3, 3, 3, 3], camera: 'Lena', totaleCent: 136000 })
  assert.equal(testoRiga(con), '5 notti · 3 persone · Lena · 1.360 €')
  // il totale è forte come la camera, ma in rosso: ha un suo tono
  assert.deepEqual(con.filter(x => x.speso).map(x => x.testo), ['1.360 €'])
  assert.equal(con.at(-1)?.forte, true)
  // senza soggiorni conclusi non si scrive niente
  assert.equal(testoRiga(pezziRigaElenco({ notti: 5, personeNotti: [3], camera: 'Lena', totaleCent: 0 })), '5 notti · 3 persone · Lena')
  assert.equal(testoRiga(pezziRigaElenco({ notti: 5, personeNotti: [3], camera: 'Lena' })), '5 notti · 3 persone · Lena')
  assert.equal(pezziRigaElenco({ notti: 1, personeNotti: [1], camera: null, totaleCent: null }).some(x => x.speso), false)
})

// ── L'ETICHETTINA BLU DAVANTI AL NOME ──────────────────────────────────────
test('l’etichettina blu dice quante altre richieste vogliono le stesse notti', () => {
  assert.equal(etichettaAltre(3), '3 altre')
  // «1 altre» non è italiano
  assert.equal(etichettaAltre(1), '1 altra')
  // sola: nessuna etichettina
  assert.equal(etichettaAltre(0), null)
  assert.equal(etichettaAltre(-2), null)
})

// ── La riga: pezzi presenti, ordine, e cosa non c'è più ────────────────────
