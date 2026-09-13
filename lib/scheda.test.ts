// ============================================================================
// LA NUOVA SCHEDA PRENOTAZIONE — le prove del DISEGNO (13/09/2026).
// Qui si leggono i sorgenti: le misure e i colori decisi da Ania, i pezzi
// riusati invece di riscritti, e la struttura della pagina (testa, fascia,
// le cinque parti). La logica sta in lib/schedaPrenotazione.test.ts.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const pagina = leggi('app/scheda/[id]/page.tsx')
const testa = leggi('components/TestaCliente.tsx')
const fascia = leggi('components/FasciaSezioni.tsx')
const striscia = leggi('components/scheda/StrisciaNottiScheda.tsx')
const soggiorno = leggi('components/scheda/SoggiornoScheda.tsx')
const schedina = leggi('components/SchedinaControllo.tsx')
const documenti = leggi('components/DocumentiCliente.tsx')

// ── La pagina nasce a parte e non tocca la scheda vecchia ──────────────────
test('la scheda nuova sta a /scheda/<id> e la vecchia non viene toccata', () => {
  // l'indirizzo è il file stesso: app/scheda/[id]/page.tsx (se sparisce, leggi() fallisce)
  assert.ok(pagina.length > 0)
  // i fogli che ancora non ha portano alla scheda attuale, non la copiano
  assert.match(pagina, /const hrefVecchia = \(segmentoId: string\) => `\/prenotazioni\/\$\{segmentoId\}`/)
})

