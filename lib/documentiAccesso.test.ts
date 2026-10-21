// Documenti degli ospiti raggiungibili dalla scheda (Ania, 21/10/2026).
// Dal 29/09 (scheda a linguette, 7474fdc) la linguetta «Oggi» diceva solo
// «Documento · caricato» o «da chiedere all'arrivo», senza nessun comando:
// niente «Aggiungi» e nessun modo di aprire quelli già caricati (il link
// stava solo nella linguetta Cliente). E il visore apriva il collegamento
// firmato preso al caricamento della pagina, che scade dopo un'ora.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  documentoInBreve, AGGIUNGI_DOCUMENTO_BREVE, APRI_DOCUMENTO_BREVE, APRI_DOCUMENTI_BREVE, DOCUMENTO_CARICATO, DOCUMENTO_DA_CHIEDERE,
} from './schedaMaison.ts'
import { erroreApertura, VISORE_NON_SI_APRE } from './documentiCliente.ts'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const leggi = (p: string) => readFileSync(join(RADICE, p), 'utf8')

test('«Documento» in breve ha sempre un comando: aggiungere se manca, aprire se c’è', () => {
  assert.deepEqual(documentoInBreve(0), { testo: DOCUMENTO_DA_CHIEDERE, manca: true, comando: AGGIUNGI_DOCUMENTO_BREVE })
  assert.deepEqual(documentoInBreve(1), { testo: DOCUMENTO_CARICATO, manca: false, comando: APRI_DOCUMENTO_BREVE })
  assert.deepEqual(documentoInBreve(2), { testo: DOCUMENTO_CARICATO, manca: false, comando: APRI_DOCUMENTI_BREVE })
  // lettura non riuscita: nessuna riga, mai un «manca» finto
  assert.equal(documentoInBreve(null), null)
})

test('la linguetta Oggi della scheda porta ai documenti della cliente (non torna il vicolo cieco del 29/09)', () => {
  const pagina = leggi('app/scheda/[id]/page.tsx')
  const riga = pagina.slice(pagina.indexOf("chiave: 'documento', etichetta: 'Documento'"))
  assert.ok(riga.length > 0, 'la riga «Documento» in breve c’è ancora')
  assert.match(riga.slice(0, 400), /comando: hrefCliente \? \{ testo: documentoBreve\.comando, href: `\$\{hrefCliente\}#documenti` \}/)
  const oggi = leggi('components/scheda/OggiScheda.tsx')
  assert.match(oggi, /r\.comando && <span className="sotto"><Link href=\{r\.comando\.href\} data-comando-breve=\{r\.chiave\}/)
  // e la linguetta Cliente resta com'era: «Aggiungi» se nessuno, link se ci sono
  const cliente = leggi('components/scheda/ClienteScheda.tsx')
  assert.match(cliente, /data-aggiungi-documento/)
  assert.match(cliente, /data-documenti-caricati/)
})

test('aprire un documento chiede un collegamento NUOVO al tocco, e un errore si dice', () => {
  const comp = leggi('components/DocumentiCliente.tsx')
  // il tocco non dipende più dall'anteprima già pronta (prima: `anteprime[d.id] && setAperto(d)`)
  assert.doesNotMatch(comp, /anteprime\[d\.id\] && setAperto/)
  assert.match(comp, /onClick=\{\(\) => apri\(d\)\}/)
  const apri = comp.slice(comp.indexOf('async function apri('), comp.indexOf('async function cancella('))
  assert.match(apri, /createSignedUrl\(d\.percorso, 3600\)/)
  assert.match(apri, /setErrore\(erroreApertura\(error\)\)/)
  // il visore si apre solo con il collegamento appena ottenuto
  assert.match(comp, /setAperto\(\{ doc: d, url: u\.signedUrl \}\)/)
  // un'anteprima che non si carica fa comparire «Riprova», non un riquadro vuoto
  assert.match(comp, /onError=\{\(\) => \{ setAnteprime/)
  // nessun collegamento pubblico: solo collegamenti firmati
  assert.doesNotMatch(comp, /getPublicUrl/)
  const visore = leggi('components/VisoreDocumento.tsx')
  assert.match(visore, /onError=\{\(\) => setRotta\(true\)\}/)
  assert.match(visore, /\{VISORE_NON_SI_APRE\}/)
})

test('i messaggi d’errore dell’apertura sono comprensibili e non dicono «cancellato»', () => {
  const assente = erroreApertura({ message: 'Object not found' })
  assert.match(assente, /non risulta/)
  assert.doesNotMatch(assente, /cancellat|eliminat/i)
  assert.match(erroreApertura({ message: 'Failed to fetch' }), /connessione/)
  assert.match(erroreApertura(null), /riprova/)
  assert.match(VISORE_NON_SI_APRE, /non si apre/)
})

test('il documento resta della persona: si legge e si carica per guest_id della scheda cliente', () => {
  const comp = leggi('components/DocumentiCliente.tsx')
  assert.match(comp, /\.from\('documenti_cliente'\)\.select\('\*'\)\.eq\('guest_id', guestId\)/)
  assert.match(comp, /const riga = \{ id, guest_id: guestId, percorso,/)
  // il successo compare solo DOPO la riga salvata (insert … select().single() riuscito)
  const carica = comp.slice(comp.indexOf('async function carica('), comp.indexOf('async function apri('))
  assert.ok(carica.indexOf("insert(riga).select().single()") < carica.indexOf('setDocumenti(l => [...l, doc])'))
})
