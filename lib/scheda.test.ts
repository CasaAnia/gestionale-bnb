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
const avviso = leggi('components/scheda/AvvisoScheda.tsx')
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
  for (const pezzo of ['TestaScheda', 'FasciaSezioni', 'AvvisoScheda', 'ConfermaWhatsApp', 'RigaDocumentiPrenotazione']) {
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


// La testa della scheda (20/09/2026 sera, disegno approvato da Ania: «La
// prenotazione, a colpo d'occhio», colonna DOPO · proposta punto 2). Variante
// solo per la scheda: TestaCliente (richieste, inserimento) non cambia.
const testaScheda = leggi('components/scheda/TestaScheda.tsx')

test('la testa della scheda: componente suo, Arial 14 e #30483b solo lì, e TestaCliente non si tocca', () => {
  assert.match(pagina, /import TestaScheda from '@\/components\/scheda\/TestaScheda'/)
  assert.equal(/<TestaCliente/.test(pagina), false, 'la scheda usa ancora TestaCliente')
  assert.match(testaScheda, /data-testa-scheda style=\{\{ font: '14px\/1\.5 Arial, sans-serif', color: TESTO_TESTA \}\}/)
  assert.match(testaScheda, /export const TESTO_TESTA = '#30483b'/)
  // l'ordine approvato, dall'alto: prima riga, nome, date, orario e navetta, percorso, oggi, residuo, da completare, contatti, documento
  const ordine = ['data-prima-riga', 'data-nome-testa', 'data-date-testa', 'data-arrivo-testa', 'data-percorso-testa', 'data-oggi-testa', 'data-residuo-testa', 'data-da-completare', 'data-contatti-testa', 'data-documento-testa'].map(d => testaScheda.indexOf(d))
  assert.ok(ordine.every(p => p > 0), 'manca un pezzo della testa')
  assert.deepEqual([...ordine].sort((x, y) => x - y), ordine, 'i pezzi della testa non sono nell’ordine approvato')
  // TestaCliente resta com'era per richieste e inserimento
  assert.match(testa, /\{rigaGrande \?\? <>/)
  assert.match(testa, /const ROSSO_SPESO = '#D40000'/)
})

test('la prima riga: chi è a sinistra (grassetti sul numero e sul nome), lo storico della spesa a destra in Georgia 17 rosso #b93e32, link alla parte CLIENTE (Ania: resta in alto)', () => {
  assert.match(testaScheda, /data-prima-riga className="flex flex-wrap items-baseline justify-between" style=\{\{ gap: 12, fontSize: 12, color: GRIGIO \}\}/)
  assert.match(testaScheda, /pezziRigaCliente\(primaRiga\)\.map/)
  assert.match(testaScheda, /data-chiedi-provenienza onClick=\{chiediProvenienza\.onClick\}/)
  assert.match(testaScheda, /const ROSSO_STORICO = '#b93e32'/)
  assert.equal((testaScheda.match(/data-totale-cliente className="whitespace-nowrap" style=\{\{ font: `17px \$\{GEORGIA\}`, color: ROSSO_STORICO \}\}>\{totale\} ›/g) ?? []).length, 2)
  assert.match(pagina, /primaRiga=\{primaRiga\.testo\}/)
  assert.match(pagina, /chiediProvenienza=\{primaRiga\.chiediProvenienza && booking\.guest_id \? \{ testo: 'da dove\? ›'/)
  assert.match(pagina, /totaleCent=\{totaleSoggiorniCent\}/)
  assert.match(pagina, /hrefCliente="#cliente"/)
})

test('il nome: Georgia 30 (25 sul telefono), peso normale, 🧾 e ★ davanti', () => {
  assert.match(testaScheda, /<h1 data-nome-testa className="text-center text-\[25px\] min-\[700px\]:text-\[30px\]" style=\{\{ fontFamily: GEORGIA, fontWeight: 400, lineHeight: 1\.2, margin: '23px 0 20px' \}\}>/)
  const titolo = testaScheda.slice(testaScheda.indexOf('<h1 data-nome-testa'), testaScheda.indexOf('</h1>'))
  assert.ok(titolo.indexOf('data-ricevuta') < titolo.indexOf('data-stella') && titolo.indexOf('data-stella') < titolo.indexOf('{nome}'), 'prima la ricevuta, poi la stella, poi il nome')
  assert.match(pagina, /stella=\{valutazioneDi\(guest\) === 'ottimo'\}/)
  assert.match(pagina, /ricevuta=\{vuoleRicevuta\(guest\)\}/)
})

test('le date del soggiorno intero: «mar 1 settembre» a sinistra, le notti in mezzo sopra il filo, «ven 25 settembre» a destra, ARRIVA e PARTE sotto', () => {
  assert.match(pagina, /date=\{dateTesta\(primoArrivo, ultimaPartenza, nottiDormite \|\| giorniSoggiorno\(primoArrivo, ultimaPartenza\)\.length\)\}/)
  assert.match(testaScheda, /<Data d=\{date\.arrivo\} etichetta="arriva" lato="sinistra" \/>/)
  assert.match(testaScheda, /data-notti-testa className="flex-1 text-center self-start min-w-\[32px\]" style=\{\{ fontSize: 11, color: OTTONE_NOTTI, borderBottom: `1px solid \$\{FILO_NOTTI\}`, paddingBottom: 7 \}\}>\{date\.notti\}/)
  assert.match(testaScheda, /<Data d=\{date\.partenza\} etichetta="parte" lato="destra" \/>/)
  // Georgia 22 col mese in 15; sul telefono 20 e 14, il mese a capo
  assert.match(testaScheda, /className="text-\[20px\] min-\[700px\]:text-\[22px\]">\{d\.settimana\} \{d\.giorno\}/)
  assert.match(testaScheda, /className="block min-\[700px\]:inline text-\[14px\] min-\[700px\]:text-\[15px\]" style=\{\{ fontFamily: GEORGIA \}\}>\{d\.mese\}\{d\.anno && ` \$\{d\.anno\}`\}/)
  assert.match(testaScheda, /const ETICHETTA: CSSProperties = \{ display: 'block', font: '9px Arial, sans-serif', letterSpacing: '1\.5px', textAlign: 'center', color: GRIGIO, marginTop: 9 \}/)
})

test('orario e navetta sotto le date (12 px, #756748): i dati veri o cosa manca; toccandoli si apre «Modifica arrivo»', () => {
  assert.match(pagina, /const arrivoTestaTesto = arrivoTestaDaArrivo\(arrivoDati\)/)
  assert.match(pagina, /orario=\{arrivoTestaTesto\.orario\}/)
  assert.match(pagina, /navetta=\{arrivoTestaTesto\.navetta\}/)
  assert.match(pagina, /onArrivo=\{\(\) => setFoglioArrivo\(true\)\}/)
  assert.match(testaScheda, /data-arrivo-testa className="flex flex-wrap" style=\{\{ gap: '4px 16px', margin: '13px 0 20px', fontSize: 12, color: OTTONE_ARRIVO \}\}/)
  assert.match(testaScheda, /const OTTONE_ARRIVO = '#756748'/)
  assert.match(testaScheda, /<button type="button" data-orario-testa onClick=\{onArrivo\}/)
  assert.match(testaScheda, /<button type="button" data-navetta-testa onClick=\{onArrivo\}/)
})

test('ospiti e cambi, e la sequenza intera delle camere (Georgia 19, interlinea 1,5): regola fissa n. 8 nella veste nuova', () => {
  assert.match(pagina, /percorso=\{percorsoTesta\(attive\.length \? attive : righe\)\}/)   // annullata: si leggono lo stesso le sue camere
  assert.match(testaScheda, /data-percorso-testa className="text-center" style=\{\{ margin: '0 0 20px', paddingTop: 16, borderTop: `1px solid \$\{FILO_CHIARO\}` \}\}/)
  assert.match(testaScheda, /data-ospiti-cambi className="uppercase" style=\{OCCHIELLO\}>\{percorso\.sopra\}/)
  assert.match(testaScheda, /data-camere-testa className="text-\[18px\] min-\[700px\]:text-\[19px\]" style=\{\{ fontFamily: GEORGIA, lineHeight: 1\.5, marginTop: 7 \}\}>\{percorso\.camere\}/)
  assert.match(testaScheda, /const OCCHIELLO: CSSProperties = \{ fontSize: 11, letterSpacing: '1\.2px', color: OTTONE_ETICHETTA, marginBottom: 7 \}/)
  // niente troncamento: i nomi vanno a capo
  assert.equal(/truncate|line-clamp/.test(testaScheda), false, 'i nomi delle camere vengono tagliati')
})

test('il blocco OGGI fra due fili #d6c7a8: occhiello, la camera di stanotte in Georgia 25, il prossimo evento in 14 px con la parte forte a 600', () => {
  assert.match(pagina, /oggi=\{oggiTesta\(attive, oggi, statoSoggiorno\)\}/)
  assert.match(pagina, /const oggi = oggiARoma\(\)/)
  assert.match(testaScheda, /data-oggi-testa style=\{\{ borderTop: `1px solid \$\{FILO_OGGI\}`, borderBottom: `1px solid \$\{FILO_OGGI\}`, padding: '16px 0' \}\}/)
  assert.match(testaScheda, /const FILO_OGGI = '#d6c7a8'/)
  assert.match(testaScheda, /data-adesso-testa style=\{\{ font: `25px \$\{GEORGIA\}`, marginBottom: 9 \}\}>\{oggi\.titolo\}/)
  assert.match(testaScheda, /\{oggi\.prossimo && <p data-prossimo-testa style=\{\{ fontSize: 14, color: VERDE_TESTO \}\}>\{oggi\.prossimo\.testo\}<strong style=\{\{ fontWeight: 600 \}\}>\{oggi\.prossimo\.forte\}<\/strong><\/p>\}/)
})

test('il residuo in testa: la cifra del conto (riepilogoConto), Georgia 27; senza conto niente cifra; il richiamo del documento solo quando manca', () => {
  assert.match(pagina, /residuo=\{residuoTesta\(riepilogo, stato\?\.tipo === 'bonifico_atteso', statoSoggiorno === 'annullata'\)\}/)
  assert.equal(/data-stato-conto/.test(pagina), false, 'la vecchia riga rossa dello stato del conto è ancora in testa')
  assert.match(testaScheda, /data-residuo-testa className="flex flex-wrap items-baseline justify-between" style=\{\{ gap: 10, margin: '20px 0 16px', fontSize: 14 \}\}/)
  assert.match(testaScheda, /\{residuo\.importo && <strong className="whitespace-nowrap" style=\{\{ font: `27px \$\{GEORGIA\}`, fontVariantNumeric: 'tabular-nums' \}\}>\{residuo\.importo\}<\/strong>\}/)
  assert.match(pagina, /daCompletare=\{controlli\.some\(v => v\.chiave === 'documento'\) \? DA_COMPLETARE_DOCUMENTO : null\}/)
  assert.match(testaScheda, /\{daCompletare && <p data-da-completare style=\{\{ padding: '11px 13px', background: FONDO_ATTENZIONE, color: TESTO_ATTENZIONE, fontSize: 13, marginBottom: 18, borderRadius: 5 \}\}>\{daCompletare\}<\/p>\}/)
  assert.match(testaScheda, /const FONDO_ATTENZIONE = '#f1eadb'/)
  assert.match(testaScheda, /const TESTO_ATTENZIONE = '#665330'/)
})

test('telefono, «Scrivi» e la riga del documento', () => {
  // il numero vero, che si chiama, e «Scrivi» accanto: 13 px, #405b4b, filo a 3 px, 8 px ai lati
  assert.match(testaScheda, /data-contatti-testa className="text-center" style=\{\{ fontSize: 13, margin: '16px 0', color: VERDE_TESTO \}\}/)
  assert.match(testaScheda, /<a href=\{`tel:\+\$\{telefonoDaChiamare \?\? telefono\}`\} data-chiama className="inline-block" style=\{\{ \.\.\.AZIONE, margin: '-6px 8px', color: VERDE_TESTO \}\}>\{telefono\}<\/a>/)
  assert.match(testaScheda, /<button type="button" onClick=\{onScrivi\} data-scrivi className="inline-block ed-azione"[^>]*>Scrivi<\/button>/)
  assert.match(pagina, /onScrivi=\{waNumero \? \(\) => openWhatsApp\(waNumero, ''\) : undefined\}/)
  assert.match(pagina, /telefonoDaChiamare=\{waNumero\}/)
  // la riga del documento: «Aggiungi documento» sottolineato quando manca, «documento caricato ›» quando c'è; porta ai documenti della cliente
  const riga = documenti.slice(documenti.indexOf('if (scheda) {'), documenti.indexOf('if (scheda) {') + 1200)
  assert.match(riga, /href=\{`\/clienti\/\$\{guestId\}#documenti`\} data-riga-documento/)
  assert.match(riga, /<span className="ed-azione" style=\{\{ minHeight: 0, fontSize: 12, fontWeight: 400, color: '#405b4b', textDecoration: 'underline', textDecorationColor: 'currentColor', textUnderlineOffset: 3 \}\}>Aggiungi documento<\/span>/)
  assert.match(riga, /documento caricato/)
  // il conteggio è già letto dalla pagina: non si interroga il database due volte
  assert.match(pagina, /documento=\{<RigaDocumentiPrenotazione guestId=\{booking\.guest_id\} conteggio=\{documenti\} scheda \/>\}/)
  assert.match(testaScheda, /\{documento && <div data-documento-testa className="text-center" style=\{\{ fontSize: 12, color: GRIGIO, margin: '12px 0 23px' \}\}>\{documento\}<\/div>\}/)
})

test('le note: filo tratteggiato #D8D2C4, rosso #D40000 a 14,5 in grassetto vero, «QUESTA VOLTA»', () => {
  assert.match(testaScheda, /const FILO_NOTA = '#D8D2C4'/)
  assert.match(testaScheda, /data-note-testa style=\{\{ marginBottom: 18, borderTop: `1px dashed \$\{FILO_NOTA\}`, paddingTop: 10 \}\}/)
  assert.match(testaScheda, /const ROSSO_NOTA = '#D40000'/)
  assert.match(testaScheda, /fontSize: 14\.5, fontWeight: 700, color: ROSSO_NOTA/)
  assert.match(leggi('components/scheda/ClienteScheda.tsx'), /const ROSSO_NOTA = '#D40000'/)
  assert.match(leggi('components/scheda/ClienteScheda.tsx'), /fontWeight: v\.etichetta === 'nota del cliente' \? 700 : 600/)
  // la parolina c'è solo sulla nota della prenotazione (la prima non ce l'ha)
  assert.match(testaScheda, /\{n\.etichetta && <p className="uppercase" style=\{\{ fontSize: 10, letterSpacing: '1\.5px', color: ROSSO_NOTA \}\}>\{n\.etichetta\}<\/p>\}/)
  // senza note niente filo e niente spazio
  assert.match(testaScheda, /\{notePulite\.length > 0 && \(/)
  assert.match(pagina, /note=\{note\}/)
  // TestaCliente tiene la sua veste per richieste e inserimento
  assert.match(testa, /const FILO_NOTA_SCHEDA = '#D8D2C4'/)
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
test('«Da controllare»: titoletto ed-sezione col numero, avvisi del punto 3 (20/09/2026 sera), «✓ Tutto a posto»', () => {
  const parte = pagina.slice(pagina.indexOf('id="controllare"'), pagina.indexOf('id="soggiorno"'))
  assert.match(parte, /<p className="ed-sezione">Da controllare \{controlli\.length > 0 && <small>\{controlli\.length\}<\/small>\}<\/p>/)
  assert.match(parte, /data-tutto-a-posto[^>]*fontSize: 14, color: 'var\(--color-green-mid\)'/)
  assert.match(parte, /\{TUTTO_A_POSTO\}/)
  // gli avvisi: 15 px sotto il titoletto, 10 px fra loro, la variante della scheda (non la schedina della proposta)
  assert.match(parte, /<div className="mt-\[15px\] flex flex-col gap-\[10px\]">/)
  assert.match(parte, /<AvvisoScheda key=\{v\.chiave\} etichetta=\{v\.etichetta\} titolo=\{v\.titolo\} dettaglio=\{v\.dettaglio\} parti=\{v\.parti\} link=\{v\.link\}/)
  assert.equal(/<SchedinaControllo/.test(pagina), false, 'la scheda usa ancora la schedina della proposta')
  // «Aggiungi pagamento» apre il foglio già esistente QUI, solo con il conto leggibile
  assert.match(parte, /azione=\{v\.comando\?\.tipo === 'pagamento' && conto \? \{ testo: v\.comando\.testo, onClick: \(\) => setFoglioPagamento\(true\) \} : null\}/)
  // le cifre dell'avviso vengono dal conto autorevole (lo stesso `conto` del riepilogo)
  assert.match(pagina, /daControllareScheda\(\{[\s\S]{0,300}conto, pagato: righe\.some\(r => r\.pagato\),/)
  // il riquadro del riferimento approvato: bianco, bordo #e4e4df, angoli 10, padding 14/15/16, barra dorata 2 px, ombra leggera a sinistra
  assert.match(avviso, /border: `1px solid \$\{AVVISO\.bordo\}`, borderRadius: 10, padding: '14px 15px 16px', boxShadow: AVVISO\.ombra/)
  assert.match(avviso, /bordo: '#e4e4df'/)
  assert.match(avviso, /barra: '#b49965'/)
  assert.match(avviso, /ombra: '-3px 2px 7px rgba\(99,82,49,\.08\)'/)
  assert.match(avviso, /width: 2, background: AVVISO\.barra/)
  // etichetta 10 px / 1,3 px / #a38c61 con 6 px sotto; titolo 15 px peso 600 con 5 px sotto
  assert.match(avviso, /fontSize: 10, letterSpacing: '1\.3px', textTransform: 'uppercase', color: AVVISO\.etichetta, marginBottom: 6/)
  assert.match(avviso, /etichetta: '#a38c61'/)
  assert.match(avviso, /fontSize: 15, fontWeight: 600, lineHeight: 1\.5, color: AVVISO\.testo, marginBottom: 5/)
  // descrizione economica 14 px con gli importi 600 mai spezzati; descrizione ordinaria 13 px peso normale
  assert.match(avviso, /fontSize: 14, lineHeight: 1\.5, color: AVVISO\.parole/)
  assert.match(avviso, /const IMPORTO: CSSProperties = \{ fontWeight: 600, color: AVVISO\.testo, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' \}/)
  assert.match(avviso, /fontSize: 13, lineHeight: 1\.5, color: AVVISO\.descrizione/)
  assert.equal(/fontWeight: 700|font-bold/.test(avviso), false, 'nel riquadro non ci sono grassetti oltre il 600')
  // il comando: veste condivisa ed-azione, 13 px, 9 px sopra, filo a 3 px; nessun font caricato qui
  assert.match(avviso, /className="ed-azione" style=\{COMANDO\}/)
  assert.match(avviso, /fontSize: 13, fontWeight: 600, lineHeight: 1\.5, color: AVVISO\.testo,\n\s+textDecoration: 'underline', textDecorationColor: 'currentColor', textUnderlineOffset: 3/)
  assert.match(avviso, /<p className="flex" style=\{\{ marginTop: 9 \}\}>/)
  assert.equal(/fontFamily|font-family:|from 'next\/font|'Arial/.test(avviso), false, 'l’avviso impone un carattere: deve ereditare quello del gestionale')
  // la schedina della proposta resta com’era
  assert.match(schedina, /border: '1px solid var\(--color-card-border\)', borderRadius: 12/)
  assert.match(schedina, /fontSize: grande \? 15 : 14\.5, fontWeight: 600/)
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
  // prima il piano SENZA sconto (per sapere se serve il foglio del prezzo), poi quello vero
  assert.match(pagina, /const senza = pianoNotti\(bozza, linea\.segmenti, ctx, SENZA_SCONTO\)/)
  assert.match(pagina, /const piano = pianoNotti\(bozza, linea\.segmenti, ctx\)/)
  const foglioNotte = leggi('components/FoglioNotte.tsx')
  assert.match(foglioNotte, /data-sottotitolo-notte/)
  assert.match(foglioNotte, /data-conto-dopo[^>]*>\{conto\.testo\}/)
  // nel contesto di una linea le altre linee sono altre prenotazioni (camera presa, letti contati)
  assert.match(pagina, /const contestoAperto = lineaAperta \? contestoLinea\(lineaAperta, linee, contesto\) : contesto/)
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

test('«Modifica soggiorno» non c’è più: restano «Modifica arrivo» e «Arrivi precedenti»', () => {
  const senzaNote = (t: string) => t.split('\n').filter(r => !r.trim().startsWith('//')).join('\n')
  assert.equal(/Modifica soggiorno/.test(senzaNote(soggiorno)), false, '«Modifica soggiorno» è ancora nei comandi')
  assert.equal(/Modifica soggiorno/.test(senzaNote(pagina)), false)
  assert.equal(/hrefSoggiorno/.test(pagina), false)
  assert.match(soggiorno, />Modifica arrivo</)
  assert.match(soggiorno, /\{arriviAperti \? 'Chiudi arrivi precedenti' : 'Arrivi precedenti'\}/)
  // i tratti di camera sotto la striscia non ci sono più: li ripete il conto (Ania, 17/09/2026)
  assert.equal(/<TrattiCameraScheda/.test(pagina), false, 'i tratti di camera sono ancora nella scheda')
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

test('la riga «Arrivo»: stone 14 a sinistra, orario in pastiglia sage, «da chiedere» in ottone', () => {
  assert.match(soggiorno, /data-riga-arrivo[^>]*flex items-center \$\{etichetta \? 'justify-between' : 'justify-start'\}/)
  assert.match(soggiorno, /fontSize: 14, color: 'var\(--color-stone\)' \}\}>Arrivo/)
  assert.match(soggiorno, /background: 'var\(--color-sage\)', borderRadius: 999/)
  assert.match(soggiorno, /data-da-chiedere style=\{\{ color: OTTONE \}\}>\{DA_CHIEDERE\}/)
  assert.match(soggiorno, /export const DA_CHIEDERE = 'orario da chiedere'/)   // Ania, 17/09/2026
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
  assert.match(soggiorno, /className="ed-azione ed-azione-tenue whitespace-nowrap">\s*\{arriviAperti \? 'Chiudi arrivi precedenti' : 'Arrivi precedenti'\}/)
  // «Modifica arrivo» apre il foglio qui dentro
  assert.match(pagina, /onArrivo=\{\(\) => setFoglioArrivo\(true\)\}/)
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

test('il conto (20/09/2026 sera, disegno approvato da Ania): tre cifre in cima, «Resta da incassare» in Georgia 36 a sinistra; niente rosso, barretta né «Da pagare»', () => {
  // Arial 14/1,5 e verde #30483b SOLO dentro il conto: il carattere dell'app non cambia
  assert.match(conto, /data-conto className=\{className\} style=\{\{ font: '14px\/1\.5 Arial, sans-serif', color: TESTO_CONTO \}\}/)
  assert.match(conto, /export const TESTO_CONTO = '#30483b'/)
  // l'ordine approvato: totale concordato, già ricevuto, residuo, comandi, pagamenti, copertura, come paga, dettaglio, totale
  const ordine = ['data-totale-concordato', 'data-gia-ricevuto', 'data-residuo', 'data-comandi-conto', 'data-pagamenti-ricevuti',
    'data-copertura-pagamenti', 'data-come-paga-riga', 'data-dettaglio-soggiorno', 'data-totale-dettaglio'].map(d => conto.indexOf(d))
  assert.ok(ordine.every(p => p > 0), 'manca un pezzo del conto')
  assert.deepEqual([...ordine].sort((x, y) => x - y), ordine, 'i pezzi del conto non sono nell’ordine approvato')
  // le parole vengono dalla libreria
  assert.match(conto, /\{RIGA_TOTALE_CONCORDATO\}/)
  assert.match(conto, /\{RIGA_GIA_RICEVUTO\}/)
  assert.match(conto, /\{RIGA_RESTA_DA_INCASSARE\}/)
  // le due righe: 15 px, 10 px sopra e sotto, importo in Georgia 25; il residuo in Georgia 36 SOTTO l'etichetta (16 px, 600), a sinistra
  assert.equal((conto.match(/className=\{RIGA\} style=\{\{ padding: '10px 0', fontSize: 15 \}\}/g) ?? []).length, 2)
  assert.equal((conto.match(/font: `25px \$\{GEORGIA\}`/g) ?? []).length, 2)
  assert.match(conto, /borderTop: `1px solid \$\{FILO_RESIDUO\}`, marginTop: 12, padding: '18px 0 20px'/)
  assert.match(conto, /const FILO_RESIDUO = '#cdbf9f'/)
  assert.match(conto, /<span style=\{\{ fontSize: 16, fontWeight: 600 \}\}>\{RIGA_RESTA_DA_INCASSARE\}<\/span>/)
  assert.match(conto, /data-conto-titolo=\{riepilogo\.saldato \? 'saldato' : 'manca'\} className="block"\s*style=\{\{ \.\.\.MONETA, font: `36px \$\{GEORGIA\}`, marginTop: 7, color: TESTO_CONTO \}\}>\{riepilogo\.residuo\}/)
  // gli importi non si spezzano
  assert.match(conto, /const MONETA: CSSProperties = \{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' \}/)
  // niente più cifra rossa, barretta, «800 € pagati, 7 e 16 set» (si guarda il codice, non il commento in testa)
  const codice = conto.slice(conto.indexOf('import type'))
  assert.equal(/ROSSO_CONTO|D40000|data-barra-conto|quotaPagata|testaConto|TestaConto|pagati/.test(codice), false, 'la vecchia testa del conto è ancora lì')
  // niente «Da pagare» che ripeteva il totale anche dopo i pagamenti parziali
  assert.equal(/Da pagare|DaPagareConto|RIGA_DA_PAGARE|TotaleConto|ScontoConto|RigaConto/.test(codice), false, '«Da pagare» (o le righe di prima) è tornato nel conto della scheda')
  // «Saldato» quando il residuo è zero; l'avviso quando i pagamenti superano il totale o il segno «pagato» non ha i movimenti
  assert.match(conto, /\{riepilogo\.saldato && <span data-saldato/)
  assert.match(conto, /\{riepilogo\.avviso && <span data-conto-avviso/)
  // la pagina passa le tre cifre di riepilogoConto (dai valori autorevoli di contoPrenotazione), 24 px sotto il titolo CONTO
  assert.match(pagina, /const riepilogo = conto \? riepilogoConto\(conto, righe\.some\(r => r\.pagato\)\) : null/)
  assert.match(pagina, /<ContoScheda className="mt-6" riepilogo=\{riepilogo\} conto=\{contoRighe\}/)
})

test('il conto: i comandi di testo (13 px, filo a 3 px), i pagamenti uno per riga con «togli», «Come paga», e il dettaglio apribile aperto all’inizio', () => {
  // i comandi: veri bottoni con la veste ed-azione e le misure del riferimento
  assert.match(conto, /const AZIONE: CSSProperties = \{[\s\S]{0,200}fontSize: 13, fontWeight: 400, lineHeight: 1\.5, color: 'inherit',\s*textDecoration: 'underline', textDecorationColor: 'currentColor', textUnderlineOffset: 3,/)
  assert.match(conto, /const AZIONE_FORTE: CSSProperties = \{ \.\.\.AZIONE, fontWeight: 600 \}/)
  assert.match(conto, /<button type="button" data-aggiungi-pagamento onClick=\{onPagamento\} className="ed-azione" style=\{AZIONE_FORTE\}>Aggiungi pagamento<\/button>/)
  assert.match(conto, /<button type="button" data-modifica-sconto onClick=\{onSconto\} className="ed-azione" style=\{AZIONE\}>\{COMANDO_SCONTO\}<\/button>/)
  assert.match(conto, /<button type="button" data-cambia-come-paga onClick=\{onComePaga\} className="ed-azione" style=\{AZIONE\}>Cambia come paga<\/button>/)
  assert.match(conto, /data-comandi-conto className="flex flex-wrap" style=\{\{ marginTop: 13, gap: 14 \}\}/)
  // i pagamenti: titolo in maiuscoletto 12/1,2 px, righe da 13 px col filo #e8e0d3, «togli» tenue; senza pagamenti niente blocco
  assert.match(conto, /\{pagamenti\.length > 0 && \(/)
  assert.match(conto, /data-titolo-pagamenti className="uppercase" style=\{\{ fontSize: 12, letterSpacing: '1\.2px', color: OTTONE_SCURO, margin: '28px 0 8px' \}\}>\{TITOLO_PAGAMENTI_RICEVUTI\}/)
  assert.match(conto, /data-pagamento className="flex items-baseline" style=\{\{ gap: 10, padding: '13px 0', borderBottom: `1px solid \$\{FILO_PAGAMENTI\}`, color: TESTO_PAGAMENTI \}\}/)
  assert.match(conto, /const FILO_PAGAMENTI = '#e8e0d3'/)
  assert.match(conto, /data-nota-pagamento/)
  assert.match(conto, /data-togli-pagamento=\{p\.id\} onClick=\{\(\) => onTogliPagamento\(p\.id\)\} className="ed-azione" style=\{AZIONE_TENUE\}>\{COMANDO_TOGLI\}/)
  assert.match(conto, /data-copertura-pagamenti style=\{\{ margin: '12px 0 22px', fontSize: 13, color: OTTONE_SCURO \}\}/)
  // «Come paga»: il modo, la frase in 13 px grigia, poi «Cambia come paga»
  assert.match(conto, /data-come-paga-riga style=\{\{ marginTop: 26, paddingTop: 17, borderTop: `1px solid \$\{FILO_BLOCCO\}` \}\}/)
  assert.match(conto, /data-come-paga-riga[\s\S]*\{TITOLO_COME_PAGA\}/)
  assert.match(conto, /\{accordo\.nome\}/)
  assert.match(conto, /margin: '5px 0', fontSize: 13, color: DESCRIZIONE \}\}>\{maiuscola\(accordo\.frase\)\}/)
  assert.equal(/>Accordo</.test(conto), false, '«Accordo» è ancora scritto nel conto')
  // il dettaglio: <details open>, titolo 14/600, righe delle camere 15 px sopra e sotto con la descrizione 13 px grigia
  assert.match(conto, /<details data-dettaglio-soggiorno open style=\{\{ marginTop: 28, borderTop: `1px solid \$\{FILO_BLOCCO\}`, paddingTop: 16 \}\}>/)
  assert.match(conto, /<summary data-apri-dettaglio style=\{\{ fontSize: 14, fontWeight: 600, cursor: 'pointer' \}\}>\{TITOLO_DETTAGLIO_SOGGIORNO\}<\/summary>/)
  assert.match(conto, /\{conto\.righe\.map\(r => \(/)
  assert.match(conto, /data-riga-conto=\{r\.chiave\} style=\{\{ padding: '15px 0', borderBottom: `1px solid \$\{FILO_CAMERE\}` \}\}/)
  assert.match(conto, /<small className="block" style=\{\{ fontSize: 13, color: DESCRIZIONE, marginTop: 3 \}\}>\{r\.dettaglio\}<\/small>/)
  // con lo sconto: prezzo pieno, sconto una volta sola, «Totale concordato»; senza: «Totale soggiorno». La cifra è quella autorevole
  assert.match(conto, /\{conto\.sconto && \([\s\S]{0,300}data-prezzo-pieno[\s\S]{0,400}data-sconto-riga/)
  assert.match(conto, /data-totale-dettaglio className=\{RIGA\} style=\{\{ padding: '14px 0 3px', fontWeight: 600 \}\}>\s*<span>\{conto\.totaleDettaglio\}<\/span>\s*<span style=\{MONETA\}>\{conto\.daPagare\}<\/span>/)
  // REGOLA FISSA n. 7 (Ania, 18/09/2026): sotto la cifra grande non c'è la riga
  // «2 notti · 80 € a notte», né nella scheda né nell'inserimento
  assert.equal(/sotto=\{/.test(conto), false, 'la scheda rimette la riga «notti · a notte» sotto «Da pagare»')
  assert.equal(/nottiANotte|conto\.sotto/.test(conto), false, 'la scheda rimette la riga «notti · a notte»')
  const contoNuova = leggi('components/nuova/ContoNuova.tsx')
  assert.match(contoNuova, /<DaPagareConto importo=\{euroGrande\(conto\.daPagare\)\}>/)
  assert.equal(/sotto=\{/.test(contoNuova), false, 'l’inserimento rimette la riga «notti · a notte» sotto «Da pagare»')
  // le righe condivise (inserimento e foglio del prezzo) restano come sono: la scheda non le tocca
  const righe = leggi('components/ContoRighe.tsx')
  assert.match(righe, /data-riga-conto=\{riga\.chiave\}[\s\S]{0,120}borderBottom: '1px solid var\(--color-card-border\)'/)
  assert.match(righe, /data-totale[\s\S]{0,200}borderTop: `1px solid \$\{FILO_OTTONE\}`/)
  assert.match(righe, /fontFamily: GEORGIA, fontSize: 22/)
  assert.match(righe, /data-sconto-riga[\s\S]{0,200}color: OTTONE/)
  assert.match(righe, /data-da-pagare[\s\S]{0,300}fontFamily: GEORGIA, fontSize: 28/)
  // il «da pagare» resta quello autorevole di contoPrenotazione: la pagina lo passa, non lo rifà
  assert.match(pagina, /const contoRighe = useMemo\(\(\) => \(conto \? contoScheda\(attive, conto\.totaleCent\) : null\), \[attive, conto\]\)/)
  // «Aggiungi pagamento» apre il foglio QUI (16/09/2026), non la scheda attuale
  assert.match(pagina, /onPagamento=\{\(\) => setFoglioPagamento\(true\)\}/)
  assert.equal(/azione=pagato`/.test(pagina), false, 'il pagamento porta ancora alla scheda vecchia')
})

// ── I MESSAGGI AL MOMENTO GIUSTO (punto 6, 21/09/2026) ─────────────────────
// La scelta (fase e ordine) sta in lib/messaggiFase ed è provata lì, facendo
// girare le funzioni. Qui restano le poche cose che solo il disegno può dire.
test('i messaggi (punto 6): conferma con immagine sempre in cima, larga quanto la scritta', () => {
  assert.match(messaggi, /import InterruttorePillola from '@\/components\/InterruttorePillola'/)
  assert.match(messaggi, /\['ania', 'WhatsApp Ania'\], \['business', 'Business'\]/)
  const pieno = messaggi.slice(messaggi.indexOf('data-conferma-immagine'), messaggi.indexOf('data-conferma-sempre'))
  // larga quanto la SCRITTA e centrata, non quanto la riga (Ania, 21/09/2026:
  // «fallo più corto sul computer ma anche nel cellulare»)
  assert.equal(/w-full/.test(pieno), false, 'la conferma con immagine non deve essere larga quanto la riga')
  assert.match(pieno, /inline-flex/)
  assert.match(messaggi, /<div className="text-center mt-3">\s*<button type="button" onClick=\{onConfermaImmagine\}/)
  assert.match(pieno, /background: 'var\(--color-green-mid\)', color: '#fff'/)
  assert.match(pieno, /\{TITOLO_CONFERMA\}/)
  assert.match(pieno, /<strong style=\{\{ fontWeight: 700 \}\}>\{SOTTOTITOLO_CONFERMA\}<\/strong>/)
  // apre la finestra vera dell'immagine, non un testo
  assert.match(messaggi, /onClick=\{onConfermaImmagine\}/)
  // e NON sta dentro «Tutti i messaggi»: sta sopra, fuori dal pannello
  assert.ok(messaggi.indexOf('data-conferma-immagine') < messaggi.indexOf('data-tutti-messaggi'),
    'la conferma con immagine non deve finire dentro «Tutti i messaggi»')
})

test('i messaggi (punto 6): «Utili adesso» in ottone, pastiglie sage a sinistra, «Tutti i messaggi» chiuso', () => {
  // l'etichetta dorata, 11 px con la spaziatura del disegno
  assert.match(messaggi, /data-utili-adesso[^\n]*fontSize: 11, letterSpacing: 1, color: 'var\(--color-brass\)'/)
  // i consigliati: una colonna, 9 px di spazio, testo a sinistra, alti 44
  assert.match(messaggi, /data-suggeriti className="grid mt-2" style=\{\{ gap: 9 \}\}/)
  assert.match(messaggi, /const TASTO_UTILE = \{ \.\.\.TASTO, minHeight: 44 \}/)
  assert.match(messaggi, /justify-start px-4/)
  assert.match(messaggi, /export const FONDO_TASTO = 'var\(--color-sage\)'/)
  assert.match(messaggi, /fontSize: 13,\s*fontWeight: 600,\s*borderRadius: 24,\s*minHeight: 38,/)
  // «Tutti i messaggi»: un <details> chiuso all'inizio (niente `open`), che si
  // apre da tastiera e col dito perché è un <summary> vero
  const tutti = messaggi.slice(messaggi.indexOf('data-tutti-messaggi'))
  assert.equal(/<details[^>]*\bopen\b/.test(messaggi), false, '«Tutti i messaggi» deve partire chiuso')
  assert.match(tutti, /<summary style=\{\{ fontSize: 14, fontWeight: 600 \}\}>\{TUTTI_I_MESSAGGI_TITOLO\}<\/summary>/)
  assert.match(tutti, /grid grid-cols-2 mt-3" style=\{\{ gap: 8 \}\}/)
  assert.match(tutti, /\{TUTTI_I_MESSAGGI\.map/, 'dentro il pannello ci sono TUTTI i messaggi')
  // l'annullamento conserva il tono mattone, ed è un messaggio: nessun comando
  assert.match(messaggi, /export const BORDO_ANNULLAMENTO = '#D9B3AC'/)
  assert.match(messaggi, /export const TESTO_ANNULLAMENTO = '#8C3B2E'/)
  assert.equal(/setFoglioAnnulla|status:\s*'annullata'/.test(messaggi), false,
    'il messaggio di annullamento non deve toccare stato o date')
  // il selettore «Prova anteprima» del disegno non entra nel gestionale: la
  // fase arriva dalle date, non si sceglie a mano
  assert.equal(/<select|onScegliFase|setFase/.test(messaggi), false, 'il selettore di fase era solo della dimostrazione')
})

test('la fase arriva dalla scheda, letta dalle date della prenotazione intera', () => {
  assert.match(pagina, /import \{ faseMessaggi, rigaPerMessaggi, statoPrenotazione \} from '@\/lib\/messaggiFase'/)
  // tutte le righe (non il solo tratto aperto) e il giorno di Roma già in pagina
  assert.match(pagina, /const faseSoggiorno = faseMessaggi\(righePrenotazione, oggi\)/)
  assert.match(pagina, /const righePrenotazione = righe\.length \? righe : booking \? \[booking\] : \[\]/)
  assert.match(pagina, /<MessaggiScheda className="mt-3" fase=\{faseSoggiorno\}/)
  // il componente non si calcola una fase sua e non guarda l'orologio
  assert.equal(/new Date\(|Date\.now/.test(messaggi), false, 'il componente dei messaggi guarda l’orologio')
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

// REGRESSIONE (secondo ricontrollo indipendente del 21/09/2026): i testi,
// l'immagine della conferma e la testa leggevano la riga dell'indirizzo, che
// può essere una camera ANNULLATA di una prenotazione viva. Il contenuto è
// provato in lib/messaggiFase.test; qui si tiene fermo il contratto della
// pagina, che è il punto in cui il difetto era nato.
test('messaggi, immagine e testa leggono la riga VIVA, mai quella dell’indirizzo', () => {
  assert.match(pagina, /import \{ faseMessaggi, rigaPerMessaggi, statoPrenotazione \} from '@\/lib\/messaggiFase'/)
  // la scelta si fa una volta sola, sulle righe intere
  assert.match(pagina, /const rigaViva = useMemo\(\(\) => rigaPerMessaggi\(righe, booking\), \[righe, booking\]\)/)
  assert.match(pagina, /const statoSoggiorno = useMemo\(\(\) => \(righe\.length \? statoPrenotazione\(righe, booking\)/)
  // i testi e l'immagine partono da lì, non da `booking`
  assert.match(pagina, /const perIMessaggi = \(\) => perMessaggio\(\{ \.\.\.rigaViva,/)
  assert.equal(/perMessaggio\(\{ \.\.\.booking/.test(pagina), false, 'i messaggi ripartono dalla riga dell’indirizzo')
  assert.match(pagina, /<ConfermaWhatsApp booking=\{perIMessaggi\(\) as never\} groupBookings=\{attive as never\}/)
  // i pagamenti restano TUTTI quelli della prenotazione (regola del conto unico)
  assert.match(pagina, /buildWhatsappMsg\(perIMessaggi\(\), tipo, attive, pagamenti\)/)
  // e la testa non usa più lo stato della riga aperta
  assert.match(pagina, /oggi=\{oggiTesta\(attive, oggi, statoSoggiorno\)\}/)
  assert.match(pagina, /residuoTesta\(riepilogo, stato\?\.tipo === 'bonifico_atteso', statoSoggiorno === 'annullata'\)/)
  assert.match(pagina, /statoScheda\(statoSoggiorno, ultimaPartenza, oggi\)/)
  // nessun pezzo della scheda decide più su booking.status: l'unico posto in
  // cui lo stato della riga aperta si legge ancora è la riserva dentro
  // statoSoggiorno, per i primi istanti in cui le altre righe non sono arrivate
  const righeConStato = pagina.split('\n').filter(r => /booking\??\.status/.test(r))
  assert.deepEqual(righeConStato.map(r => r.trim().startsWith('const statoSoggiorno')), righeConStato.map(() => true),
    `la scheda decide ancora sullo stato della riga aperta: ${righeConStato.join(' | ')}`)
  assert.equal(righeConStato.length, 1)
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
  assert.match(cliente, /data-chiedi-provenienza-cliente[^>]*className="ed-azione/)
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

test('i comandi in fondo (17/09/2026): «Nota e colore», poi l’annullamento in rosso; «Aggiungi camera» sta sotto la striscia', () => {
  const fondo = pagina.slice(pagina.indexOf('data-comandi-fondo'), pagina.indexOf('data-comandi-fondo') + 1200)
  assert.match(fondo, /data-nota-colore onClick=\{\(\) => setFoglioNota\(true\)\}[^>]*>\{COMANDO_NOTA\}/)
  assert.match(fondo, /color: '#8C3B2E' \}\}>Annulla prenotazione</)
  assert.equal(/Vedi tutto|Altre modifiche/.test(fondo), false, 'in fondo ci sono ancora i rimandi alla scheda vecchia')
  assert.ok(fondo.indexOf('COMANDO_NOTA') < fondo.indexOf('Annulla prenotazione'))
  assert.match(pagina, /data-aggiungi-camera onClick=\{aggiungiCamera\}/)
})

test('quanto ha già speso la cliente, in cima: in richieste e inserimento il rosso #D40000 (Ania, 17/09/2026); nella scheda il rosso del riferimento approvato (#b93e32, 20/09/2026 sera)', () => {
  const testa = leggi('components/TestaCliente.tsx')
  assert.match(testa, /const ROSSO_SPESO = '#D40000'/)
  assert.equal((testa.match(/data-totale-cliente[^\n]*color: ROSSO_SPESO/g) ?? []).length, 2)
  assert.match(testaScheda, /const ROSSO_STORICO = '#b93e32'/)
})

test('la striscia della scheda mostra le persone sotto ogni notte, e il letto acceso si vede (verde pieno)', () => {
  assert.match(pagina, /<StrisciaNottiCamere notti=\{l\.notti\} oggi=\{oggi\} spiegazione=\{false\}\n\s+ospitiAttesi=\{Math\.max\(1, \.\.\.l\.segmenti\.map\(s => Number\(s\.num_guests\) \|\| 1\)\)\}/)
  assert.match(striscia, /background: n\.letto \? 'var\(--color-green-mid\)' : '#fff'/)
  assert.match(striscia, /color: n\.letto \? 'var\(--color-cream\)' : '#C4C0B6'/)
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

// Dal 21/09/2026 la parte si chiama «Arrivo e navetta» e non è più una riga
// sola: sono due gruppi (BloccoArrivo), perché «In struttura circa 16–17» e
// «Arriva a Linate alle 15:00» devono stare scritti tutti e due, uno sopra
// l'altro, senza potersi scambiare di posto. L'ordine nella pagina non cambia.
test('l’ordine: Da controllare, poi la parte «Arrivo e navetta», poi il Soggiorno con strisce e tratti (Ania, 17/09/2026)', () => {
  const controllare = pagina.indexOf('id="controllare"'), arrivo = pagina.indexOf('id="arrivo"'), soggiorno = pagina.indexOf('id="soggiorno"')
  const riga = pagina.indexOf('<BloccoArrivo'), link = pagina.indexOf('<LinkSoggiorno'), striscia = pagina.indexOf('<StrisciaNottiCamere')
  assert.ok(controllare > 0 && controllare < arrivo && arrivo < riga && riga < link && link < soggiorno && soggiorno < striscia,
    `ordine sbagliato: controllare ${controllare}, arrivo ${arrivo}, riga ${riga}, link ${link}, soggiorno ${soggiorno}, striscia ${striscia}`)
  assert.match(pagina, /<p className="ed-sezione">Arrivo e navetta<\/p>/)
  // il giorno dell'arrivo resta sotto gli occhi, nell'etichettina
  assert.match(pagina, /etichettaArrivo=\{`Arrivo · \$\{arrivoTesto\.quando\}`\}/)
})

test('la parte «Arrivo e navetta» è quella del riferimento: due gruppi divisi da un filo, niente riquadro', () => {
  const blocco = leggi('components/scheda/BloccoArrivo.tsx')
  assert.match(pagina, /<BloccoArrivo etichettaArrivo=[\s\S]{0,60}arrivo=\{voceArrivo\} navetta=\{voceNavetta\} className="mt-3" \/>/)
  assert.match(pagina, /const voceArrivo = useMemo\(\(\) => arrivoInScheda\(arrivoDati\), \[arrivoDati\]\)/)
  assert.match(pagina, /const voceNavetta = useMemo\(\(\) => navettaInScheda\(arrivoDati\), \[arrivoDati\]\)/)
  // etichettina in ottone, titolo in Georgia 20, sottotitolo 13,5 stone
  assert.match(blocco, /fontSize: 9\.5, letterSpacing: '1\.4px', color: OTTONE/)
  assert.match(blocco, /fontFamily: GEORGIA, fontSize: 20, lineHeight: '25px', color: 'var\(--color-green-dark\)'/)
  assert.match(blocco, /borderTop: `1px solid \$\{FILO_RIQUADRO\}`/)
  // Il riquadro: scelta «B» di Ania del 21/09/2026 sera, presa guardando le
  // due versioni affiancate (regola fissa n. 10). È l'eccezione allo stile
  // del 06/09/2026, e il fondo è GRIGIO, non bianco.
  assert.match(blocco, /export const FONDO_RIQUADRO = '#F3F2EE'/)
  assert.match(blocco, /export const FILO_RIQUADRO = '#E3E0D8'/)
  assert.match(blocco, /background: FONDO_RIQUADRO, border: `1px solid \$\{FILO_RIQUADRO\}`, borderRadius: 12/)
  assert.equal(/background: '#fff'|background: 'white'/.test(blocco), false, 'il riquadro è bianco, doveva essere grigio')
  // il foglio si apre da «Modifica arrivo», come prima
  assert.equal(/aggiungi orario|AGGIUNGI_ORARIO/.test(soggiorno), false, 'c’è ancora «aggiungi orario»')
  assert.match(pagina, /onArrivo=\{\(\) => setFoglioArrivo\(true\)\}/)
})

test('sotto la striscia la riga «Cambia date · Cambio camera · Aggiungi camera» (Ania, 17/09/2026)', () => {
  const riga = pagina.slice(pagina.indexOf('data-comandi-linea'), pagina.indexOf('data-comandi-linea') + 1400)
  assert.ok(riga.indexOf('data-cambia-date') < riga.indexOf('data-cambio-camera') && riga.indexOf('data-cambio-camera') < riga.indexOf('data-aggiungi-camera'), 'ordine sbagliato')
  assert.match(riga, /data-cambio-camera=\{l\.chiave\} onClick=\{\(\) => setCambioAperto\(l\.chiave\)\}/)
  assert.match(riga, /i === linee\.length - 1 && statoSoggiorno !== 'annullata' && <>/)
  // «Aggiungi camera» non sta più in fondo
  const fondo = pagina.slice(pagina.indexOf('data-comandi-fondo'), pagina.indexOf('data-comandi-fondo') + 1200)
  assert.equal(/data-aggiungi-camera/.test(fondo), false)
  // il foglio: da quale notte, in quale camera, e «Fatto» salva come dalla striscia
  const foglio = leggi('components/scheda/FoglioCambioCamera.tsx')
  assert.match(foglio, /cambiaCameraDaLi\(notti, daNotte, camera, contesto\)/)
  assert.match(foglio, /camereDaLi\(notti, daNotte, contesto\)/)
  assert.match(pagina, /<FoglioCambioCamera notti=\{lineaCambio\.notti\} contesto=\{contestoLinea\(lineaCambio, linee, contesto\)\}/)
  assert.match(pagina, /onFatto=\{nuove => chiediPrezzoOSalva\(lineaCambio, nuove, \(\) => setCambioAperto\(null\)\)\}/)
})

test('«Cambia date» e «Cambio camera» si chiudono con «Salva» (Ania, 17/09/2026)', () => {
  assert.match(leggi('components/scheda/FoglioDate.tsx'), /export const FATTO_DATE = 'Salva'/)
  assert.match(leggi('components/scheda/FoglioCambioCamera.tsx'), /export const FATTO_CAMBIO = 'Salva'/)
})

test('«Togli camera» sotto la striscia, solo con più camere: annulla le righe della linea in un colpo, i pagamenti restano (Ania, 17/09/2026)', () => {
  const riga = pagina.slice(pagina.indexOf('data-comandi-linea'), pagina.indexOf('data-comandi-linea') + 2000)
  assert.match(riga, /\{siPuoTogliere\(linee\.length\) && <>[\s\S]{0,200}data-togli-camera=\{l\.chiave\} onClick=\{\(\) => setTogliAperto\(l\.chiave\)\}/)
  const foglio = leggi('components/scheda/FoglioTogliCamera.tsx')
  assert.match(foglio, /aggiornaInUnColpo\(ids, campi\)/)
  assert.match(foglio, /if \(esito\.incerto\) \{ onIncerto\(esito\.messaggio\); return \}/)
  assert.match(foglio, /<PiedeFoglio azione=\{TOGLI_LA_CAMERA\}[^\n]*onAnnulla=\{onChiudi\} mattone dati="togli-camera"/)
  assert.equal(/supabase/.test(foglio), false)
  assert.match(pagina, /<FoglioTogliCamera titolo=\{lineaDaTogliere\.titolo\} ids=\{lineaDaTogliere\.segmenti\.map\(s => s\.id\)\}/)
  assert.match(pagina, /const dove = schedaDopo\(booking\.id, ids, altre\)/)
  assert.match(pagina, /if \(dove\) \{ router\.replace\(`\/scheda\/\$\{dove\}`\); return \}/)
  // si annulla, mai si cancella
  assert.match(leggi('lib/togliCamera.ts'), /status: 'annullata', cancelled_at: adesso, cancelled_reason: MOTIVO_TOGLI_CAMERA/)
})
