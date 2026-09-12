// La riga sotto il nome nella scheda della richiesta (Ania, su bozza, 12/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { periodoConGiorni } from './dateItaliane.ts'
import { pezziNumerici, pezziNotti, pezziPersone, pezziCamera, pezziRigaRichiesta, testoRiga, daQuantoArrivata } from './rigaRichiesta.ts'
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
  // nell'elenco «qualsiasi» è forte, la parola «camera» no: il testo non cambia
  assert.deepEqual(pezziCamera(null, { qualsiasiForte: true }), [{ testo: 'camera ', forte: false }, { testo: 'qualsiasi', forte: true }])
  assert.deepEqual(pezziCamera('Ambra', { qualsiasiForte: true }), [{ testo: 'Ambra', forte: true }])
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

// ── LA SECONDA RIGA DELL'ELENCO (Ania, dal telefono, 12/09/2026) ───────────
// In semibold verde solo i DATI: le date con la freccia, il numero delle
// notti, quello delle persone e la camera. Le parole di mezzo — «notti»,
// «persone», «persona», «camera», i puntini — restano piccole e grigie.
test('nella riga dell’elenco sono forti solo le date, i numeri e la camera', () => {
  const p = pezziRigaRichiesta({ periodo: periodoConGiorni('2026-10-29', '2026-10-31'), notti: 2, personeNotti: [3, 3], camera: 'Ambra', forte: 'elenco' })
  // gio 29 → sab 31 ott · 2 notti · 3 persone · Ambra
  assert.deepEqual(forti(p), ['gio 29 → sab 31 ott', '2', '3', 'Ambra'])
  // il testo però non cambia: è quello della bozza
  assert.equal(testoRiga(p), 'gio 29 → sab 31 ott · 2 notti · 3 persone · Ambra')
  // le parole di mezzo e i puntini restano normali
  assert.equal(testoRiga(p.filter(x => !x.forte)), ' · ' + ' notti · ' + ' persone · ')

  // 1 persona e nessuna camera chiesta: «qualsiasi» è forte, «camera» no
  const q = pezziRigaRichiesta({ periodo: periodoConGiorni('2026-11-03', '2026-11-05'), notti: 2, personeNotti: [1, 1], camera: null, forte: 'elenco' })
  assert.equal(testoRiga(q), 'mar 3 → gio 5 nov · 2 notti · 1 persona · camera qualsiasi')
  assert.deepEqual(forti(q), ['mar 3 → gio 5 nov', '2', '1', 'qualsiasi'])

  // persone che cambiano notte per notte: forte tutta la sequenza «3 → 1»
  const m = pezziRigaRichiesta({ periodo: periodoConGiorni('2026-10-29', '2026-10-31'), notti: 2, personeNotti: [3, 1], camera: null, forte: 'elenco' })
  assert.equal(testoRiga(m), 'gio 29 → sab 31 ott · 2 notti · 3 → 1 persone · camera qualsiasi')
  assert.deepEqual(forti(m), ['gio 29 → sab 31 ott', '2', '3', '→', '1', 'qualsiasi'])
  assert.equal(m.filter(x => x.forte).map(x => x.testo).join('').includes('3→1'), true)

  // una notte sola: «1 notte», mai «1 notti»
  const u = pezziRigaRichiesta({ periodo: periodoConGiorni('2026-11-03', '2026-11-04'), notti: 1, personeNotti: [2], camera: 'Lena', forte: 'elenco' })
  assert.equal(testoRiga(u), 'mar 3 → mer 4 nov · 1 notte · 2 persone · Lena')
  assert.deepEqual(forti(u), ['mar 3 → mer 4 nov', '1', '2', 'Lena'])
  // «notte» e «persone» non sono forti
  assert.equal(forti(u).some(x => /notte|persone|camera/.test(x)), false)

  // senza il modo si continua a fare come nella testa della proposta
  const vecchio = pezziRigaRichiesta({ periodo: periodoConGiorni('2026-10-29', '2026-10-31'), notti: 2, personeNotti: [3, 3], camera: 'Ambra' })
  assert.deepEqual(forti(vecchio), ['29', '31', '2', '3', 'Ambra'])
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
test('nella riga i pezzi stanno nell’ordine della bozza', () => {
  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  const riga = pagina.slice(pagina.indexOf('function RigaRichiesta'), pagina.indexOf('function RigaChiusa'))
  const dove = (x: string) => {
    const i = riga.indexOf(x)
    assert.notEqual(i, -1, `manca ${x} nella riga`)
    return i
  }
  const ordine = [
    '<SegnoStesseDate',           // l'etichettina blu, DAVANTI al nome
    '{nomeCompleto(r)}',          // il nome
    '{quando}',                   // «oggi» / «ieri» / «2 giorni fa», a destra
    '{pezzi.map(',                // date · notti · persone · camera
    '<NotaCliente',               // la nota del cliente, se c'è
    '<TastoPrincipale',           // la pastiglia verde
    '<ComandiRichiesta',          // «Modifica» e «Rifiuta»
    '<IconeContatto',             // le due icone, in fondo a destra
  ]
  const posizioni = ordine.map(dove)
  assert.deepEqual(posizioni, [...posizioni].sort((a, b) => a - b), 'i pezzi della riga non sono nell’ordine chiesto')

  // l'etichettina e la nota compaiono solo se c'è qualcosa da dire
  assert.match(riga, /\{stesseDate && onGruppo && <SegnoStesseDate/)
  assert.match(riga, /<NotaCliente note=\{r\.note\} home/)

  // la riga è separata solo da un filo, con 11 px sopra e sotto: niente riquadri
  assert.match(riga, /border-t border-card-border/)
  assert.match(riga, /paddingTop: 11, paddingBottom: 11/)

  // prima riga: nome 14,5 semibold, «quando» 11 px grigio chiaro
  assert.match(riga, /fontSize: 14\.5, fontWeight: 600, color: 'var\(--color-green-dark\)'/)
  assert.match(riga, /fontSize: 11, color: GRIGIO_QUANDO/)
  assert.match(pagina, /const GRIGIO_QUANDO = '#B9B6AD'/)
  // seconda riga: 13 px, grigio verde, e non va a capo
  assert.match(riga, /fontSize: 13, lineHeight: 1\.3, color: GRIGIO_RIGA/)
  assert.match(pagina, /const GRIGIO_RIGA = '#6b736a'/)
  assert.match(riga, /forte: 'elenco'/)
  // non si taglia: nei casi normali sta in una riga, e quando le persone
  // cambiano tante volte va a capo invece di nascondere la camera
  assert.match(riga, /className="mt-\[3px\]"/)

  // l'etichettina blu: fondo e testo della bozza, con la misura delle altre
  assert.match(pagina, /const BLU_FONDO = '#DCE7ED'/)
  assert.match(pagina, /const BLU_TESTO = '#3F6377'/)
  const segno = pagina.slice(pagina.indexOf('function SegnoStesseDate'), pagina.indexOf('function RigaRichiesta'))
  assert.match(segno, /borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '2px 7px'/)

  // Le due colonne grandi non stanno più qui: restano nella testa della proposta
  assert.equal(/RigaPersoneCamera/.test(pagina), false)
  // e nemmeno le vecchie ripetizioni di persone e camera
  assert.equal(/qualsiasi camera/.test(riga), false)
  // niente più i tondi col contorno né il Georgia grande dentro la riga
  assert.equal(/TondiContatto|fontFamily: GEORGIA/.test(riga), false)

  // l'ultima riga resta com'è: pastiglia verde, «Modifica», «Rifiuta» e in
  // fondo a destra le due icone nude (Ania, dal telefono, 12/09/2026)
  assert.match(riga, /<IconeContatto r=\{r\} className="ml-auto" \/>/)
  const azioni = readFileSync(new URL('../components/richieste/AzioniRichiesta.tsx', import.meta.url), 'utf8')
  const icone = azioni.slice(azioni.indexOf('export function IconeContatto'), azioni.indexOf('export function ComandiRichiesta'))
  // le icone ci sono sempre: l'unico caso in cui non compaiono è la richiesta
  // senza numero di telefono, dove non c'è niente da chiamare
  assert.equal((icone.match(/if \(/g) || []).length, 1)
  assert.match(icone, /if \(!telefono\) return null/)
  assert.match(icone, /aria-label=\{`Chiama \$\{nome\}`\}/)
  assert.match(icone, /aria-label=\{`Scrivi su WhatsApp a \$\{nome\}`\}/)
})
