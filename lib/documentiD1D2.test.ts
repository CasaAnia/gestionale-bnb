// D1 e D2 dei documenti (Ania, 21/10/2026), dopo l'incidente dei documenti
// finiti sulla persona sbagliata.
// D1: cambiando cliente la pagina dei documenti si azzera subito; le risposte
//     vecchie non toccano la scheda nuova; un caricamento già partito resta sul
//     suo destinatario e il suo esito si dice col nome giusto.
// D2: in «Cambia cliente» (foglio nuovo e finestra vecchia) i documenti si
//     scelgono uno per uno, nessuno all'inizio; il cambio si fa anche senza;
//     il telefono uguale non sceglie nulla.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { testoEsito, rispostaValePerLaPagina, aggiungiEsito, leggiEsiti, togliEsito, ascoltaEsiti } from './esitiDocumenti.ts'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const leggi = (p: string) => readFileSync(join(RADICE, p), 'utf8')

test('D1 · una risposta vale solo per la pagina dello stesso giro e dello stesso cliente', () => {
  const p = { giro: 3, guestId: 'X' }
  assert.equal(rispostaValePerLaPagina(p, { giro: 3, guestId: 'X', montata: true }), true)
  assert.equal(rispostaValePerLaPagina(p, { giro: 4, guestId: 'Y', montata: true }), false)
  // X → Y → X: è di nuovo X, ma la griglia è stata riletta: la risposta vecchia non vale
  assert.equal(rispostaValePerLaPagina(p, { giro: 5, guestId: 'X', montata: true }), false)
  assert.equal(rispostaValePerLaPagina(p, { giro: 3, guestId: 'X', montata: false }), false)
})

test('D1 · gli esiti tardivi dicono sempre a chi è andato il documento', () => {
  assert.equal(testoEsito({ id: '1', guestId: 'X', nome: 'Anna Esempio', tipo: 'caricato' }), 'Il documento caricato per Anna Esempio è stato salvato nella scheda di Anna Esempio.')
  assert.match(testoEsito({ id: '2', guestId: 'X', nome: 'Anna Esempio', tipo: 'caricamento_fallito', dettaglio: 'rete' }), /^Il caricamento per Anna Esempio non è riuscito: rete\. Riaprire la scheda di Anna Esempio/)
  assert.match(testoEsito({ id: '3', guestId: 'X', nome: '', tipo: 'eliminato' }), /la cliente precedente/)
  let avvisi = 0
  const smetti = ascoltaEsiti(() => { avvisi++ })
  const prima = leggiEsiti().length
  aggiungiEsito({ guestId: 'X', nome: 'Anna Esempio', tipo: 'caricato' })
  assert.equal(leggiEsiti().length, prima + 1)
  togliEsito(leggiEsiti()[leggiEsiti().length - 1].id)
  assert.equal(leggiEsiti().length, prima)
  assert.equal(avvisi, 2)
  smetti()
})

test('D1 · la pagina dei documenti si azzera nello stesso disegno in cui cambia il cliente', () => {
  const c = leggi('components/DocumentiCliente.tsx')
  const azzera = c.slice(c.indexOf('if (perCliente !== guestId) {'), c.indexOf('if (perCliente !== guestId) {') + 400)
  for (const s of ['setDocumenti([])', 'setAnteprime({})', 'setLoading(true)', 'setErrore(null)', 'setDaCancellare(null)', 'setAperto(null)', 'setAprendo(null)', 'setErroreAnteprime(null)', 'setCaricando(false)', 'setLato(null)']) {
    assert.ok(azzera.includes(s), `manca ${s} nell'azzeramento`)
  }
  // il conteggio della riga «documenti» della vecchia scheda prenotazione, idem
  assert.match(c, /if \(perCliente !== guestId\) \{ setPerCliente\(guestId\); setLetto\(null\) \}/)
})

