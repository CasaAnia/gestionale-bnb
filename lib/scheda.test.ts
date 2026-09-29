// ============================================================================
// LA SCHEDA PRENOTAZIONE — le prove del DISEGNO.
// Dal 28/09/2026 la scheda è quella «Maison» a linguette del riferimento
// approvato da Ania (docs/design/scheda-riferimento.html): barra, testata T2
// con le note N1, cinque linguette e UNA parte alla volta. Qui si leggono i
// sorgenti: i pezzi riusati invece di riscritti, le regole fisse, la struttura
// della pagina. La logica nuova sta in lib/schedaMaison.test.ts, quella di
// sempre in lib/schedaPrenotazione.test.ts.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { camereSoggiorno } from './schedaMaison.ts'
import { rigaGrandeScheda, type SegmentoScheda } from './schedaPrenotazione.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const pagina = leggi('app/scheda/[id]/page.tsx')
const striscia = leggi('components/StrisciaNottiCamere.tsx')
const testata = leggi('components/scheda/TestataMaison.tsx')
const linguette = leggi('components/scheda/LinguetteScheda.tsx')
const oggiParte = leggi('components/scheda/OggiScheda.tsx')
const soggiornoParte = leggi('components/scheda/SoggiornoMaison.tsx')
const conto = leggi('components/scheda/ContoScheda.tsx')
const messaggi = leggi('components/scheda/MessaggiScheda.tsx')
const cliente = leggi('components/scheda/ClienteScheda.tsx')
const cronologia = leggi('components/scheda/CronologiaScheda.tsx')
const css = leggi('app/maison.css')

