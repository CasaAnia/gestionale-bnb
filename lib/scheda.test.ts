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
const striscia = leggi('components/StrisciaNottiCamere.tsx')
const soggiorno = leggi('components/scheda/SoggiornoScheda.tsx')
const schedina = leggi('components/SchedinaControllo.tsx')
const documenti = leggi('components/DocumentiCliente.tsx')

// ── La pagina nasce a parte e non tocca la scheda vecchia ──────────────────
test('la scheda nuova sta a /scheda/<id> e la vecchia non viene toccata', () => {
  // l'indirizzo è il file stesso: app/scheda/[id]/page.tsx (se sparisce, leggi() fallisce)
  assert.ok(pagina.length > 0)
  // dal 17/09/2026 nessun rimando alla scheda vecchia: né «Vedi tutto» né «Altre modifiche»
  assert.equal(/hrefVecchia|\/prenotazioni\/\$\{/.test(pagina), false, 'la scheda nuova rimanda ancora alla vecchia')
})

// ── 1. LA TESTA ────────────────────────────────────────────────────────────
test('la testa: 22 px ai lati e i pezzi già esistenti, non riscritti', () => {
  assert.match(pagina, /className="py-4 px-\[22px\]/, 'i margini laterali sono 22 px come nella proposta')
  for (const pezzo of ['TestaCliente', 'FasciaSezioni', 'SchedinaControllo', 'ConfermaWhatsApp', 'RigaDocumentiPrenotazione']) {
    assert.ok(pagina.includes(`<${pezzo}`) || pagina.includes(`${pezzo} guestId`), `la scheda non usa ${pezzo}`)
  }
  // l'interruttore dei messaggi è quello del calendario, dentro MessaggiScheda
  assert.match(leggi('components/scheda/MessaggiScheda.tsx'), /import InterruttorePillola from '@\/components\/InterruttorePillola'/)
  // il conto NON si rifà: arriva da lib/prenotazioneUnica, come la scheda attuale
  assert.match(pagina, /contoPrenotazione\(righe, pagamenti/)
  assert.equal(/totaleCent = .*reduce/.test(pagina), false, 'la scheda si è ricalcolata il totale')
})

test('niente «‹ Prenotazioni» e niente «Confermata» sotto la freccia: lo stato compare solo se dice qualcosa (Ania, 17/09/2026)', () => {
  assert.equal(/‹ Prenotazioni|‹ Cliente/.test(pagina), false, 'il link «‹ Prenotazioni» è ancora nella scheda')
  assert.match(pagina, /const statoDaMostrare = statoTesto === 'Confermata' \? null : statoTesto/)
  assert.match(pagina, /\{statoDaMostrare && \([\s\S]{0,120}data-riga-navigazione className="flex items-center justify-end gap-3"/)
  assert.match(pagina, /data-stato-scheda className="uppercase" style=\{\{ fontSize: 11, letterSpacing: '1\.5px', color: OTTONE \}\}>\{statoDaMostrare\}/)
  // la freccia in cima riporta indietro (alle prenotazioni o alla cliente)
  assert.match(pagina, /<BackBar href=\{hrefIndietro\} \/>/)
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

test('le note: filo tratteggiato #D8D2C4, rosso #D40000 (come «da incassare») a 14,5 in grassetto vero, «QUESTA VOLTA»', () => {
  assert.match(testa, /const FILO_NOTA_SCHEDA = '#D8D2C4'/)
  assert.match(testa, /borderTop: `1px dashed \$\{noteScheda \? FILO_NOTA_SCHEDA : FILO_NOTA\}`/)
  assert.match(testa, /const ROSSO_NOTA = '#D40000'/)
  assert.match(testa, /fontSize: noteScheda \? 14\.5 : 13\.5, fontWeight: 700, color: ROSSO_NOTA/)
  assert.match(leggi('components/scheda/ClienteScheda.tsx'), /const ROSSO_NOTA = '#D40000'/)
  assert.match(leggi('components/scheda/ClienteScheda.tsx'), /fontWeight: v\.etichetta === 'nota del cliente' \? 700 : 600/)
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
test('la striscia delle notti è quella nuova, e da lì si cambia la camera', () => {
  // la striscia è il componente riusabile, alimentato dalle notti salvate
  assert.match(pagina, /import StrisciaNottiCamere from '@\/components\/StrisciaNottiCamere'/)
  // una striscia per linea (lib/lineeSoggiorno, 17/09/2026): il cambio camera in
  // fila è una linea, le camere in parallelo sono linee diverse
  assert.match(pagina, /const linee = useMemo\(\(\) => lineeDelSoggiorno\(attive\), \[attive\]\)/)
  assert.match(pagina, /\{linee\.map\(\(l, i\) => \([\s\S]{0,600}<StrisciaNottiCamere notti=\{l\.notti\} oggi=\{oggi\}/)
  // toccando una notte si apre il foglietto QUI, non più il foglio della scheda vecchia
  assert.match(pagina, /setNotteAperta\(\{ linea: l\.chiave, iso: n\.iso \}\)/)
  assert.match(pagina, /<FoglioNotte notti=\{lineaAperta\.notti\} iso=\{notteAperta\.iso\} contesto=\{contestoAperto\}/)
  assert.equal(/hrefNotte/.test(pagina), false, 'il tocco su una notte porta ancora alla scheda vecchia')
  // e la striscia è sola presentazione: le regole stanno nella libreria
  assert.match(striscia, /from '@\/lib\/strisciaNotti'/)
})

test('con due camere nelle stesse notti ci sono due strisce, ognuna col suo titolo, e si cambiano da qui (17/09/2026)', () => {
  // la striscia si ferma SOLO se le camere non si leggono; niente rimandi alla scheda vecchia
  assert.match(pagina, /const nonSiSposta = camere\.length === 0\n/)
  assert.match(pagina, /onNotte=\{nonSiSposta \? undefined : n => setNotteAperta\(\{ linea: l\.chiave, iso: n\.iso \}\)\}/)
  assert.equal(/scheda completa/.test(pagina), false, 'la scheda nuova rimanda ancora alla scheda completa per le notti')
  assert.match(pagina, /\{linee\.length > 1 && \([\s\S]{0,80}<p data-linea-titolo[^>]*>\{l\.titolo\}<\/p>/)
  assert.match(pagina, /data-linee-parallele[^>]*>\{SPIEGAZIONE_PARALLELE\}/)
  assert.match(pagina, /\{CAMERE_NON_LETTE\}/)
  // il foglietto dice quale camera e quali notti si toccano, e l'effetto sul conto prima di «Fatto»
  assert.match(pagina, /sottotitolo=\{linee\.length > 1 \? lineaAperta\.titolo : undefined\}/)
  assert.match(pagina, /contoDopo=\{\(bozza, daQui\) => contoDellaBozza\(lineaAperta, conDaQui\(bozza, daQui\)\)\}/)
  assert.match(pagina, /const piano = pianoNotti\(bozza, linea\.segmenti, ctx\)/)
  const foglioNotte = leggi('components/FoglioNotte.tsx')
  assert.match(foglioNotte, /data-sottotitolo-notte/)
  assert.match(foglioNotte, /data-conto-dopo[^>]*>\{conto\.testo\}/)
  // nel contesto di una linea le altre linee sono altre prenotazioni (camera presa, letti contati)
  assert.match(pagina, /const contestoAperto = lineaAperta \? contestoLinea\(lineaAperta, linee, contesto\) : contesto/)
})

test('dal foglietto si cambiano anche gli ospiti: Allegra 2→3 accende il letto, 3→2 lo spegne se automatico, a mano resta', () => {
  assert.match(pagina, /ospitiPossibili=\{cameraId => \{[\s\S]{0,200}ospitiPossibiliNotte\(camera, capienzaCamera\(camera\)\)/)
  assert.match(pagina, /onFatto=\{\(nuove, daQui\) => salvaNotti\(lineaAperta, conDaQui\(nuove, daQui\)\)\}/)
  assert.match(pagina, /ospitiDaQuiInPoi\(bozza, notteAperta\.iso, contestoAperto\)/)
  const foglioNotte = leggi('components/FoglioNotte.tsx')
  assert.match(foglioNotte, /cambiaOspitiConLettoAuto\(bozza, iso, quanti, contesto, lettoAuto\)/)
  assert.match(foglioNotte, /setLettoAuto\(false\); setBozza\(b => cambiaLetto\(b, iso, true, contesto, \{ ospitiAParte \}\)\)/)
  // le persone contano per «è cambiato qualcosa?»
  assert.match(leggi('lib/strisciaNotti.ts'), /&& n\.persone === b\[i\]\.persone\)/)
})

test('«Modifica soggiorno» non c’è più: restano «Modifica arrivo» e «Arrivi precedenti»', () => {
  const senzaNote = (t: string) => t.split('\n').filter(r => !r.trim().startsWith('//')).join('\n')
  assert.equal(/Modifica soggiorno/.test(senzaNote(soggiorno)), false, '«Modifica soggiorno» è ancora nei comandi')
  assert.equal(/Modifica soggiorno/.test(senzaNote(pagina)), false)
  assert.equal(/hrefSoggiorno/.test(pagina), false)
  assert.match(soggiorno, />Modifica arrivo</)
  assert.match(soggiorno, /\{arriviAperti \? 'Chiudi arrivi precedenti' : 'Arrivi precedenti'\}/)
  // i tratti di camera sotto la striscia restano come sono
  assert.match(pagina, /<TrattiCameraScheda tratti=\{tratti\}/)
})

test('il salvataggio delle notti: si annulla, non si cancella, e il conto si rifà da solo', () => {
  // il piano si fa sui tratti della linea soltanto: le altre linee non si toccano
  assert.match(pagina, /const piano = pianoNotti\(nuove, linea\.segmenti, contestoLinea\(linea, linee, contesto\)\)/)
  assert.match(pagina, /const gruppo = linea\.segmenti\[0\]\?\.group_id \|\| crypto\.randomUUID\(\)/)
  // l'annullamento lo fa la funzione della 0053, e annulla: non cancella
  const sql = readFileSync(new URL('../supabase/proposte/0053_notti_in_un_colpo.BOZZA.sql', import.meta.url), 'utf8')
  assert.match(sql, /set status = 'annullata', cancelled_at = adesso/)
  assert.equal(/delete from public\.bookings/.test(sql), false, 'una riga viene cancellata invece che annullata')
  assert.equal(/from\('bookings'\)\.delete\(\)/.test(pagina), false)
  // niente da salvare se non è cambiato niente (Annulla non tocca il database)
  assert.match(pagina, /if \(!booking \|\| salvandoNotti \|\| stessaStriscia\(linea\.notti, nuove\)\) return/)
  // dopo il salvataggio la scheda si rilegge: conto, tratti e «Da controllare» insieme
  assert.match(pagina, /setVersione\(v => v \+ 1\)/)
  assert.match(pagina, /\}, \[id, versione\]\)/)
  // le tre cose vanno insieme: una transazione sola, non tre richieste
  assert.match(pagina, /const esito = await salvaNottiInUnColpo\(piano, gruppo, comuni, arrivoDi,/)
  assert.match(pagina, /supabase\.rpc\('sposta_notti', dati\)/)
  assert.equal(/salvaInSequenza/.test(pagina), false, 'le notti si salvano ancora a pezzi')
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

test('i due comandi in fondo al soggiorno: «Modifica arrivo» verde e «Arrivi precedenti»', () => {
  assert.match(soggiorno, /const verde = \{ fontSize: 14, fontWeight: 600, color: 'var\(--color-green-mid\)' \}/)
  assert.match(soggiorno, />Modifica arrivo</)
  assert.match(soggiorno, /fontSize: 14, color: 'var\(--color-stone\)' \}\}>\s*\{arriviAperti \? 'Chiudi arrivi precedenti' : 'Arrivi precedenti'\}/)
  // «Modifica arrivo» apre il foglio qui dentro
  assert.match(pagina, /onArrivo=\{\(\) => setFoglioArrivo\(true\)\}/)
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
  // CONTO e MESSAGGI adesso ci sono davvero (parte 2, 13/09/2026)
  const conto = pagina.slice(posizioni[2], posizioni[3])
  assert.match(conto, /<ContoScheda/)
  assert.match(pagina.slice(posizioni[3], posizioni[4]), /<MessaggiScheda/)
  // e la CRONOLOGIA sta in fondo, dopo la parte CLIENTE, fuori dalla fascia
  assert.ok(pagina.indexOf('<CronologiaScheda') > posizioni[4], 'la cronologia non sta in fondo')
})

// ══ PARTE 2 (13/09/2026): CONTO · MESSAGGI · CLIENTE · CRONOLOGIA ══════════
const conto = leggi('components/scheda/ContoScheda.tsx')
const messaggi = leggi('components/scheda/MessaggiScheda.tsx')
const cliente = leggi('components/scheda/ClienteScheda.tsx')
const cronologia = leggi('components/scheda/CronologiaScheda.tsx')

test('il conto: stato in Georgia 32, dettaglio 12,5 stone, barretta 4 px', () => {
  assert.match(conto, /fontFamily: GEORGIA, fontSize: 32, color: testa\.saldato \? 'var\(--color-green-dark\)' : ROSSO_CONTO/)
  assert.match(conto, /export const ROSSO_CONTO = '#D40000'/)
  assert.match(conto, /fontSize: 12\.5, color: 'var\(--color-stone\)'/)
  assert.match(conto, /export const FONDO_BARRA = '#EFE9DC'/)
  assert.match(conto, /export const ALTEZZA_BARRA = 4/)
  assert.match(conto, /background: 'var\(--color-green-mid\)', opacity: 0\.55/)
  assert.match(conto, /width: `\$\{Math\.round\(testa\.quotaPagata \* 100\)\}%`/)
})

test('il conto: righe 14 px col filo, sconto in ottone, totale in Georgia 24', () => {
  assert.match(conto, /borderTop: i > 0 \? '1px solid var\(--color-card-border\)' : undefined/)
  assert.match(conto, /color: r\.sconto \? OTTONE : 'var\(--color-green-dark\)'/)
  const totale = conto.slice(conto.indexOf('data-totale-conto'), conto.indexOf('data-come-paga-riga'))
  assert.match(totale, /borderTop: `1px solid \$\{FILO_OTTONE\}`/)
  assert.match(totale, /fontSize: 14, fontWeight: 600[\s\S]*>Totale</)
  assert.match(totale, /fontFamily: GEORGIA, fontSize: 24/)
  // «Come paga» e pagamenti, poi i due comandi
  assert.match(conto, /data-come-paga-riga[\s\S]*\{TITOLO_COME_PAGA\}/)
  assert.match(conto, /\{accordo\.nome\}/)
  assert.match(conto, /fontSize: 12\.5, color: 'var\(--color-stone\)' \}\}>\{accordo\.frase\}/)
  assert.match(conto, /data-pagamento/)
  assert.match(conto, />Aggiungi pagamento</)
  assert.match(conto, />Cambia come paga</)
  assert.equal(/>Accordo</.test(conto), false, '«Accordo» è ancora scritto nel conto')
  // «Aggiungi pagamento» apre il foglio QUI (16/09/2026), non la scheda attuale
  assert.match(pagina, /onPagamento=\{\(\) => setFoglioPagamento\(true\)\}/)
  assert.equal(/azione=pagato`/.test(pagina), false, 'il pagamento porta ancora alla scheda vecchia')
})

test('i messaggi: interruttore condiviso, tasto pieno stretto, otto pastiglie sage', () => {
  assert.match(messaggi, /import InterruttorePillola from '@\/components\/InterruttorePillola'/)
  assert.match(messaggi, /\['ania', 'WhatsApp Ania'\], \['business', 'Business'\]/)
  // il tasto pieno: verde, bianco, 14 px, alto 42, largo quanto la scritta
  const pieno = messaggi.slice(messaggi.indexOf('data-conferma-immagine'), messaggi.indexOf('Gli altri messaggi'))
  assert.match(pieno, /inline-flex/)
  assert.match(pieno, /background: 'var\(--color-green-mid\)', color: '#fff', fontSize: 14, fontWeight: 600, borderRadius: 999, minHeight: 42/)
  assert.equal(/w-full/.test(pieno), false, 'il tasto della conferma non deve essere largo quanto la riga')
  // gli otto: due colonne, 8 px, fondo sage, 13 px semibold, alti 38
  assert.match(messaggi, /grid grid-cols-2 mt-3" style=\{\{ gap: 8 \}\}/)
  assert.match(messaggi, /export const FONDO_TASTO = 'var\(--color-sage\)'/)
  assert.match(messaggi, /fontSize: 13,\s*fontWeight: 600,\s*borderRadius: 999,\s*minHeight: 38,/)
  // l'annullamento: solo contorno, in fondo e centrato
  assert.match(messaggi, /export const BORDO_ANNULLAMENTO = '#D9B3AC'/)
  assert.match(messaggi, /export const TESTO_ANNULLAMENTO = '#8C3B2E'/)
  assert.ok(messaggi.indexOf('data-messaggio="annullamento"') > messaggi.indexOf('MESSAGGI_SCHEDA.map'))
})

test('i messaggi usano i testi di sempre, non ne scrivono di nuovi', () => {
  assert.match(pagina, /import buildWhatsappMsg, \{ perMessaggio, type TipoMessaggio \} from '@\/lib\/messaggiPrenotazione'/)
  // la spunta «bonifico» vale «anticipo» solo se l'accordo lo dice (16/09/2026)
  assert.match(pagina, /buildWhatsappMsg\(perIMessaggi\(\), tipo, attive, pagamenti\)/)
  // l'apertura di WhatsApp è quella condivisa, col WhatsApp scelto
  assert.match(pagina, /openWhatsApp\(waNumero, testoMessaggio\(tipo\), business\)/)
  // nessun testo scritto dentro il componente
  assert.equal(/Gentile /.test(messaggi), false, 'il componente dei messaggi si è scritto un testo suo')
})

test('il cliente: griglia a due colonne, «da dove? ›», soggiorni e «con lei»', () => {
  assert.match(cliente, /grid grid-cols-2/)
  assert.match(cliente, /fontSize: 9, letterSpacing: '1\.5px', color: OTTONE/)
  assert.match(cliente, /fontSize: 14\.5, fontWeight: 600/)
  assert.match(cliente, /data-chiedi-provenienza-cliente/)
  assert.match(cliente, />Modifica dati</)
  assert.match(cliente, />Cambia cliente</)
  // i soggiorni: camera in Georgia 20, dati 13 stone, importo con la freccia
  assert.match(cliente, /Soggiorni precedenti \{soggiorni\.length > 0 && <small>\{soggiorni\.length\} · \{euroTondi\(totaleCent\)\}<\/small>\}/)
  assert.match(cliente, /fontFamily: GEORGIA, fontSize: 20/)
  assert.match(cliente, /fontSize: 13, color: 'var\(--color-stone\)' \}\}>\s*\{periodoCompatto/)
  assert.match(cliente, /\{euroTondi\(s\.totaleCent\)\} ›/)
  assert.match(cliente, /data-anno[\s\S]*fontSize: 11, color: OTTONE/)
  // ogni riga apre QUELLA prenotazione, nella scheda nuova
  assert.match(cliente, /href=\{`\/scheda\/\$\{s\.prenotazioneId\}`\}/)
  // «con lei» compare solo se c'è qualcuno
  assert.match(cliente, /\{conLei\.length > 0 && \(/)
  assert.match(cliente, /data-con-lei/)
})

test('la cronologia: quando a sinistra, cosa a destra, i messaggi col fumetto', () => {
  assert.match(cronologia, /fontSize: 12\.5, color: 'var\(--color-stone\)' \}\}>\{r\.quando\}/)
  assert.match(cronologia, /fontSize: 14, color: r\.messaggio \? 'var\(--color-green-mid\)' : 'var\(--color-green-dark\)'/)
  assert.match(cronologia, /\{r\.messaggio && <MessageCircle/)
  assert.match(cronologia, /\{NOTA_CRONOLOGIA\}/)
  // la nota sotto, 12,5 px stone
  assert.match(cronologia, /mt-2 leading-snug" style=\{\{ fontSize: 12\.5, color: 'var\(--color-stone\)' \}\}>\{NOTA_CRONOLOGIA\}/)
  // le righe vanno dalla più vecchia: lo decide lib/schedaConto
  assert.match(leggi('lib/schedaConto.ts'), /\.sort\(\(a, b\) => a\.ordine\.localeCompare\(b\.ordine\) \|\| a\.n - b\.n\)/)
})

test('i comandi in fondo (17/09/2026): «Nota e colore», «Aggiungi camera», poi l’annullamento in rosso', () => {
  const fondo = pagina.slice(pagina.indexOf('data-comandi-fondo'), pagina.indexOf('data-comandi-fondo') + 1600)
  assert.match(fondo, /data-nota-colore onClick=\{\(\) => setFoglioNota\(true\)\}[^>]*>\{COMANDO_NOTA\}/)
  assert.match(fondo, /data-aggiungi-camera onClick=\{aggiungiCamera\}/)
  assert.match(fondo, /color: '#8C3B2E' \}\}>Annulla prenotazione</)
  assert.equal(/Vedi tutto|Altre modifiche/.test(fondo), false, 'in fondo ci sono ancora i rimandi alla scheda vecchia')
  assert.ok(fondo.indexOf('COMANDO_NOTA') < fondo.indexOf('COMANDO_AGGIUNGI_CAMERA'))
  assert.ok(fondo.indexOf('COMANDO_AGGIUNGI_CAMERA') < fondo.indexOf('Annulla prenotazione'))
})

test('quanto ha già speso la cliente, in cima: nello stesso rosso acceso di «da incassare» (Ania, 17/09/2026)', () => {
  const testa = leggi('components/TestaCliente.tsx')
  assert.match(testa, /const ROSSO_SPESO = '#D40000'/)
  assert.equal((testa.match(/data-totale-cliente[^\n]*color: ROSSO_SPESO/g) ?? []).length, 2)
  assert.match(leggi('components/scheda/ContoScheda.tsx'), /export const ROSSO_CONTO = '#D40000'/)
})

test('la striscia della scheda mostra le persone sotto ogni notte, e il letto acceso si vede (verde pieno)', () => {
  assert.match(pagina, /<StrisciaNottiCamere notti=\{l\.notti\} oggi=\{oggi\} spiegazione=\{false\}\n\s+ospitiAttesi=\{Math\.max\(1, \.\.\.l\.segmenti\.map\(s => Number\(s\.num_guests\) \|\| 1\)\)\}/)
  assert.match(striscia, /background: n\.letto \? 'var\(--color-green-mid\)' : '#fff'/)
  assert.match(striscia, /color: n\.letto \? 'var\(--color-cream\)' : '#C4C0B6'/)
})

test('dopo il salvataggio delle notti compare il pop-up grande, e «Cambia date» non anticipa più il conto (Ania, 17/09/2026)', () => {
  assert.match(pagina, /const esitoConferma = confermaNotti\(\{[\s\S]{0,400}concordato: conPrezzoConcordato\(linea\.segmenti\),/)
  assert.match(pagina, /setConferma\(c => \(\{ n: \(c\?\.n \?\? 0\) \+ 1, righe: esitoConferma\.righe, durata: esitoConferma\.durata \}\)\)/)
  assert.match(pagina, /if \(esitoConferma\.avviso\) setAvviso\(esitoConferma\.avviso\)/)
  assert.match(pagina, /<ConfermaVolante key=\{conferma\.n\} righe=\{conferma\.righe\} durata=\{conferma\.durata\} conOk=\{conferma\.conOk\}/)
  // il pop-up delle notti resta finché non si tocca «Ok, ho capito» (Ania, 17/09/2026)
  assert.match(pagina, /durata: esitoConferma\.durata, conOk: true \}\)\)/)
  const volante = leggi('components/ConfermaVolante.tsx')
  assert.match(volante, /export const TESTO_OK = 'Ok, ho capito'/)
  assert.match(volante, /if \(conOk\) return   \/\/ resta finché non si tocca/)
  assert.match(volante, /data-conferma-ok[\s\S]{0,200}\{TESTO_OK\}/)
  // dopo un pagamento resta come prima: se ne va da sola
  assert.doesNotMatch(pagina, /confermaPagamento\([^\n]*conOk/)
  const date = leggi('components/scheda/FoglioDate.tsx')
  assert.match(date, /\{conto && conto\.guaio && <p data-conto-dopo/)
})

test('le altre prenotazioni si leggono anche un mese intorno al soggiorno: «Cambia date» sa se la camera è libera fuori dalle notti di adesso', () => {
  assert.match(pagina, /const GIORNI_INTORNO = 31/)
  assert.match(pagina, /\.lt\('check_in', spostaGiorni\(partenza, GIORNI_INTORNO\)\)\.gt\('check_out', spostaGiorni\(arrivo, -GIORNI_INTORNO\)\)/)
})