test('D1 · il caricamento fissa il destinatario alla partenza e non entra nella griglia di un altro cliente', () => {
  const c = leggi('components/DocumentiCliente.tsx')
  const carica = c.slice(c.indexOf('async function carica('), c.indexOf('async function apri('))
  assert.match(carica, /const destinatario = guestId, nomeDestinatario = nome/)
  assert.match(carica, /percorsoDocumento\(destinatario, id, tipo\)/)
  assert.match(carica, /guest_id: destinatario, percorso/)
  assert.doesNotMatch(carica, /guest_id: guestId/)
  // la griglia si tocca solo DOPO il controllo del giro; altrimenti esito a parte col nome
  assert.ok(carica.indexOf("if (!valeAncora(p)) { aggiungiEsito({ guestId: destinatario, nome: nomeDestinatario, tipo: 'caricato' }); return }") < carica.indexOf('setDocumenti(l => [...l, doc])'))
  assert.match(carica, /else aggiungiEsito\(\{ guestId: destinatario, nome: nomeDestinatario, tipo: 'caricamento_fallito'/)
  // apertura, riprova anteprime ed eliminazione controllano il giro
  assert.match(c.slice(c.indexOf('async function apri('), c.indexOf('async function cancella(')), /if \(!valeAncora\(p\)\) return/)
  assert.match(c.slice(c.indexOf('async function riprovaAnteprime('), c.indexOf('useEffect(')), /if \(!valeAncora\(p\)\) return/)
  const cancella = c.slice(c.indexOf('async function cancella('), c.indexOf('// Veste «Maison»'))
  assert.match(cancella, /\.delete\(\)\.eq\('id', d\.id\)\.eq\('guest_id', d\.guest_id\)\.select\('id'\)/)
  // la conferma di eliminazione dice di chi è il documento
  assert.match(c, /data-elimina-di>\{etichettaLeggibile\(daCancellare\)\}\{nome \? ` di \$\{nome\}` : ''\}/)
})

test('D1 · la pagina cliente non mostra mai il nome di prima sopra i documenti nuovi', () => {
  const p = leggi('app/clienti/[id]/page.tsx')
  assert.match(p, /if \(perId !== id\) \{\s*setPerId\(id\)\s*setGuest\(null\); setBookings\(\[\]\); setLoading\(true\)/)
  assert.match(p, /\{String\(guest\.id\) === String\(id\) && <DocumentiCliente guestId=\{String\(id\)\} nome=\{nome\} \/>\}/)
})

test('D2 · nei due «Cambia cliente» nessun documento è scelto all’inizio e si sposta solo quello spuntato', () => {
  for (const f of ['components/scheda/FoglioCambiaCliente.tsx', 'components/CambiaCliente.tsx']) {
    const c = leggi(f)
    assert.match(c, /const \[scelti, setScelti\] = useState<string\[\]>\(\[\]\)/, f)
    assert.doesNotMatch(c, /\bspostaDoc\b|setSpostaDoc|useState\(true\)/, `${f}: niente più casella unica già spuntata`)
    assert.match(c, /<SceltaDocumenti documenti=\{documenti\} scelti=\{scelti\}/, f)
    assert.match(c, /const daSpostare = (scelti|ids)\.filter\(id => documenti\.some\(d => d\.id === id\)\)/, f)
    assert.match(c, /if \(daSpostare\.length > 0 && clienteAttuale\?\.id\)/, f)
    assert.match(c, /spostaDocumenti\(daSpostare,/, f)
    // il telefono non entra nella scelta dei documenti
    assert.doesNotMatch(c.slice(c.indexOf('<SceltaDocumenti'), c.indexOf('<SceltaDocumenti') + 400), /phone|telefono|stessoNumero/, f)
  }
  const s = leggi('components/SceltaDocumenti.tsx')
  assert.doesNotMatch(s, /phone|telefono|stessoNumero|chiaveTelefono/)
  assert.match(s, /checked=\{scelti\.includes\(d\.id\)\}/)
  assert.match(s, /data-riepilogo-documenti/)
  // il cambio non dipende dai documenti: scriviCambioCliente parte anche con zero scelti
  const foglio = leggi('components/scheda/FoglioCambiaCliente.tsx')
  assert.ok(foglio.indexOf('scriviCambioCliente(booking, cliente.id') < foglio.indexOf('await spostaDocumentiPoiChiudi(cliente)'))
})

test('D2 · la scrittura sposta solo gli id scelti, dal cliente di partenza, e controlla quali sono passati', () => {
  const d = leggi('lib/cambiaClienteDati.ts')
  const f = d.slice(d.indexOf('export async function spostaDocumenti('), d.indexOf('// La scrittura vera'))
  assert.match(f, /\.update\(\{ guest_id: nuovoGuestId \}\)\.eq\('guest_id', vecchioGuestId\)\.in\('id', ids\)\.select\('id'\)/)
  assert.match(f, /const esito = esitoSpostamento\(ids, spostati\)/)
})