test('la scheda sta a /scheda/<id> e non rimanda alla vecchia', () => {
  assert.ok(pagina.length > 0)
  assert.equal(/hrefVecchia|\/prenotazioni\/\$\{/.test(pagina), false, 'la scheda nuova rimanda ancora alla vecchia')
  // il conto NON si rifà: arriva da lib/prenotazioneUnica, come sempre
  assert.match(pagina, /contoPrenotazione\(righe, pagamenti/)
  assert.equal(/totaleCent = .*reduce/.test(pagina), false, 'la scheda si è ricalcolata il totale')
})

// ── 1. LA VESTE «MAISON» ───────────────────────────────────────────────────
test('la pagina è «Maison»: le variabili della Home, bianco dal telefono e dal Mac (29/09/2026), dal Mac a 620 px', () => {
  assert.match(pagina, /<div className="maison sch -mt-12 lg:mt-0 md:max-w-\[620px\] md:mx-auto" data-senza-sottolinea data-scheda-maison>/)
  assert.match(pagina, /<VesteMaison>/, 'la striscia deve prendere la veste della Nuova prenotazione')
  assert.match(css, /:root:has\(\.sch\) \{ --home-bg: #FFFFFF; --home-line: #E8E3DA; \}/)
  assert.equal(/:root:has\(\.sch\) \{ --home-bg: #F6F2EA/.test(css), false, 'niente più eccezione crema dal Mac')
  // sul telefono la barra alta dell'app non c'è: la barra è quella della scheda
  assert.match(leggi('components/MobileTopBar.tsx'), /pathname\.startsWith\('\/scheda\/'\)( \|\| pathname\.startsWith\('\/richieste\/'\))?\) return null/)
  // «Caricamento…» e l'errore nella veste nuova
  assert.match(pagina, /<p className="mz-caricamento">Caricamento…<\/p>/)
})

test('la barra in cima: «‹ Prenotazioni» a sinistra (l’indietro di sempre), lo stato in maiuscoletto ottone a destra, anche «Confermata»', () => {
  assert.match(pagina, /const indietro = \(\) => smartBack\(router, hrefIndietro\)/)
  assert.match(pagina, /const hrefIndietro = daCliente \? `\/clienti\/\$\{daCliente\}` : '\/prenotazioni'/)
  assert.match(pagina, />‹ Prenotazioni<\/button>/)
  assert.match(pagina, /data-stato-scheda className="stato">\{statoBarra\(statoTesto\)\}/)
  assert.match(css, /\.sch-top \.stato \{[^}]*color: var\(--m-acc\)/)
  // le pastiglie di sempre, sottili sotto la barra, 5 secondi
  assert.match(pagina, /data-salvata className="sch-pastiglia" onClick=\{\(\) => setSalvata\(false\)\}/)
  assert.match(pagina, /data-annullata className="sch-pastiglia mat">✓ \{PRENOTAZIONE_ANNULLATA\}/)
})

// ── 2. LA TESTATA T2 E LE NOTE N1 ──────────────────────────────────────────
test('la testata: nome in Cormorant 28 centrato con 🧾 e ★ davanti, cornetta e nuvoletta accanto, niente date né telefono né «Scrivi»', () => {
  const titolo = testata.slice(testata.indexOf('<h1 data-nome-testa'), testata.indexOf('</h1>'))
  assert.ok(titolo.indexOf('data-ricevuta') < titolo.indexOf('data-stella') && titolo.indexOf('data-stella') < titolo.indexOf('{nome}'), 'prima la ricevuta, poi la stella, poi il nome')
  assert.match(css, /\.sch-nome h1 \{ font-family: var\(--m-disp\); font-size: 28px; font-weight: 500;/)
  assert.match(testata, /<IconeContatto telefono=\{telefono\} nome=\{nome\} dati="intestataria" \/>/)
  // cornetta tel: e chat WhatsApp senza testo; 34 px, area di tocco 44
  assert.match(testata, /href=\{`tel:\+\$\{numero\}`\}/)
  assert.match(testata, /href=\{waHrefTesto\(numero, ''\)\}/)
  assert.match(css, /\.sch-ic a \{ position: relative; width: 34px; height: 34px;/)
  assert.match(css, /\.sch-ic a::before \{ content: ""; position: absolute; inset: -5px; \}/)
  // senza numero: la scritta in mattone al posto dei cerchi
  assert.match(testata, /\{senzaNumero\s*\? <p data-senza-numero className="sch-senza-numero">\{NESSUN_NUMERO\}<\/p>/)
  // date, orario, percorso, oggi, residuo, contatti e documento non stanno più in testata
  for (const vecchio of ['data-date-testa', 'data-arrivo-testa', 'data-percorso-testa', 'data-oggi-testa', 'data-residuo-testa', 'data-contatti-testa', 'data-documento-testa', 'data-scrivi']) {
    assert.equal(testata.includes(vecchio), false, `${vecchio} è ancora in testata`)
  }
  assert.equal(existsSync(new URL('../components/scheda/TestaScheda.tsx', import.meta.url)), false, 'la testa di prima è ancora lì')
  assert.match(pagina, /stella=\{valutazioneDi\(guest\) === 'ottimo'\}/)
  assert.match(pagina, /ricevuta=\{vuoleRicevuta\(guest\)\}/)
})

test('la riga «dorme …» solo con la spunta, con le icone di QUELLA persona; già ospite con lo speso in mattone; «da dove? ›»', () => {
  assert.match(pagina, /const dorme = chiDormeAlPosto\(/)
  assert.match(pagina, /dorme=\{dorme\}/)
  assert.match(testata, /\{dorme && \([\s\S]{0,200}\{testoDorme\(dorme\)\}[\s\S]{0,100}<IconeContatto telefono=\{dorme\.telefono\} nome=\{dorme\.nome\} piccole dati="dorme" \/>/)
  assert.match(css, /\.sch-ic\.piccole a \{ width: 28px; height: 28px; \}/)
  assert.match(css, /\.sch-dorme \{[^}]*color: var\(--m-mat\)/)
  assert.match(pagina, /primaRiga=\{primaRiga\.testo\}/)
  assert.match(pagina, /speso=\{spesoTestata\(totaleSoggiorniCent\)\}/)
  assert.match(testata, /data-totale-cliente className="mat">\{speso\}/)
  assert.match(testata, /data-chiedi-provenienza onClick=\{chiediProvenienza\}/)
  // i grassetti di sempre sul numero e sul nome (Ania, 18/09/2026)
  assert.match(testata, /pezziRigaCliente\(primaRiga\)\.map/)
})

test('le note «N1»: filo tratteggiato, nota del cliente in mattone 13,5, «Questa volta» e la nota della prenotazione; senza note niente', () => {
  assert.match(css, /\.sch-note \{ margin-top: 12px; padding-top: 10px; border-top: 1px dashed var\(--m-line\); color: var\(--m-mat\); font-family: var\(--home-ui-font\); font-size: 13\.5px;/)
  assert.match(testata, /\{notePulite\.length > 0 && \(/)
  assert.match(testata, /QUESTA_VOLTA/)
  assert.match(pagina, /note=\{note\}/)
})

// ── 3. LE LINGUETTE ────────────────────────────────────────────────────────
test('cinque linguette, una parte alla volta, la scelta nell’indirizzo; puntini e date sotto', () => {
  assert.match(pagina, /const \[linguetta, scegliLinguetta\] = useLinguetta\(\)/)
  for (const id of ['oggi', 'soggiorno', 'conto', 'messaggi', 'cliente']) {
    assert.match(pagina, new RegExp(`\\{linguetta === '${id}' && \\(`), `la parte ${id} non si mostra da sola`)
  }
  // l'indirizzo: si legge all'apertura e a ogni cambio, si scrive senza riempire la cronologia
  assert.match(linguette, /setScelta\(linguettaDaHash\(window\.location\.hash\)\)/)
  assert.match(linguette, /window\.addEventListener\('hashchange', leggi\)/)
  assert.match(linguette, /window\.history\.replaceState\(/)
  assert.match(linguette, /\{puntini\.includes\(l\.id\) && <b className="punto"/)
  assert.match(pagina, /const puntini = puntiniLinguette\(controlli\)/)
  assert.match(pagina, /periodo=\{periodoLinguetta\(primoArrivo, ultimaPartenza\)\}/)
  assert.match(css, /\.sch-tabs button\.on::after \{ content: ""; position: absolute; left: 20%; right: 20%; bottom: -1px; height: 2px; background: var\(--m-acc\); \}/)
  assert.match(css, /\.sch-tabs \.punto \{[^}]*background: var\(--m-mat\)/)
  // la fascia che scorreva non c'è più nella scheda
  assert.equal(/FasciaSezioni|SEZIONI_SCHEDA/.test(pagina), false, 'la scheda usa ancora la fascia delle sezioni')
  // i link di prima: #arrivo e #conto portano ancora al posto giusto
  assert.match(pagina, /<section id="arrivo" className="np-sec" style=\{\{ paddingTop: 18 \}\}>/)
  assert.match(pagina, /<div id="conto">/)
})

// ── 4. OGGI ────────────────────────────────────────────────────────────────
test('Oggi: In breve, Da fare oggi con UN’azione per voce, Prossimi giorni', () => {
  assert.match(oggiParte, /\{IN_BREVE\}/)
  assert.match(oggiParte, /\{DA_FARE_OGGI\} \{daFare\.length > 0 && <small>· \{daFare\.length\}<\/small>\}/)
  assert.match(oggiParte, /data-tutto-a-posto className="sch-a-posto">\{TUTTO_A_POSTO\}/)
  assert.match(oggiParte, /\{PROSSIMI_GIORNI\}/)
  // le voci sono quelle di «Da controllare» di questa prenotazione, con le cifre del conto autorevole
  assert.match(pagina, /daControllareScheda\(\{[\s\S]{0,300}conto, pagato: righe\.some\(r => r\.pagato\),/)
  assert.match(pagina, /const daFare: VoceDaFare\[\] = controlli\.map\(v => \{/)
  // il pagamento apre il foglio QUI, solo col conto leggibile
  assert.match(pagina, /if \(azione === 'Pagamento'\) return \{ \.\.\.base, onClick: conto \? \(\) => setFoglioPagamento\(true\) : undefined \}/)
  assert.match(pagina, /arrivoInBreve\(arrivoDati, primoArrivo, oggi\)/)
  assert.match(pagina, /prossimiGiorni\(caselle, oggi, ultimaPartenza, residuoCent\)/)
})

// ── 5. SOGGIORNO ───────────────────────────────────────────────────────────
test('Soggiorno: «Arrivo e navetta» con «Modifica arrivo» e «Arrivi precedenti», poi le notti, poi le camere', () => {
  const parte = pagina.slice(pagina.indexOf("{linguetta === 'soggiorno'"), pagina.indexOf("{linguetta === 'conto'"))
  const ordine = ['id="arrivo"', '<ArrivoMaison', 'Arrivi precedenti', 'id="soggiorno"', '<StrisciaNottiCamere', 'data-comandi-linea', '<CamereMaison'].map(x => parte.indexOf(x))
  assert.ok(ordine.every(p => p > 0), 'manca un pezzo del soggiorno')
  assert.deepEqual([...ordine].sort((a, b) => a - b), ordine, 'i pezzi del soggiorno non sono nell’ordine del riferimento')
  assert.match(parte, /\{arriviAperti \? 'Chiudi arrivi precedenti' : 'Arrivi precedenti'\}/)
  assert.match(parte, /style=\{\{ paddingTop: 30 \}\}/)
  // ritocchi del 29/09/2026 (C3): la riga «un tocco su una notte…» non c'è più
  assert.doesNotMatch(parte, /\{SOTTO_STRISCIA\}/)
  assert.match(soggiornoParte, /data-modifica-arrivo onClick=\{onModifica\}/)
  // «Modifica soggiorno» non c'è più
  const senzaNote = (t: string) => t.split('\n').filter(r => !r.trim().startsWith('//')).join('\n')
  assert.equal(/Modifica soggiorno/.test(senzaNote(pagina)), false)
})

test('la striscia delle notti è quella nuova, e da lì si cambia la camera', () => {
  assert.match(pagina, /import StrisciaNottiCamere from '@\/components\/StrisciaNottiCamere'/)
  assert.match(pagina, /const linee = useMemo\(\(\) => lineeDelSoggiorno\(attive\), \[attive\]\)/)
  assert.match(pagina, /\{linee\.map\(\(l, i\) => \([\s\S]{0,600}<StrisciaNottiCamere notti=\{l\.notti\} oggi=\{oggi\}/)
  assert.match(pagina, /setNotteAperta\(\{ linea: l\.chiave, iso: n\.iso \}\)/)
  assert.match(pagina, /<FoglioNotte notti=\{lineaAperta\.notti\} iso=\{notteAperta\.iso\} contesto=\{contestoAperto\}/)
  assert.equal(/hrefNotte/.test(pagina), false)
  assert.match(striscia, /from '@\/lib\/strisciaNotti'/)
  // la veste della Nuova prenotazione, senza la riga riassuntiva (lo dicono le camere sotto)
  assert.match(pagina, /spiegazione=\{false\} riassunto=\{false\}/)
  assert.match(striscia, /\{conRiassunto && riassunto && <p data-riassunto-striscia/)
})

test('con due camere nelle stesse notti ci sono due strisce, ognuna col suo titolo, e si cambiano da qui (17/09/2026)', () => {
  assert.match(pagina, /const nonSiSposta = camere\.length === 0\n/)
  assert.match(pagina, /onNotte=\{nonSiSposta \? undefined : n => setNotteAperta\(\{ linea: l\.chiave, iso: n\.iso \}\)\}/)
  assert.match(pagina, /\{linee\.length > 1 && <p data-linea-titolo[^>]*>\{l\.titolo\}<\/p>\}/)
  assert.match(pagina, /data-linee-parallele[^>]*>\{SPIEGAZIONE_PARALLELE\}/)
  assert.match(pagina, /\{CAMERE_NON_LETTE\}/)
  assert.match(pagina, /sottotitolo=\{linee\.length > 1 \? lineaAperta\.titolo : undefined\}/)
  assert.match(pagina, /contoDopo=\{\(bozza, daQui\) => contoDellaBozza\(lineaAperta, conDaQui\(bozza, daQui\)\)\}/)
  assert.match(pagina, /const senza = pianoNotti\(bozza, linea\.segmenti, ctx, SENZA_SCONTO\)/)
  assert.match(pagina, /const piano = pianoNotti\(bozza, linea\.segmenti, ctx\)/)
  const foglioNotte = leggi('components/FoglioNotte.tsx')
  assert.match(foglioNotte, /data-sottotitolo-notte/)
  assert.match(foglioNotte, /data-conto-dopo[^>]*>\{conto\.testo\}/)
  assert.match(pagina, /const contestoAperto = lineaAperta \? contestoLinea\(lineaAperta, linee, contesto\) : contesto/)
})

test('sotto la striscia «Cambia date · Cambio camera · Aggiungi camera», e «Togli camera» in mattone solo con più camere', () => {
  const riga = pagina.slice(pagina.indexOf('data-comandi-linea'), pagina.indexOf('data-comandi-linea') + 1600)
  assert.ok(riga.indexOf('data-cambia-date') < riga.indexOf('data-cambio-camera') && riga.indexOf('data-cambio-camera') < riga.indexOf('data-aggiungi-camera'), 'ordine sbagliato')
  assert.match(riga, /data-cambio-camera=\{l\.chiave\} onClick=\{\(\) => setCambioAperto\(l\.chiave\)\}/)
  assert.match(riga, /i === linee\.length - 1 && statoSoggiorno !== 'annullata' && \(/)
  assert.match(riga, /\{siPuoTogliere\(linee\.length\) && \([\s\S]{0,200}data-togli-camera=\{l\.chiave\} onClick=\{\(\) => setTogliAperto\(l\.chiave\)\} className="mz-lnk q sch-lnk-mat"/)
  const foglio = leggi('components/scheda/FoglioCambioCamera.tsx')
  assert.match(foglio, /cambiaCameraDaLi\(notti, daNotte, camera, contesto\)/)
  assert.match(foglio, /camereDaLi\(notti, daNotte, contesto\)/)
  assert.match(pagina, /<FoglioCambioCamera notti=\{lineaCambio\.notti\} contesto=\{contestoLinea\(lineaCambio, linee, contesto\)\}/)
  assert.match(pagina, /onFatto=\{nuove => chiediPrezzoOSalva\(lineaCambio, nuove, \(\) => setCambioAperto\(null\)\)\}/)
  const togli = leggi('components/scheda/FoglioTogliCamera.tsx')
  assert.match(togli, /aggiornaInUnColpo\(ids, campi\)/)
  assert.match(togli, /if \(esito\.incerto\) \{ onIncerto\(esito\.messaggio\); return \}/)
  assert.equal(/supabase/.test(togli), false)
  assert.match(pagina, /<FoglioTogliCamera titolo=\{lineaDaTogliere\.titolo\} ids=\{lineaDaTogliere\.segmenti\.map\(s => s\.id\)\}/)
  assert.match(pagina, /const dove = schedaDopo\(booking\.id, ids, altre\)/)
  assert.match(pagina, /if \(dove\) \{ setTogliAperto\(null\); router\.replace\(`\/scheda\/\$\{dove\}`\); return \}/)
  assert.match(leggi('lib/togliCamera.ts'), /status: 'annullata', cancelled_at: adesso, cancelled_reason: MOTIVO_TOGLI_CAMERA/)
})

// REGOLA FISSA n. 8 dal 28/09/2026 (riferimento a linguette approvato da
// Ania): la sequenza delle camere non sta più in testata. I cambi si leggono
// nella linguetta Soggiorno, UNA riga per tratto col segno ⇄ davanti a ogni
// camera dopo la prima — anche quando una camera torna — e «N cambi»
// accanto al titolo; il «+» resta per due camere nelle stesse notti.
test('ospiti e cambi, e la sequenza intera delle camere: regola fissa n. 8 nella linguetta Soggiorno', () => {
  type Camera = NonNullable<SegmentoScheda['rooms']>
  const LENA: Camera = { id: 'lena', name: 'Lena', base_price: 80 }
  const AMELIA: Camera = { id: 'amelia', name: 'Amelia', base_price: 70 }
  const seg = (id: string, c: Camera, a: string, p: string): SegmentoScheda => ({ id, room_id: c.id, check_in: a, check_out: p, status: 'confermata', num_guests: 1, price_per_night: 80, total_amount: 160, rooms: c, group_id: 'g' })
  const tre = [seg('a', LENA, '2026-09-10', '2026-09-12'), seg('b', AMELIA, '2026-09-12', '2026-09-14'), seg('c', LENA, '2026-09-14', '2026-09-16')]
  const righe = camereSoggiorno(tre)
  assert.deepEqual(righe.map(r => (r.cambio ? `⇄ ${r.nome}` : r.nome)), ['Lena', '⇄ Amelia', '⇄ Lena'])
  assert.equal(rigaGrandeScheda(tre).camere, 'Lena ⇄ Amelia ⇄ Lena')
  assert.match(soggiornoParte, /\{r\.cambio \? `⇄ \$\{r\.nome\}` : r\.nome\}/)
  assert.match(pagina, /Camere \{cambi && <small>· \{cambi\}<\/small>\}/)
  // i nomi non si tagliano
  assert.equal(/truncate|line-clamp/.test(soggiornoParte), false, 'i nomi delle camere vengono tagliati')
})

// ── 6. CONTO ───────────────────────────────────────────────────────────────
test('il conto: totale · già ricevuto · come paga, «Resta da incassare» grande in mattone (verde da saldato), comandi, pagamenti, dettaglio', () => {
  const ordine = ['data-totale-concordato', 'data-gia-ricevuto', 'data-come-paga', 'data-residuo', 'data-come-paga-riga', 'data-comandi-conto', 'data-pagamenti-ricevuti',
    'data-copertura-pagamenti', 'data-dettaglio-soggiorno', 'data-totale-dettaglio'].map(d => conto.indexOf(d))
  assert.ok(ordine.every(p => p > 0), 'manca un pezzo del conto')
  assert.deepEqual([...ordine].sort((x, y) => x - y), ordine, 'i pezzi del conto non sono nell’ordine del riferimento')
  assert.match(conto, /\{conto\.sconto \? RIGA_TOTALE_CONCORDATO : RIGA_TOTALE_SOGGIORNO\}/)
  assert.match(conto, /\{riepilogo\.saldato \? CONTO_SALDATO : RIGA_RESTA_DA_INCASSARE\}/)
  assert.match(css, /\.sch-resta b \{ font-size: 32px; font-weight: 300; color: var\(--m-mat\);/)
  assert.match(css, /\.sch-resta\.saldato b \{ color: var\(--color-green-mid\); \}/)
  assert.match(conto, /<button type="button" data-aggiungi-pagamento onClick=\{onPagamento\} className="mz-lnk">Aggiungi pagamento<\/button>/)
  assert.match(conto, /data-togli-pagamento=\{p\.id\} onClick=\{\(\) => onTogliPagamento\(p\.id\)\}/)
  assert.match(conto, /\{pagamenti\.length === 0 && <p data-nessun-pagamento className="np-hint">\{nessunPagamento\}<\/p>\}/)
  assert.match(conto, /<s>\{conto\.totale\}<\/s>/)
  assert.match(pagina, /const riepilogo = conto \? riepilogoConto\(conto, righe\.some\(r => r\.pagato\)\) : null/)
  assert.match(pagina, /<ContoScheda riepilogo=\{riepilogo\} conto=\{contoRighe\}/)
  assert.match(pagina, /const contoRighe = useMemo\(\(\) => \(conto \? contoScheda\(attive, conto\.totaleCent\) : null\), \[attive, conto\]\)/)
  assert.match(pagina, /onPagamento=\{\(\) => setFoglioPagamento\(true\)\}/)
  // mancato arrivo e conto non leggibile: i testi di sempre
  assert.match(pagina, /Camera liberata\. Prenotazione conservata nello storico\./)
  assert.match(pagina, /Non riesco a leggere il conto\. Ricarica la scheda prima di toccare i pagamenti\./)
})

test('il conto: REGOLA FISSA n. 7, niente «notti · a notte» sotto la cifra grande, né nella scheda né nell’inserimento', () => {
  assert.equal(/sotto=\{/.test(conto), false, 'la scheda rimette la riga «notti · a notte» sotto «Da pagare»')
  assert.equal(/nottiANotte|conto\.sotto/.test(conto), false, 'la scheda rimette la riga «notti · a notte»')
  const contoNuova = leggi('components/nuova/ContoNuova.tsx')
  assert.equal(/sotto=\{/.test(contoNuova), false, 'l’inserimento rimette la riga «notti · a notte» sotto «Da pagare»')
})

// ── 7. MESSAGGI E CRONOLOGIA ───────────────────────────────────────────────
test('Messaggi: interruttore, «A chi scrivi», la conferma con immagine, Utili adesso, la griglia; niente «Messaggio libero»', () => {
  const ordine = ['data-interruttore="whatsapp"', 'data-destinatari', 'data-conferma-immagine', 'data-conferma-sempre', 'data-utili-adesso', 'data-tutti-messaggi'].map(d => messaggi.indexOf(d))
  assert.ok(ordine.every(p => p > 0), 'manca un pezzo dei messaggi')
  assert.deepEqual([...ordine].sort((a, b) => a - b), ordine)
  assert.match(messaggi, /\{GRIGLIA_MESSAGGI\.map\(m => pastiglia\(m, true\)\)\}/)
  assert.match(messaggi, /const utili = utiliScheda\(fase\)/)
  assert.match(css, /\.sch-griglia \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/)
  assert.match(messaggi, /m\.tipo === 'annullamento' \? 'm' : ''/)
  const codiceMessaggi = messaggi.split('\n').filter(r => !r.trim().startsWith('//')).join('\n')
  assert.equal(/Messaggio libero|'libero'/.test(codiceMessaggi), false, '«Messaggio libero» è ancora nei messaggi')
  // il numero è quello della persona scelta; la conferma con immagine va a lei
  assert.match(pagina, /const waMessaggi = numeroWhatsAppPrenotazione\(scelto\.telefono\)/)
  assert.match(pagina, /waHrefTesto\(waMessaggi \?\? '', testoMessaggio\(tipo\)\)/)
  assert.match(pagina, /guests: \{ \.\.\.\(perIMessaggi\(\)\.guests \?\? \{\}\), phone: scelto\.telefono \}/)
  // senza nessun numero, come prima: la frase e basta
  assert.match(pagina, /Senza numero di telefono non si può scrivere alla cliente\./)
  // il messaggio di annullamento è un TESTO: non tocca stato o date
  assert.equal(/setFoglioAnnulla|status:\s*'annullata'/.test(messaggi), false)
  assert.equal(/<select|onScegliFase|setFase/.test(messaggi), false)
})

test('la fase arriva dalla scheda, letta dalle date della prenotazione intera', () => {
  assert.match(pagina, /import \{ faseMessaggi, rigaPerMessaggi, statoPrenotazione \} from '@\/lib\/messaggiFase'/)
  assert.match(pagina, /const faseSoggiorno = faseMessaggi\(righePrenotazione, oggi\)/)
  assert.match(pagina, /const righePrenotazione = righe\.length \? righe : booking \? \[booking\] : \[\]/)
  assert.match(pagina, /<MessaggiScheda fase=\{faseSoggiorno\}/)
  assert.equal(/new Date\(|Date\.now/.test(messaggi), false, 'il componente dei messaggi guarda l’orologio')
})

test('messaggi, immagine e testata leggono la riga VIVA, mai quella dell’indirizzo', () => {
  assert.match(pagina, /const rigaViva = useMemo\(\(\) => rigaPerMessaggi\(righe, booking\), \[righe, booking\]\)/)
  assert.match(pagina, /const statoSoggiorno = useMemo\(\(\) => \(righe\.length \? statoPrenotazione\(righe, booking\)/)
  assert.match(pagina, /const perIMessaggi = \(\) => perMessaggio\(\{ \.\.\.rigaViva,/)
  assert.equal(/perMessaggio\(\{ \.\.\.booking/.test(pagina), false, 'i messaggi ripartono dalla riga dell’indirizzo')
  assert.match(pagina, /<ConfermaWhatsApp booking=\{\{ \.\.\.perIMessaggi\(\),/)
  assert.match(pagina, /buildWhatsappMsg\(perIMessaggi\(\), tipo, attive, pagamenti\)/)
  assert.match(pagina, /statoScheda\(statoSoggiorno, ultimaPartenza, oggi\)/)
  const righeConStato = pagina.split('\n').filter(r => /booking\??\.status/.test(r))
  assert.equal(righeConStato.length, 1, `la scheda decide ancora sullo stato della riga aperta: ${righeConStato.join(' | ')}`)
})

test('i messaggi usano i testi di sempre, non ne scrivono di nuovi', () => {
  assert.match(pagina, /import buildWhatsappMsg, \{ perMessaggio, type TipoMessaggio \} from '@\/lib\/messaggiPrenotazione'/)
  assert.match(pagina, /openWhatsApp\(waMessaggi, testoMessaggio\(tipo\), business\)/)
  assert.equal(/Gentile /.test(messaggi), false, 'il componente dei messaggi si è scritto un testo suo')
})

test('la cronologia in fondo ai Messaggi: quando a sinistra, cosa a destra, gli inviati in verde, i tre messaggi di sempre', () => {
  const parte = pagina.slice(pagina.indexOf("{linguetta === 'messaggi'"), pagina.indexOf("{linguetta === 'cliente'"))
  assert.ok(parte.indexOf('<MessaggiScheda') < parte.indexOf('<CronologiaScheda'), 'la cronologia sta sotto i messaggi')
  assert.match(css, /\.sch-storia \{ display: grid; grid-template-columns: 78px minmax\(0, 1fr\);/)
  assert.match(cronologia, /className=\{r\.messaggio \? 'inviato' : ''\}/)
  assert.match(cronologia, /Il registro delle modifiche non è ancora acceso su questo database\./)
  assert.match(cronologia, /Ancora niente da raccontare\./)
  assert.match(cronologia, /\{NOTA_CRONOLOGIA\}/)
  assert.match(leggi('lib/schedaConto.ts'), /\.sort\(\(a, b\) => a\.ordine\.localeCompare\(b\.ordine\) \|\| a\.n - b\.n\)/)
})

// ── 8. CLIENTE ─────────────────────────────────────────────────────────────
test('Cliente: griglia a due colonne, azioni, «Chi dorme in camera», soggiorni precedenti, «Annulla prenotazione» in fondo', () => {
  const ordine = ['sch-g2', 'data-modifica-dati', 'data-cambia-cliente', 'data-nota-colore', 'data-chi-dorme-scheda', 'data-con-lei-comando', 'data-soggiorni-precedenti', 'data-annulla-prenotazione'].map(d => cliente.indexOf(d))
  assert.ok(ordine.every(p => p > 0), 'manca un pezzo del cliente')
  assert.deepEqual([...ordine].sort((a, b) => a - b), ordine, 'i pezzi del cliente non sono nell’ordine del riferimento')
  assert.match(cliente, /data-chiedi-provenienza-cliente/)
  assert.match(cliente, /href=\{`\/scheda\/\$\{s\.prenotazioneId\}`\}/)
  assert.match(cliente, /\{euroTondi\(s\.totaleCent\)\} ›/)
  assert.match(cliente, /È la prima volta che viene da noi\./)
  assert.match(cliente, /\{etichettaDormeLei\(p\.chiE\)\}/)
  assert.match(cliente, /\{COMANDO_CHI_DORME\}/)
  assert.equal(/>Con lei<|'Con lei'/.test(cliente), false, '«Con lei» è ancora nella parte cliente')
  // l'annullamento non c'è se la prenotazione è già annullata
  assert.match(pagina, /onAnnulla=\{statoSoggiorno !== 'annullata' \? \(\) => setFoglioAnnulla\(true\) : null\}/)
  assert.match(pagina, /onNota=\{\(\) => setFoglioNota\(true\)\}/)
  assert.match(pagina, /data-aggiungi-camera onClick=\{aggiungiCamera\}/)
})

test('le altre prenotazioni si leggono anche un mese intorno al soggiorno: «Cambia date» sa se la camera è libera fuori dalle notti di adesso', () => {
  assert.match(pagina, /const GIORNI_INTORNO = 31/)
  assert.match(pagina, /\.lt\('check_in', spostaGiorni\(partenza, GIORNI_INTORNO\)\)\.gt\('check_out', spostaGiorni\(arrivo, -GIORNI_INTORNO\)\)/)
})

test('le cose da controllare sono le regole della Home, filtrate su questa prenotazione', () => {
  const logica = leggi('lib/schedaPrenotazione.ts')
  assert.match(logica, /import \{ eccezioniPagamenti, eccezioniArrivi, eccezioniCalendario, hrefDestinazione, ETICHETTA_TIPO/)
  assert.match(logica, /from '\.\/daControllare\.ts'/)
  // nessuna regola riscritta: le voci in più sono solo quelle che si vedono da qui
  assert.match(logica, /etichetta: 'Cambio camera'/)
  assert.match(logica, /etichetta: 'Documento'/)
})

test('dal foglietto si cambiano anche gli ospiti: Allegra 2→3 accende il letto, 3→2 lo spegne se automatico, a mano resta', () => {
  assert.match(pagina, /ospitiPossibili=\{cameraId => \{[\s\S]{0,200}ospitiPossibiliNotte\(camera, capienzaCamera\(camera\)\)/)
  assert.match(pagina, /onFatto=\{\(nuove, daQui\) => chiediPrezzoOSalva\(lineaAperta, conDaQui\(nuove, daQui\), \(\) => setNotteAperta\(null\)\)\}/)
  assert.match(pagina, /ospitiDaQuiInPoi\(bozza, notteAperta\.iso, contestoAperto\)/)
  const foglioNotte = leggi('components/FoglioNotte.tsx')
  assert.match(foglioNotte, /cambiaOspitiConLettoAuto\(bozza, iso, quanti, contesto, lettoAuto\)/)
  assert.match(foglioNotte, /setLettoAuto\(false\); setBozza\(b => cambiaLetto\(b, iso, true, contesto, \{ ospitiAParte \}\)\)/)
  // le persone contano per «è cambiato qualcosa?»
  assert.match(leggi('lib/strisciaNotti.ts'), /&& n\.persone === b\[i\]\.persone\)/)
})

test('il salvataggio delle notti: si annulla, non si cancella, e il conto si rifà da solo', () => {
  // il piano si fa sui tratti della linea soltanto: le altre linee non si toccano
  assert.match(pagina, /const piano = pianoNotti\(nuove, linea\.segmenti, contestoLinea\(linea, linee, contesto\), prezzo\?\.scelta\)/)
  assert.match(pagina, /const gruppo = linea\.segmenti\[0\]\?\.group_id \|\| crypto\.randomUUID\(\)/)
  // l'annullamento lo fa la funzione della 0053, e annulla: non cancella
  const sql = readFileSync(new URL('../supabase/proposte/0053_notti_in_un_colpo.BOZZA.sql', import.meta.url), 'utf8')
  assert.match(sql, /set status = 'annullata', cancelled_at = adesso/)
  assert.equal(/delete from public\.bookings/.test(sql), false, 'una riga viene cancellata invece che annullata')
  assert.equal(/from\('bookings'\)\.delete\(\)/.test(pagina), false)
  // niente da salvare se non è cambiato niente (Annulla non tocca il database)
  assert.match(pagina, /if \(!booking \|\| salvandoNotti \|\| salvataggioNotti\.current \|\| stessaStriscia\(linea\.notti, nuove\)\) return/)
  // dopo il salvataggio la scheda si rilegge: conto, tratti e «Da controllare» insieme
  assert.match(pagina, /setVersione\(v => v \+ 1\)/)
  assert.match(pagina, /\}, \[id, versione\]\)/)
  // le tre cose vanno insieme: una transazione sola, non tre richieste
  assert.match(pagina, /const esito = await salvaNottiInUnColpo\(piano, gruppo, comuni, arrivoDi,/)
  assert.match(pagina, /supabase\.rpc\('sposta_notti', dati\)/)
  assert.equal(/salvaInSequenza/.test(pagina), false, 'le notti si salvano ancora a pezzi')
})

test('i fogli usano i salvataggi già in casa, non ne scrivono di nuovi', () => {
  const arrivo = leggi('components/scheda/FoglioArrivo.tsx')
  // Dal 21/09/2026 il salvataggio dell'arrivo è uno solo per tutti i punti
  // di ingresso (lib/arrivoDati), con verifica delle righe e rilettura
  assert.match(arrivo, /import \{ salvaArrivoPrenotazione \} from '@\/lib\/arrivoDati'/)
  assert.match(leggi('lib/arrivoDati.ts'), /import \{ messaggioNonSalvato, MESSAGGIO_NON_SALVATO \} from '\.\/scritturaSicura\.ts'/)
  const prov = leggi('components/scheda/FoglioProvenienza.tsx')
  assert.match(prov, /import \{ leggiStrutture, ricordaStruttura, salvaProvenienzaCliente \} from '@\/lib\/provenienzaDati'/)
  assert.match(prov, /import CampoProvenienza/, 'il foglio si è riscritto i quattro tasti')
  // la provenienza si salva sul CLIENTE, non sulla prenotazione
  assert.match(prov, /salvaProvenienzaCliente\(guestId, campi\)/)
})

// REGRESSIONE (verifica indipendente del 21/09/2026 sera): la scheda passava
// booking?.status, cioè lo stato della SOLA riga aperta, e una prenotazione con
// una camera annullata e una confermata diventava «annullata» entrando dal link
// della riga annullata. Il comportamento è provato in lib/messaggiFase.test;
// qui si tiene fermo il contratto del chiamante, che il difetto aveva sbagliato.
test('la fase non riceve MAI lo stato di una riga sola (regressione del 21/09/2026)', () => {
  const chiamata = /faseMessaggi\(([^)]*)\)/g
  const argomenti = [...pagina.matchAll(chiamata)].map(m => m[1])
  assert.ok(argomenti.length > 0, 'la scheda non chiama più faseMessaggi')
  for (const a of argomenti) {
    assert.equal(/status/.test(a), false, `faseMessaggi riceve ancora uno stato: «${a}»`)
    assert.equal(/\battive\b/.test(a), false, `faseMessaggi riceve solo i tratti attivi: «${a}»`)
  }
  // e la funzione stessa prende due cose sole: le righe e il giorno
  const fase = leggi('lib/messaggiFase.ts')
  assert.match(fase, /export function faseMessaggi\(segmenti: SegmentoScheda\[\], oggi: string\): FaseMessaggi/)
  // dentro il CORPO di faseMessaggi non si guarda nessuno stato: chi lo legge
  // apposta è statoPrenotazione, che sta dopo e serve alla testa
  const corpo = fase.slice(fase.indexOf('export function faseMessaggi'))
  assert.equal(/status/.test(corpo.slice(0, corpo.indexOf('\n}'))), false,
    'faseMessaggi guarda di nuovo lo stato di una riga')
})

test('dopo il salvataggio delle notti compare il pop-up grande, e «Cambia date» non anticipa più il conto (Ania, 17/09/2026)', () => {
  // col prezzo deciso nel foglio non c'è niente da rivedere
  assert.match(pagina, /const esitoConferma = confermaNotti\(\{[\s\S]{0,400}concordato: !prezzo && conPrezzoConcordato\(linea\.segmenti\),/)
  assert.match(pagina, /if \(esitoConferma\.avviso\) setAvviso\(esitoConferma\.avviso\)/)
  assert.match(pagina, /<ConfermaVolante key=\{conferma\.n\} righe=\{conferma\.righe\} durata=\{conferma\.durata\} conOk=\{conferma\.conOk\}/)
  // il pop-up delle notti resta finché non si tocca «Ok, ho capito» (Ania, 17/09/2026)
  assert.match(pagina, /durata: esitoConferma\.durata, conOk: true \}\)\)/)
  const volante = leggi('components/ConfermaVolante.tsx')
  assert.match(volante, /export const TESTO_OK = 'Ok, ho capito'/)
  assert.match(volante, /if \(conOk\) return   \/\/ resta finché non si tocca/)
  assert.match(volante, /data-conferma-ok[\s\S]{0,400}\{TESTO_OK\}/)
  // dopo un pagamento resta come prima: se ne va da sola
  assert.doesNotMatch(pagina, /confermaPagamento\([^\n]*conOk/)
  const date = leggi('components/scheda/FoglioDate.tsx')
  assert.match(date, /\{conto && conto\.guaio && <p data-conto-dopo/)
})

test('le altre prenotazioni si leggono anche un mese intorno al soggiorno: «Cambia date» sa se la camera è libera fuori dalle notti di adesso', () => {
  assert.match(pagina, /const GIORNI_INTORNO = 31/)
  assert.match(pagina, /\.lt\('check_in', spostaGiorni\(partenza, GIORNI_INTORNO\)\)\.gt\('check_out', spostaGiorni\(arrivo, -GIORNI_INTORNO\)\)/)
})

test('«Cambia date» e «Cambio camera» si chiudono con «Salva» (Ania, 17/09/2026)', () => {
  assert.match(leggi('components/scheda/FoglioDate.tsx'), /export const FATTO_DATE = 'Salva'/)
  assert.match(leggi('components/scheda/FoglioCambioCamera.tsx'), /export const FATTO_CAMBIO = 'Salva'/)
})
