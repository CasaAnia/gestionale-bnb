// La riga sotto il nome nella scheda della richiesta (Ania, su bozza, 12/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { periodoConGiorni } from './dateItaliane.ts'
import { pezziNumerici, pezziNotti, pezziPersone, pezziCamera, pezziRigaRichiesta, testoRiga, daQuantoArrivata } from './rigaRichiesta.ts'

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

// ── La scheda: pezzi presenti, ordine, e cosa non c'è più ───────────────────
test('nella scheda i pezzi stanno nell’ordine della bozza', () => {
  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  const scheda = pagina.slice(pagina.indexOf('function RigaRichiesta'), pagina.indexOf('function RigaChiusa'))
  const dove = (x: string) => {
    const i = scheda.indexOf(x)
    assert.notEqual(i, -1, `manca ${x} nella scheda`)
    return i
  }
  const ordine = [
    '{nomeCompleto(r)}',          // il nome, a sinistra
    '{quando}',                   // «oggi» / «ieri» / «2 giorni fa», a destra
    '{pezzi.map(',                // date · notti · persone · camera
    '<SegnoStesseDate',           // la pillola blu, se c'è
    '<NotaCliente',               // la nota del cliente, se c'è
    '<TastoPrincipale',           // il tasto pieno
    '<TondiContatto',             // i due tondi, in fondo a destra
    '<ComandiRichiesta',          // «Modifica» · «Rifiuta»
  ]
  const posizioni = ordine.map(dove)
  assert.deepEqual(posizioni, [...posizioni].sort((a, b) => a - b), 'i pezzi della scheda non sono nell’ordine chiesto')

  // La pillola e la nota compaiono solo se c'è qualcosa da dire
  assert.match(scheda, /\{stesseDate && onGruppo &&/)
  assert.match(scheda, /<NotaCliente note=\{r\.note\}/)

  // Le due colonne grandi non stanno più qui: restano nella testa della proposta
  assert.equal(/RigaPersoneCamera/.test(pagina), false)
  // e nemmeno le vecchie ripetizioni di persone e camera
  assert.equal(/qualsiasi camera/.test(scheda), false)

  // Tasto e tondi sulla stessa riga, «Modifica»/«Rifiuta» sotto
  assert.ok(dove('<TondiContatto') - dove('<TastoPrincipale') < 200, 'tasto e tondi non sono sulla stessa riga')
})