// ── 1. LA TESTA ────────────────────────────────────────────────────────────
test('la testa: 22 px ai lati e i pezzi già esistenti, non riscritti', () => {
  assert.match(pagina, /className="py-4 px-\[22px\]/, 'i margini laterali sono 22 px come nella proposta')
  for (const pezzo of ['TestaCliente', 'FasciaSezioni', 'SchedinaControllo', 'ParteCliente', 'RigaDocumentiPrenotazione']) {
    assert.ok(pagina.includes(`<${pezzo}`) || pagina.includes(`${pezzo} guestId`), `la scheda non usa ${pezzo}`)
  }
  // il conto NON si rifà: arriva da lib/prenotazioneUnica, come la scheda attuale
  assert.match(pagina, /contoPrenotazione\(righe, pagamenti/)
  assert.equal(/totaleCent = .*reduce/.test(pagina), false, 'la scheda si è ricalcolata il totale')
})

test('la riga di navigazione: «‹ Prenotazioni» verde 14 semibold e lo stato in ottone', () => {
  const riga = pagina.slice(pagina.indexOf('data-riga-navigazione'), pagina.indexOf('data-stato-scheda') + 400)
  assert.match(riga, /‹ Prenotazioni/)
  assert.match(riga, /fontSize: 14, fontWeight: 600, color: 'var\(--color-green-mid\)'/)
  assert.match(riga, /data-stato-scheda className="uppercase" style=\{\{ fontSize: 11, letterSpacing: '1\.5px', color: OTTONE \}\}/)
})

test('la prima riga: grigio #B9B6AD 12,5 px, e «da dove? ›» nello stesso grigio', () => {
  assert.match(testa, /const GRIGIO_RIGA = '#B9B6AD'/)
  const prima = testa.slice(testa.indexOf('{primaRiga ??') - 200, testa.indexOf('{primaRiga ??') + 600)
  assert.match(prima, /fontSize: 12\.5, color: GRIGIO_RIGA/)
  // il tasto che apre il foglio ha lo STESSO grigio e la stessa misura
  assert.match(prima, /data-chiedi-provenienza[^>]*style=\{\{ fontSize: 12\.5, color: GRIGIO_RIGA \}\}/)
  // la pagina lo mostra solo quando la provenienza manca davvero e c'è un cliente
  assert.match(pagina, /chiediProvenienza=\{primaRiga\.chiediProvenienza && booking\.guest_id \? \{ testo: 'da dove\? ›'/)
  // il totale dei soggiorni porta alla parte CLIENTE in fondo
  assert.match(pagina, /hrefCliente="#cliente"/)
})

test('il nome: Georgia 32, peso NORMALE anche con la ricevuta, e 🧾 ★ davanti', () => {
  assert.match(testa, /fontSize: 32, color: 'var\(--color-green-dark\)'[\s\S]*nomeNormale \? \{ fontWeight: 400 \}/)
  assert.match(pagina, /nomeNormale/, 'la scheda non chiede il nome in peso normale')
  // i quattro casi li decide la testa, che li ha già: ricevuta, stella, nome
  const titolo = testa.slice(testa.indexOf('<h1 className="text-center mt-4'), testa.indexOf('</h1>'))
  assert.ok(titolo.indexOf('data-ricevuta') < titolo.indexOf('data-stella'), 'prima la ricevuta, poi la stella')
  assert.ok(titolo.indexOf('data-stella') < titolo.indexOf('{nome}'))
  // e la scheda le passa tutt'e due, con le stesse funzioni della proposta
  assert.match(pagina, /stella=\{valutazioneDi\(guest\) === 'ottimo'\}/)
  assert.match(pagina, /ricevuta=\{vuoleRicevuta\(guest\)\}/)
})

test('le etichette sotto le date: «ARRIVA 15:10 · NAVETTA» e «PARTE»', () => {
  assert.match(pagina, /etichettaArrivo=\{etichettaArrivoScheda\(primoSegmento\?\.check_in_time, primoSegmento\?\.shuttle\)\}/)
  assert.match(pagina, /etichettaPartenza="parte"/)
  // la testa le scrive in maiuscolo 9 px, come faceva con «arrivo»/«partenza»
  assert.match(testa, /<Data iso=\{arrivo\} etichetta=\{etichettaArrivo\} \/>/)
  assert.match(testa, /fontSize: 9, letterSpacing: '1\.5px', textTransform: 'uppercase'/)
})

test('la riga grande: due colonne a 44 px, Georgia 24, «⇄ 2» a 15 px #5B6559', () => {
  const riga = pagina.slice(pagina.indexOf('function RigaGrande'), pagina.indexOf('export default function SchedaPage'))
  assert.match(riga, /style=\{\{ gap: 44 \}\}/)
  assert.match(riga, /fontFamily: GEORGIA, fontWeight: 400, fontSize: 24/)
  assert.match(riga, /data-cambi style=\{\{ fontSize: 15, color: VERDE_MESE \}\}> ⇄ \{cambi\}/)
  assert.match(pagina, /const VERDE_MESE = '#5B6559'/)
  assert.match(riga, />ospiti</)
  assert.match(riga, />camera</)
  // sta al posto delle due colonne della proposta: la testa la riceve intera
  assert.match(pagina, /rigaGrande=\{<RigaGrande/)
  assert.match(testa, /\{rigaGrande \?\? <>/)
})

test('lo stato del conto: Georgia 22 centrato, verde se pagato, #D40000 se manca', () => {
  assert.match(pagina, /const ROSSO_CONTO = '#D40000'/)
  const stato = pagina.slice(pagina.indexOf('data-stato-conto'), pagina.indexOf('data-stato-conto') + 400)
  assert.match(stato, /fontFamily: GEORGIA, fontSize: 22/)
  assert.match(stato, /className="text-center"/)
  assert.match(stato, /stato\.tipo === 'pagato' \? 'var\(--color-green-mid\)' : ROSSO_CONTO/)
})

test('telefono, «Scrivi» e la riga del documento', () => {
  // telefono e WhatsApp sono quelli della testa, 15 px semibold, come nella proposta
  assert.match(testa, /fontSize: 15, fontWeight: 600/)
  assert.match(pagina, /onScrivi=\{\(\) => waNumero && openWhatsApp\(waNumero, ''\)\}/)
  // la riga del documento: 14 px stone, «aggiungi» verde, oppure «caricato ›»
  const riga = documenti.slice(documenti.indexOf('if (scheda) {'), documenti.indexOf('if (scheda) {') + 800)
  assert.match(riga, /fontSize: 14, color: 'var\(--color-stone\)'/)
  assert.match(riga, /Nessun documento · <span style=\{\{ color: 'var\(--color-green-mid\)', fontWeight: 600 \}\}>aggiungi/)
  assert.match(riga, /documento caricato/)
  // il conteggio è già letto dalla pagina: non si interroga il database due volte
  assert.match(pagina, /conteggio=\{documenti\} scheda/)
})

test('le note: filo tratteggiato #D8D2C4, rosso #C00000 a 14,5 semibold, «QUESTA VOLTA»', () => {
  assert.match(testa, /const FILO_NOTA_SCHEDA = '#D8D2C4'/)
  assert.match(testa, /borderTop: `1px dashed \$\{noteScheda \? FILO_NOTA_SCHEDA : FILO_NOTA\}`/)
  assert.match(testa, /const ROSSO_NOTA = '#C00000'/)
  assert.match(testa, /fontSize: noteScheda \? 14\.5 : 13\.5, fontWeight: 600, color: ROSSO_NOTA/)
  // la parolina c'è solo sulla nota della prenotazione (la prima non ce l'ha)
  assert.match(testa, /\{\(n\.etichetta \|\| !noteScheda\) && <p style=\{\{ fontSize: noteScheda \? 10 : 9\.5/)
  // senza note niente filo e niente spazio: lo decide la testa, che non disegna nulla
  assert.match(testa, /\{notePulite\.length > 0 && \(/)
  assert.match(pagina, /note=\{note\}/)
  assert.match(pagina, /noteScheda/)
})

// ── 2. LA FASCIA ───────────────────────────────────────────────────────────
test('la fascia: le cinque voci, ferma in cima sotto la barra, 0,6 px di spaziatura', () => {
  assert.match(pagina, /<FasciaSezioni voci=\{SEZIONI_SCHEDA\} className="mt-\[22px\]" top="top-12 lg:top-0" spaziatura=\{0\.6\} \/>/)
  // è la stessa fascia della proposta: filo ottone sopra e sotto, fondo crema
  assert.match(fascia, /borderTop: `1px solid \$\{FILO\}`, borderBottom: `1px solid \$\{FILO\}`/)
  assert.match(fascia, /background: 'var\(--color-cream\)'/)
  assert.match(fascia, /const FILO = 'rgba\(169,136,78,0\.55\)'/)
  assert.match(fascia, /const MISURA_PIENA = 10/)
  assert.match(fascia, /fontWeight: accesa \? 700 : 500, color: accesa \? OTTONE/)
  assert.match(fascia, /sticky \$\{top\}/)
  // toccando una voce si scende SOTTO la fascia, non sotto la barra dell'app
  assert.match(fascia, /const fermaA = barraRef\.current \? parseFloat\(getComputedStyle\(barraRef\.current\)\.top\) \|\| 0 : 0/)
  // e sotto la fascia ci sono 34 px prima della prima parte
  assert.match(pagina, /id="controllare" className="pt-\[34px\]/)
})

// ── 3. DA CONTROLLARE ──────────────────────────────────────────────────────
test('«Da controllare»: titoletto ed-sezione col numero, schedine grandi, «✓ Tutto a posto»', () => {
  const parte = pagina.slice(pagina.indexOf('id="controllare"'), pagina.indexOf('id="soggiorno"'))
  assert.match(parte, /<p className="ed-sezione">Da controllare \{controlli\.length > 0 && <small>\{controlli\.length\}<\/small>\}<\/p>/)
  assert.match(parte, /data-tutto-a-posto[^>]*fontSize: 14, color: 'var\(--color-green-mid\)'/)
  assert.match(parte, /\{TUTTO_A_POSTO\}/)
  assert.match(parte, /<SchedinaControllo key=\{v\.chiave\}[\s\S]*grande \/>/)
  // la schedina è quella della proposta: bianca, bordo card-border, angoli 12, barretta ottone
  assert.match(schedina, /border: '1px solid var\(--color-card-border\)', borderRadius: 12/)
  assert.match(schedina, /width: 2, background: OTTONE/)
  assert.match(schedina, /fontSize: 10, letterSpacing: '1\.5px', textTransform: 'uppercase', color: OTTONE/)
  // «grande»: titolo 15 e dettaglio 13, le misure chieste per la scheda
  assert.match(schedina, /fontSize: grande \? 15 : 14\.5, fontWeight: 600/)
  assert.match(schedina, /fontSize: grande \? 13 : 12\.5, color: 'var\(--color-stone\)'/)
})

test('le cose da controllare sono le regole della Home, filtrate su questa prenotazione', () => {
  const logica = leggi('lib/schedaPrenotazione.ts')
  assert.match(logica, /import \{ eccezioniPagamenti, eccezioniArrivi, eccezioniCalendario, hrefDestinazione, ETICHETTA_TIPO/)
  assert.match(logica, /from '\.\/daControllare\.ts'/)
  // nessuna regola riscritta: le voci in più sono solo quelle che si vedono da qui
  assert.match(logica, /etichetta: 'Cambio camera'/)
  assert.match(logica, /etichetta: 'Documento'/)
})

// ── 4. SOGGIORNO ───────────────────────────────────────────────────────────
test('la striscia delle notti: riquadro bianco, «7 NOTTI» in ottone, caselle uguali', () => {
  assert.match(striscia, /className=\{`ed-riquadro overflow-hidden/)
  assert.match(striscia, /le notti, tocca per modificare/)
  assert.match(striscia, /fontSize: 12, color: 'var\(--color-stone\)'/)
  assert.match(striscia, /fontSize: 10, letterSpacing: '1\.5px', color: OTTONE \}\}>\{testoNotti\(caselle\.length\)\}/)
  // una casella per notte, larghezza uguale (flex-1) e filo fra una e l'altra
  assert.match(striscia, /className="flex-1 min-w-0 text-center/)
  assert.match(striscia, /borderLeft: i > 0 \? '1px solid var\(--color-card-border\)' : undefined/)
  // giorno 11 px («Oggi» verde grassetto), ⇄ ottone, numero Georgia 20 sottolineato oggi
  assert.match(striscia, /fontSize: 11, lineHeight: '14px', fontWeight: c\.oggi \? 700 : 400, color: c\.oggi \? 'var\(--color-green-mid\)'/)
  assert.match(striscia, /\{c\.cambia \? '⇄' : ''\}/)
  assert.match(striscia, /fontFamily: GEORGIA, fontSize: 20[\s\S]*textDecoration: c\.oggi \? 'underline' : undefined/)
  assert.match(striscia, /fontSize: 11, lineHeight: '14px', marginTop: 2, color: 'var\(--color-green-dark\)' \}\}>\{c\.camera\}/)
  // un pallino stone per ospite
  assert.match(striscia, /Array\.from\(\{ length: c\.persone \}\)/)
  assert.match(striscia, /borderRadius: 999, background: 'var\(--color-stone\)'/)
  // e toccare una notte apre il foglio del suo tratto
  assert.match(pagina, /<StrisciaNottiScheda caselle=\{nottiTotali\} hrefNotte=\{c => hrefVecchia\(c\.segmentoId\)\}/)
})

test('la riga «Arrivo»: stone 14 a sinistra, orario in pastiglia sage, «da chiedere» in ottone', () => {
  assert.match(soggiorno, /data-riga-arrivo[^>]*flex items-center justify-between/)
  assert.match(soggiorno, /fontSize: 14, color: 'var\(--color-stone\)' \}\}>Arrivo/)
  assert.match(soggiorno, /background: 'var\(--color-sage\)', borderRadius: 999/)
  assert.match(soggiorno, /data-da-chiedere style=\{\{ color: OTTONE \}\}>\{DA_CHIEDERE\}/)
  assert.match(soggiorno, /export const DA_CHIEDERE = 'da chiedere'/)
  // niente virgole: i pezzi sono separati dallo spazio del gap
  assert.equal(/quando\},/.test(soggiorno), false)
})

test('i tratti di camera: nome Georgia 20, prezzo stone 15, «⇄ CAMBIO» #EFE2C7/#7A5C1E', () => {
  assert.match(soggiorno, /export const FONDO_CAMBIO = '#EFE2C7'/)
  assert.match(soggiorno, /export const TESTO_CAMBIO = '#7A5C1E'/)
  assert.match(soggiorno, /background: FONDO_CAMBIO, color: TESTO_CAMBIO, fontSize: 10, letterSpacing: '1px', borderRadius: 4/)
  assert.match(soggiorno, /⇄ cambio/)
  assert.match(soggiorno, /fontFamily: GEORGIA, fontSize: 20[\s\S]*\{t\.camera\}/)
  assert.match(soggiorno, /fontSize: 15, color: 'var\(--color-stone\)'[\s\S]*\{t\.prezzo\}/)
  assert.match(soggiorno, /fontSize: 13, color: 'var\(--color-stone\)' \}\}>\{t\.dettaglio\}/)
  assert.match(soggiorno, /borderTop: i > 0 \? '1px solid var\(--color-card-border\)' : undefined/)
})

test('i tre link in fondo al soggiorno: i primi due verdi semibold, il terzo stone', () => {
  assert.match(soggiorno, /const verde = \{ fontSize: 14, fontWeight: 600, color: 'var\(--color-green-mid\)' \}/)
  assert.match(soggiorno, />Modifica arrivo</)
  assert.match(soggiorno, />Modifica soggiorno</)
  assert.match(soggiorno, /fontSize: 14, color: 'var\(--color-stone\)' \}\}>\s*\{arriviAperti \? 'Chiudi arrivi precedenti' : 'Arrivi precedenti'\}/)
  // «Modifica arrivo» apre il foglio qui; «Modifica soggiorno» porta al foglio attuale
  assert.match(pagina, /onArrivo=\{\(\) => setFoglioArrivo\(true\)\}/)
  assert.match(pagina, /hrefSoggiorno=\{hrefVecchia\(primoSegmento\?\.id \?\? booking\.id\)\}/)
})

test('i fogli usano i salvataggi già in casa, non ne scrivono di nuovi', () => {
  const arrivo = leggi('components/scheda/FoglioArrivo.tsx')
  assert.match(arrivo, /import \{ salvaOrarioENavetta \} from '@\/lib\/arrivoOrario'/)
  assert.match(arrivo, /import \{ oraDigitata, oraCompleta \} from '@\/lib\/ora'/)
  const prov = leggi('components/scheda/FoglioProvenienza.tsx')
  assert.match(prov, /import \{ leggiStrutture, ricordaStruttura, salvaProvenienzaCliente \} from '@\/lib\/provenienzaDati'/)
  assert.match(prov, /import CampoProvenienza/, 'il foglio si è riscritto i quattro tasti')
  // la provenienza si salva sul CLIENTE, non sulla prenotazione
  assert.match(prov, /salvaProvenienzaCliente\(guestId, campi\)/)
})

// ── Le cinque parti ci sono tutte, nell'ordine della fascia ─────────────────
test('le cinque parti stanno nella pagina nell’ordine della fascia', () => {
  const posizioni = ['controllare', 'soggiorno', 'conto', 'messaggi', 'cliente'].map(id => pagina.indexOf(`id="${id}"`))
  assert.ok(posizioni.every(p => p > 0), 'manca una delle cinque parti')
  assert.deepEqual([...posizioni].sort((a, b) => a - b), posizioni, 'le parti non sono nell’ordine della fascia')
  // CONTO e MESSAGGI arrivano con la parte 2: intanto portano alla scheda attuale
  const conto = pagina.slice(posizioni[2], posizioni[3])
  assert.match(conto, /scheda attuale/)
})
