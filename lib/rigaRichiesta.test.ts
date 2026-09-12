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
  assert.equal(etichettaRigaRichiesta(ieri, 'web', adesso, pezzoCliente(3, true)), 'ieri · dal sito · già stata qui 3 volte')
  assert.equal(etichettaRigaRichiesta(ieri, 'web', adesso, pezzoCliente(1, true)), 'ieri · dal sito · già stata qui 1 volta')
  // in archivio ma senza soggiorni conclusi
  assert.equal(etichettaRigaRichiesta(ieri, 'telefono', adesso, pezzoCliente(0, true)), 'ieri · telefono · già in archivio')
  // prima volta: l'etichetta resta quella di prima, senza coda
  assert.equal(etichettaRigaRichiesta(ieri, 'telefono', adesso, pezzoCliente(0, false)), 'ieri · telefono')
  assert.equal(pezzoCliente(0, false), null)
  // a schermo si legge in maiuscolo, ma le maiuscole le fa il disegno
  assert.equal(etichettaRigaRichiesta(ieri, 'web', adesso, pezzoCliente(3, true)).toUpperCase(), 'IERI · DAL SITO · GIÀ STATA QUI 3 VOLTE')
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

test('stella e «ricevuta» nella riga: ci sono solo quando servono', () => {
  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  const riga = pagina.slice(pagina.indexOf('function RigaRichiesta'), pagina.indexOf('function RigaChiusa'))
  // la stella della cliente ottima, in ottone, davanti al nome
  assert.match(riga, /\{cliente\.stella && <span data-stella/)
  assert.match(riga, /style=\{\{ color: OTTONE, marginRight: 4 \}\}>★/)
  // «ricevuta»: 11 px maiuscola ottone, dopo il nome
  assert.match(riga, /\{cliente\.ricevuta && \(/)
  assert.match(riga, /data-ricevuta className="uppercase" style=\{\{ fontSize: 11, letterSpacing: '0\.6px', fontWeight: 700, color: OTTONE \}\}>ricevuta/)
  assert.ok(riga.indexOf('data-stella') < riga.indexOf('{nomeCompleto(r)}'), 'la stella non sta davanti al nome')
  assert.ok(riga.indexOf('data-ricevuta') > riga.indexOf('{nomeCompleto(r)}'), '«ricevuta» non sta dopo il nome')
  // il totale speso: rosso come la nota, e forte come la camera
  assert.match(pagina, /const ROSSO_SPESO = '#C00000'/)
  assert.match(riga, /x\.speso \? \{ color: ROSSO_SPESO \}/)
  // la vecchia pastiglia verde «Già stato da noi» non c'è più
  assert.equal(/data-gia-stato|etichettaGiaStato/.test(pagina), false)
  // chi è alla prima volta non ha niente: la riga resta com'era
  assert.match(pagina, /const CLIENTE_NUOVA: ClienteRiga = \{ volte: 0, inArchivio: false, stella: false, ricevuta: false, totaleCent: 0 \}/)
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
    '{etichetta}',                // «IERI · DAL SITO», in alto
    '<SegnoStesseDate',           // l'etichettina blu, nella riga dell'etichetta
    '{nomeCompleto(r)}',          // il titolo: il nome
    '{periodo}',                  // e le date, sulla stessa riga
    '{pezzi.map(',                // notti · persone · camera
    '<NotaCliente',               // la nota del cliente, se c'è
    '<TastoPrincipale',           // la pastiglia verde
    '<ComandiRichiesta',          // «Modifica» e «Rifiuta»
    '<IconeContatto',             // le due icone, in fondo a destra
  ]
  const posizioni = ordine.map(dove)
  assert.deepEqual(posizioni, [...posizioni].sort((a, b) => a - b), 'i pezzi della riga non sono nell’ordine chiesto')

  // l'etichettina blu e la nota compaiono solo se c'è qualcosa da dire
  assert.match(riga, /\{stesseDate && onGruppo && <SegnoStesseDate/)

  // ── LE STESSE CLASSI DELLE RIGHE «DA CONTROLLARE» DELLA HOME ────────────
  // (Ania, dal telefono, 12/09/2026: «esattamente come la Home, senza
  // invenzioni»). Se la Home cambia misura, questa prova se ne accorge.
  const home = readFileSync(new URL('../components/DaControllare.tsx', import.meta.url), 'utf8')
  const ETICHETTA = 'text-[10px] uppercase tracking-[1.5px] text-brass'
  const TITOLO = 'text-[15px] font-semibold text-green-dark leading-snug mt-0.5'
  const SOTTO = 'text-[12.5px] leading-snug mt-0.5'
  for (const classe of [ETICHETTA, TITOLO, SOTTO]) {
    assert.ok(home.includes(classe), `la Home non usa più «${classe}»`)
    assert.ok(riga.includes(classe), `la riga della richiesta non usa «${classe}»`)
  }
  // la riga sotto è color stone, come il «motivo» della Home
  assert.match(riga, /style=\{\{ color: 'var\(--color-stone\)' \}\}/)
  assert.match(home, /style=\{\{ color: 'var\(--color-stone\)' \}\}/)
  // la nota è lo STESSO componente della Home, ma nella misura grande: nella
  // riga si legge come il nome (Ania, dal telefono, 12/09/2026)
  assert.match(home, /<NotaCliente note=\{e\.nota\} piccola/)
  assert.match(riga, /<NotaCliente note=\{r\.note\} grande/)
  // 12 px sopra e sotto, come py-3 della Home, e il filo che separa
  assert.match(riga, /border-t border-card-border/)
  assert.match(riga, /paddingTop: 12, paddingBottom: 12/)
  assert.match(home, /py-3/)

  // l'etichetta: quando è arrivata, da dove, e se la conosciamo già
  assert.match(riga, /const etichetta = etichettaRigaRichiesta\(r\.created_at, r\.canale, adesso, pezzoCliente\(cliente\.volte, cliente\.inArchivio\)\)/)
  // «ieri» non sta più a destra da solo
  assert.equal(/GRIGIO_QUANDO|\{quando\}/.test(riga), false, '«ieri» sta ancora a destra')

  // il titolo: nome e date insieme; il nome NON si taglia e il puntino resta
  // col nome, così la riga sotto non comincia con un «·»
  assert.match(riga, /aria-label=\{titoloRigaRichiesta\(nomeCompleto\(r\), periodo\)\}/)
  assert.match(riga, /\{nomeCompleto\(r\)\}\{cliente\.ricevuta \? '' : ' ·'\}/)
  assert.match(riga, /className="break-words"/)
  assert.match(riga, /<span className="whitespace-nowrap">\{periodo\}<\/span>/)
  assert.equal(/truncate/.test(riga), false, 'il nome viene ancora tagliato')

  // la riga sotto: forti solo i numeri e la camera (lib/rigaRichiesta), e
  // grandi come il titolo — 15 px — mentre le parole di mezzo restano 12,5
  assert.match(riga, /pezziRigaElenco\(\{ notti: nottiRichiesta\(r\), personeNotti, camera/)
  assert.match(riga, /className=\{x\.forte \? 'text-\[15px\] font-semibold' : undefined\}/)
  assert.match(riga, /x\.forte \? \{ color: 'var\(--color-green-dark\)' \}/)
  assert.ok(riga.includes(SOTTO), 'le parole di mezzo non sono più 12,5 px')

  // l'etichettina blu: fondo e testo della bozza, con la misura delle altre
  assert.match(pagina, /const BLU_FONDO = '#DCE7ED'/)
  assert.match(pagina, /const BLU_TESTO = '#3F6377'/)
  const segno = pagina.slice(pagina.indexOf('function SegnoStesseDate'), pagina.indexOf('function RigaRichiesta'))
  assert.match(segno, /borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '2px 7px'/)

  // Le due colonne grandi non stanno più qui: restano nella testa della proposta
  assert.equal(/RigaPersoneCamera/.test(pagina), false)
  assert.equal(/qualsiasi camera/.test(riga), false)
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
