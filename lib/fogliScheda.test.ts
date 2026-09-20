// ============================================================================
// I FOGLI DI MODIFICA DELLA SCHEDA NUOVA (16/09/2026) — le prove lette dai
// sorgenti: la veste comune, ogni foglio che si apre e si chiude dalla
// scheda, «Annulla» che non cambia niente, e cosa si aggiorna dopo ogni
// salvataggio. La logica pura ha i suoi test (pagamentoFoglio, annullamento,
// datiCliente…).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const pagina = leggi('app/scheda/[id]/page.tsx')
const foglio = leggi('components/scheda/Foglio.tsx')
const pezzi = leggi('components/nuova/PezziNuova.tsx')

// I fogli e il comando della scheda che li apre
const FOGLI: { file: string; stato: string; apre: RegExp }[] = [
  { file: 'FoglioPagamento', stato: 'foglioPagamento', apre: /onPagamento=\{\(\) => setFoglioPagamento\(true\)\}/ },
  { file: 'FoglioComePaga', stato: 'foglioComePaga', apre: /onComePaga=\{\(\) => setFoglioComePaga\(true\)\}/ },
  { file: 'FoglioArrivo', stato: 'foglioArrivo', apre: /onArrivo=\{\(\) => setFoglioArrivo\(true\)\}/ },
  { file: 'FoglioCliente', stato: 'foglioCliente', apre: /onModificaDati=\{\(\) => setFoglioCliente\(true\)\}/ },
  { file: 'FoglioCambiaCliente', stato: 'foglioCambiaCliente', apre: /onCambiaCliente=\{\(\) => setFoglioCambiaCliente\(true\)\}/ },
  { file: 'FoglioAnnulla', stato: 'foglioAnnulla', apre: /data-annulla-prenotazione onClick=\{\(\) => setFoglioAnnulla\(true\)\}/ },
  { file: 'FoglioSconto', stato: 'foglioSconto', apre: /onSconto=\{\(\) => setFoglioSconto\(true\)\}/ },
  { file: 'FoglioNota', stato: 'foglioNota', apre: /data-nota-colore onClick=\{\(\) => setFoglioNota\(true\)\}/ },
  { file: 'FoglioConLei', stato: 'foglioConLei', apre: /onConLei=\{\(\) => setFoglioConLei\(true\)\}/ },
]
// «Cambia date» si apre su UNA linea (lo stato porta la chiave): si prova a parte, sotto
// «Togli pagamento» si apre su UN pagamento (lo stato porta l'id): si prova a parte, sotto

// ── La veste comune ─────────────────────────────────────────────────────────
test('il foglio: dal basso, angoli 20 px, 22 px ai lati, titolo Georgia 20', () => {
  assert.match(foglio, /rounded-t-\[20px\] px-\[22px\]/)
  assert.match(foglio, /fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, lineHeight: '24px'/)
  assert.match(foglio, /ed-foglio/)   // fondo crema #FBF9F4 (app/globals.css)
  assert.match(leggi('app/globals.css'), /\.ed-foglio \{ background: #FBF9F4/)
  // il foglietto della notte resta in Georgia 18 (13/09/2026)
  assert.match(foglio, /fontSize: 18, lineHeight: '22px'/)
})

test('il piede: pastiglia verde alta 30 con testo 12, sotto «Annulla» in 13 stone, in mattone per l’annullamento', () => {
  assert.match(foglio, /export function PiedeFoglio/)
  assert.match(foglio, /export const ALTEZZA_AZIONE = 30/)
  assert.match(foglio, /height: ALTEZZA_AZIONE, borderRadius: 999, padding: '0 18px', fontSize: 12, fontWeight: 600/)
  assert.match(foglio, /background: mattone \? MATTONE_FOGLIO : 'var\(--color-green-mid\)'/)
  assert.match(foglio, /export const MATTONE_FOGLIO = '#8C3B2E'/)
  assert.match(foglio, /data-annulla-foglio onClick=\{onAnnulla\}[\s\S]{0,120}fontSize: 13, color: 'var\(--color-stone\)'/)
  assert.match(foglio, /export const TESTO_ANNULLA = 'Annulla'/)
  // «Annulla» chiama SOLO onAnnulla: il piede non sa niente di salvataggi
  assert.equal(/supabase|onAzione\(\)/.test(foglio), false)
})

test('i campi dei fogli: righe col filo card-border sotto, etichettina in ottone maiuscolo 9,5 px', () => {
  assert.match(pezzi, /padding: '8px 0', borderBottom: '1px solid var\(--color-card-border\)'/)
  assert.match(pezzi, /fontSize: 9\.5, letterSpacing: '1\.4px', color: ottone \? OTTONE : 'var\(--color-stone\)'/)
  assert.match(pezzi, /export const OTTONE = '#A9884E'/)
  // le pastiglie sono quelle della Home e dell'inserimento: alte 30
  assert.match(pezzi, /export const ALTEZZA_PASTIGLIA = 30/)
})

// ── Ogni foglio si apre dal suo comando e si chiude ─────────────────────────
for (const f of FOGLI) {
  const sorgente = leggi(`components/scheda/${f.file}.tsx`)
  test(`${f.file}: si apre dal comando della scheda, si chiude, e «Annulla» non cambia niente`, () => {
    assert.match(pagina, f.apre, `il comando non apre ${f.file}`)
    assert.match(pagina, new RegExp(`\\{${f.stato} && [\\s\\S]{0,120}<${f.file}`), `${f.file} non è in pagina sotto ${f.stato}`)
    assert.match(pagina, new RegExp(`<${f.file}[\\s\\S]{0,700}onChiudi=\\{\\(\\) => set${f.stato[0].toUpperCase()}${f.stato.slice(1)}\\(false\\)\\}`), `${f.file} non si chiude`)
    // la veste comune: Foglio e il suo piede
    assert.match(sorgente, /import Foglio, \{ PiedeFoglio \} from '\.\/Foglio'/)
    assert.match(sorgente, /<PiedeFoglio[\s\S]{0,300}onAnnulla=\{onChiudi\}/)
    // «Annulla» chiude e basta: onChiudi non scrive mai
    assert.equal(/onChiudi\(\)[^\n]*supabase|supabase[^\n]*onChiudi\(\)/.test(sorgente), false)
    assert.match(sorgente, /ottone/i, 'le etichettine del foglio non sono in ottone')
  })
}

// ── 1. AGGIUNGI PAGAMENTO ───────────────────────────────────────────────────
const pagamento = leggi('components/scheda/FoglioPagamento.tsx')
const pagamentiDati = leggi('lib/pagamentiDati.ts')

test('il pagamento (disegno approvato il 20/09/2026, punto 5): residuo in cima, Saldo completo / Altro importo, quanto resterà', () => {
  // il residuo in cima è quello del conto della scheda (contoPrenotazione), mai ricalcolato dai tratti
  assert.match(pagamento, /conto: ContoFoglio/)
  assert.match(pagina, /<FoglioPagamento booking=\{booking\} righe=\{righe\} conto=\{conto\}/)
  assert.equal(/saldoMancanteCent|contoPrenotazione\(/.test(pagamento), false, 'il foglio ricalcola il conto da sé')
  assert.match(pagamento, /const residuoCent = totaleCent - ricevutiCent/)
  assert.match(pagamento, /data-resta-da-incassare[\s\S]{0,200}\{RESTA_DA_INCASSARE\}[\s\S]{0,200}data-residuo-attuale[\s\S]{0,80}font: `26px \$\{GEORGIA\}`/)
  // i due tasti, e all'apertura con residuo positivo è scelto il saldo, col campo già scritto e in sola lettura
  assert.match(pagamento, /useState<ModoImporto>\(modoIniziale\(residuoCent\)\)/)
  assert.match(pagamento, /data-modo="saldo" aria-pressed=\{modo === 'saldo'\} disabled=\{nienteDaSaldare\} onClick=\{scegliSaldo\}/)
  assert.match(pagamento, /data-modo="altro" aria-pressed=\{modo === 'altro'\} onClick=\{scegliAltro\}/)
  assert.match(pagamento, /role="group" aria-label=\{GRUPPO_MODI\} className="grid grid-cols-2 gap-2"/)
  assert.match(pagamento, /type="text" inputMode="decimal"[^\n]*data-campo="importo" value=\{importo\} readOnly=\{modo === 'saldo'\}/)
  assert.match(pagamento, /\{modo === 'saldo' \? SPIEGA_SALDO : SPIEGA_ALTRO\}/)
  // «Altro importo» svuota il campo e ci porta il fuoco; «Saldo completo» riscrive il residuo; data, modo e nota non si toccano
  assert.match(pagamento, /function scegliAltro\(\) \{\s*setModo\('altro'\)\s*setImporto\(''\)\s*setErrore\(null\)\s*daFocalizzare\.current = true\s*\}/)
  assert.match(pagamento, /function scegliSaldo\(\) \{\s*if \(nienteDaSaldare\) return\s*setModo\('saldo'\)\s*setImporto\(importoProposto\(residuoCent\)\)\s*setErrore\(null\)\s*\}/)
  assert.match(pagamento, /campoImporto\.current\?\.focus\(\)/)
  assert.equal(/scegliAltro\(\) \{[\s\S]{0,200}(setGiorno|setMetodo|setNota)/.test(pagamento), false, 'cambiare modalità tocca data, metodo o nota')
  // quando su oggi (il vero campo data), Contanti · Bonifico (le vere pastiglie), nota
  assert.match(pagamento, /useState\(oggi\)/)
  assert.match(pagamento, /<CampoData etichetta=\{ETICHETTA_QUANDO\}[^\n]*ottone/)
  assert.match(pagamento, /useState<ModoPagamento>\(modoProposto\(bonifico\)\)/)
  assert.match(pagamento, /MODI_PAGAMENTO\.map/)
  assert.equal(/setMetodo\((?!m\.chiave)/.test(pagamento), false, 'il metodo cambia da solo con la modalità')
  assert.match(pagamento, /data-campo="nota"/)
  // in fondo: filo, «Dopo il pagamento resta» con la cifra prevista, l'esito, l'oltre in mattone, l'importo scritto male
  assert.match(pagamento, /const previsto = residuoPrevisto\(residuoCent, cent\)/)
  assert.match(pagamento, /<div aria-live="polite">/)
  assert.match(pagamento, /data-dopo-resta[\s\S]{0,200}borderTop: `1px solid \$\{FILO_RESIDUO\}`[\s\S]{0,120}\{DOPO_IL_PAGAMENTO_RESTA\}[\s\S]{0,120}data-residuo-previsto[\s\S]{0,80}font: `25px \$\{GEORGIA\}`/)
  assert.match(pagamento, /data-esito style=\{SPIEGA\}>\{previsto\.esito\}/)
  assert.match(pagamento, /data-oltre-il-dovuto[\s\S]{0,120}color: MATTONE/)
  assert.match(pagamento, /data-errore-importo[\s\S]{0,80}\{ERRORE_IMPORTO\}/)
  // senza importo valido non si salva: il tasto è spento (e oltre il dovuto NON si blocca)
  assert.match(pagamento, /<PiedeFoglio azione=\{SALVA_PAGAMENTO\} onAzione=\{salva\} salvando=\{salvando\} disabilitato=\{cent == null\}/)
  assert.equal(/oltre[^\n]*return/.test(pagamento), false, 'il foglio blocca l’importo oltre il dovuto')
  assert.match(foglio, /disabled=\{salvando \|\| disabilitato\}/)
  assert.match(foglio, /data-annulla-foglio onClick=\{onAnnulla\} disabled=\{salvando\}/)   // «Annulla» resta viva
  // le misure del riferimento: titolo Georgia 23, etichette 10 px / 1,3 px dorate, campi 16 px, tasti 13/600 angoli 8
  assert.match(pagamento, /<Foglio titolo=\{TITOLO_PAGAMENTO\} misuraTitolo=\{23\} onChiudi=\{onChiudi\}>/)
  assert.match(pagamento, /const ETICHETTA: CSSProperties = \{ fontSize: 10, letterSpacing: '1\.3px', color: '#9c814e' \}/)
  assert.match(pagamento, /const CAMPO: CSSProperties = \{ \.\.\.stileCampo, fontSize: 16, color: TESTO \}/)
  assert.match(pagamento, /fontSize: 13, fontWeight: 600, lineHeight: 1\.5, borderRadius: 8, padding: '12px 6px'/)
  assert.match(pagamento, /const VERDE_SCELTO = '#30674f'/)
  assert.match(pagamento, /const TESTO = '#30483b'/)
  assert.equal(/Arial|fonts\.googleapis|@import/.test(pagamento), false, 'caratteri nuovi nel foglio')
  // aprire il foglio o scegliere un tasto non scrive: si scrive solo in salva()
  assert.equal((pagamento.match(/registraPagamento\(/g) || []).length, 1, 'registraPagamento chiamato fuori da salva()')
  // il freno contro il doppio clic è sincrono (ref), non solo lo stato che si aggiorna al prossimo disegno
  assert.match(pagamento, /async function salva\(\) \{\s*if \(inCorso\.current \|\| salvando\) return/)
  assert.match(pagamento, /inCorso\.current = true\s*setSalvando\(true\)/)
  assert.match(pagamento, /finally \{\s*inCorso\.current = false\s*setSalvando\(false\)\s*\}/)
})

test('il conto cambiato mentre il foglio è aperto (punto 5): si rilegge TUTTO il conto prima di scrivere, niente scritto, cifre aggiornate qui e nella scheda', () => {
  // il foglio manda le cifre che mostra (totale e ricevuto) e, se il conto è cambiato, aggiorna e avvisa
  assert.match(pagamento, /registraPagamento\(booking, righe, \{ importo: cent \/ 100, metodo, giorno, nota \}, \{ totaleAttesoCent: totaleCent, ricevutiAttesiCent: ricevutiCent \}\)/)
  assert.match(pagamento, /if \(esito\.contoCambiato\) \{[\s\S]{0,400}aggiornaConto\(esito\.contoCambiato\.conto\)\s*onContoCambiato\?\.\(esito\.contoCambiato\)\s*return/)
  assert.match(pagamento, /setAvvisoConto\(CONTO_CAMBIATO\(nuovoResiduo\)\)/)
  assert.match(pagamento, /data-conto-cambiato/)
  // la scheda che rilegge da sé (totale o ricevuto) aggiorna il foglio aperto
  assert.match(pagamento, /\}, \[totaleDellaScheda, ricevutiDellaScheda\]\)/)
  // la scheda riceve camere, prenotazione e pagamenti riletti
  const dopo = pagina.slice(pagina.indexOf('onContoCambiato='), pagina.indexOf('onContoCambiato=') + 700)
  assert.match(dopo, /setRighe\(nuove\)/)
  assert.match(dopo, /setBooking\(b => \(b \? nuove\.find\(r => r\.id === b\.id\) \?\? b : b\)\)/)
  assert.match(dopo, /setPagamenti\(riletto\.pagamenti as unknown as PagamentoStat\[\]\)/)
  // in lib/pagamentiDati: la rilettura che precede la scrittura legge camere (con leggiPrenotazioneUnica) e pagamenti e fa il conto
  assert.match(pagamentiDati, /controllo\?: \{ totaleAttesoCent: number; ricevutiAttesiCent: number \}/)
  assert.match(pagamentiDati, /rileggiPagamenti: rileggiControllando/)
  assert.match(pagamentiDati, /const r = await leggiPrenotazioneUnica\(booking, f => supabase\.from\('bookings'\)\.select\('\*, rooms\(\*\)'\)\.eq\(f\.colonna, f\.valore\)\.order\('check_in'\)\)/)
  assert.match(pagamentiDati, /conto: contoPrenotazione\(r\.righe, pagamenti\)/)
  assert.match(pagamentiDati, /const totaleCambiato = adesso\.conto\.totaleCent !== Math\.round\(controllo\.totaleAttesoCent\)/)
  assert.match(pagamentiDati, /if \(totaleCambiato \|\| ricevutiCambiati\) \{ contoCambiato = adesso; return \{ data: null, error: new ErroreContoCambiato\(\) \} \}/)
  // il nostro pagamento pendente (risposta persa la volta prima) non è un incasso di un altro telefono
  assert.match(pagamentiDati, /const nostro = pendente && pendente\.amount === dati\.importo && pendente\.method === dati\.metodo && pendente\.paid_on === dati\.giorno \? Math\.round\(pendente\.amount \* 100\) : 0/)
  // le stesse cifre vanno alla funzione server (proposta 0057); senza la 0057 si richiama com'è oggi; CONTO_CAMBIATO dal server → rilettura e avviso
  assert.match(pagamentiDati, /p_totale_atteso: Math\.round\(controllo\.totaleAttesoCent\) \/ 100, p_ricevuti_attesi: Math\.round\(controllo\.ricevutiAttesiCent\) \/ 100/)
  assert.match(pagamentiDati, /if \(rpc\.error && controllo && rpcMancante\(rpc\.error, nomeRpc\)\) rpc = await supabase\.rpc\(nomeRpc, argomenti\)/)
  assert.match(pagamentiDati, /if \(rpc\.error && contoCambiatoDalServer\(rpc\.error\)\) \{ cambiatoDalServer = true; return \{ data: null, error: rpc\.error \} \}/)
  assert.match(pagamentiDati, /if \(cambiatoDalServer\) \{[\s\S]{0,300}const adesso = await rileggiConto\(\)/)
  // la proposta 0057 esiste con le sue prove, e NON è applicata (nessuna migrazione 0057)
  assert.match(leggi('supabase/proposte/0057_conto_atteso_pagamento.BOZZA.sql'), /p_totale_atteso numeric default null,\s*p_ricevuti_attesi numeric default null/)
  assert.match(leggi('supabase/proposte/0057_conto_atteso_pagamento.BOZZA.sql'), /message = 'CONTO_CAMBIATO'/)
  assert.equal(existsSync(new URL('../supabase/migrations/0057_conto_atteso_pagamento.sql', import.meta.url)), false, 'la 0057 risulta applicata: aggiorna le regole del foglio')
})

// ── 2. COME PAGA ────────────────────────────────────────────────────────────
test('«Come paga»: il componente già fatto coi sei modi, e «Salva» nel piede comune', () => {
  const comePaga = leggi('components/scheda/FoglioComePaga.tsx')
  assert.match(comePaga, /<Foglio titolo=\{TITOLO_COME_PAGA\} onChiudi=\{onChiudi\}>/)
  assert.match(comePaga, /<ComePaga modo=\{scelta\}[\s\S]{0,300}ottone \/>/)
  assert.match(comePaga, /<PiedeFoglio azione="Salva"/)
  assert.equal(/ed-pillola/.test(comePaga), false, 'i tasti vecchi sono ancora nel foglio')
  // i sei modi nei due gruppi stanno in un posto solo
  assert.match(leggi('lib/comePaga.ts'), /\{ id: 'arrivo', etichetta: 'Quando arriva', modi: \['contanti', 'bonifico', 'da_vedere'\] \}/)
  assert.match(leggi('lib/comePaga.ts'), /\{ id: 'prima', etichetta: 'Prima di arrivare', modi: \['tutto', 'meta', 'caparra'\] \}/)
})

test('dopo «Come paga» la testa e il conto si aggiornano: le righe portano il modo nuovo', () => {
  const dopo = pagina.slice(pagina.indexOf('<FoglioComePaga'), pagina.indexOf('<FoglioComePaga') + 1400)
  assert.match(dopo, /setRighe\(rs => rs\.map\(r => \(\{[\s\S]{0,80}accordo_pagamento: campi\.accordo_pagamento,\s*bonifico: campi\.bonifico/)
  assert.match(dopo, /setFoglioComePaga\(false\)/)
  // lo stato in testa («bonifico atteso») e la riga «Come paga» del conto leggono dalle righe
  assert.match(pagina, /const accordo = useMemo\(\(\) => accordoPrenotazione\(righe\) \?\? booking, \[righe, booking\]\)/)
  assert.match(pagina, /statoConto\(\{ totaleCent: conto\.totaleCent, ricevutiCent: conto\.ricevutiCent, pagato: righe\.some\(r => r\.pagato\), bonifico: accordo\?\.bonifico \}\)/)
  assert.match(pagina, /comePagaScheda\(accordoSalvato\?\.accordo_pagamento, accordo\?\.bonifico\)/)
})

// ── 6. ARRIVO ───────────────────────────────────────────────────────────────
test('«Arrivo»: l’ora con l’orologino davanti, la navetta No · Sì · ?, e «Salva»', () => {
  const arrivo = leggi('components/scheda/FoglioArrivo.tsx')
  assert.match(arrivo, /export const TITOLO_ARRIVO = 'Arrivo'/)
  assert.match(arrivo, /<Etichetta testo="A che ora arriva" primo ottone \/>/)
  assert.match(arrivo, /<RigaCampo etichetta="🕐 ora" ottone>/)
  assert.match(arrivo, /export const NAVETTE = \[\['no', 'No'\], \['si', 'Sì'\], \['', '\?'\]\] as const/)
  assert.match(arrivo, /<PiedeFoglio azione="Salva"/)
  // il salvataggio resta quello a esito controllato di lib/arrivoOrario
  assert.match(arrivo, /import \{ salvaOrarioENavetta \} from '@\/lib\/arrivoOrario'/)
  assert.match(arrivo, /onChange=\{e => setOraForm\(oraDigitata\(e\.target\.value\)\)\}/)
  // dopo il salvataggio la riga «Arrivo» e l'etichetta sotto la data si aggiornano dalle righe
  const dopo = pagina.slice(pagina.indexOf('<FoglioArrivo'), pagina.indexOf('<FoglioArrivo') + 700)
  assert.match(dopo, /setRighe\(rs => rs\.map\(aggiorna\)\)/)
  assert.match(dopo, /setFoglioArrivo\(false\)/)
})

// ── 3. DATI DELLA CLIENTE ───────────────────────────────────────────────────
test('«Dati della cliente»: lo stesso modulo dell’inserimento, e l’avviso che vale per tutti i soggiorni', () => {
  const cliente = leggi('components/scheda/FoglioCliente.tsx')
  const modulo = leggi('components/nuova/NuovoCliente.tsx')
  assert.match(cliente, /import NuovoCliente from '@\/components\/nuova\/NuovoCliente'/)
  assert.match(cliente, /<NuovoCliente dati=\{dati\}[\s\S]{0,200}titolo=\{null\} avanti=\{null\} etichetteOttone/)
  assert.match(cliente, /\{AVVISO_TUTTI_I_SOGGIORNI\}/)
  assert.match(leggi('lib/datiCliente.ts'), /AVVISO_TUTTI_I_SOGGIORNI = 'Questi dati sono della cliente: valgono per tutti i suoi soggiorni/)
  assert.match(cliente, /<PiedeFoglio azione="Salva"/)
  // il modulo: nome e cognome, telefono, ricevuta e valutazione sulla stessa riga, provenienza con le strutture, nota
  // nome e cognome SOLO col componente condiviso (regola fissa n. 1, 18/09/2026), poi il telefono
  assert.match(modulo, /<CampiNomeCognome nome=\{dati\.nome\} cognome=\{dati\.cognome\}[\s\S]{0,600}data-campo="telefono"/)
  assert.match(modulo, /<Etichetta testo="Ricevuta" centrata ottone=\{ottone\} \/>[\s\S]{0,600}<Etichetta testo="Valutazione" centrata ottone=\{ottone\} \/>/)
  assert.match(modulo, /\{PROVENIENZE\.map/)
  assert.match(modulo, /data-campo="note"/)
  // il modulo dell'inserimento non cambia: titolo e «Avanti» restano quelli di prima
  assert.match(modulo, /titolo = TITOLO_NUOVO_CLIENTE, avanti = AVANTI/)
})

test('i dati della cliente si scrivono su guests, e la scheda li aggiorna anche negli altri soggiorni', () => {
  const cliente = leggi('components/scheda/FoglioCliente.tsx')
  // si scrive sulla CLIENTE, mai sulla prenotazione
  assert.match(cliente, /supabase\.from\('guests'\)\.update\(m\.campi\)\.eq\('id', cliente\.id\)/)
  assert.equal(/from\('bookings'\)/.test(cliente), false)
  // con le regole già scritte: nomeCompleto, payloadValutazione, campiProvenienza (lib/datiCliente)
  const dati = leggi('lib/datiCliente.ts')
  assert.match(dati, /import \{ nomeDaSalvare, spezzaNome \} from '\.\/guestName\.ts'/)
  assert.match(dati, /payloadValutazione\(m\.valutazione, m\.ricevuta, o\.colonnaRicevuta\)/)
  assert.match(dati, /campiProvenienza\(m\.provenienza, m\.struttura\)/)
  // senza la colonna del motivo (0046) non si salva niente e lo si dice, come nella scheda cliente
  assert.match(cliente, /colonnaMancante\(esito\.error\) === 'motivo_problematico' \? ERRORE_MOTIVO_SENZA_0046/)
  // la scheda: questa riga, le altre camere, gli altri soggiorni già letti, poi la rilettura
  const dopo = pagina.slice(pagina.indexOf('<FoglioCliente'), pagina.indexOf('<FoglioCliente') + 1200)
  assert.match(dopo, /setBooking\(b => \(b \? aggiorna\(b\) : b\)\)/)
  assert.match(dopo, /setRighe\(rs => rs\.map\(aggiorna\)\)/)
  assert.match(dopo, /setAltreCliente\(as => as\.map/)
  assert.match(dopo, /setFoglioCliente\(false\)/)
  assert.match(dopo, /rileggi\(\)/)
})

// ── 4. CAMBIA CLIENTE ───────────────────────────────────────────────────────
test('«Cambia cliente»: la ricerca dell’inserimento, le righe 🧾 ★ nome · telefono · volte, «+ Nuovo cliente»', () => {
  const cambia = leggi('components/scheda/FoglioCambiaCliente.tsx')
  assert.match(cambia, /import CampoRicerca from '@\/components\/CampoRicerca'/)
  assert.match(cambia, /placeholder="Cerca per nome o telefono…"/)
  assert.match(cambia, /import RigaCliente, \{ TastinoSage, NUOVO_CLIENTE \} from '@\/components\/nuova\/RigaCliente'/)
  assert.match(cambia, /<RigaCliente key=\{c\.id\} cliente=\{c\} soggiorni=\{soggiorni\[c\.id\] \?\? 0\} onScegli=\{\(\) => setScelto\(c\)\}/)
  assert.match(cambia, /<TastinoSage testo=\{NUOVO_CLIENTE\} onClick=\{\(\) => setNuovo\(NUOVO_CLIENTE_VUOTO\)\}/)
  // il cliente nuovo: lo stesso modulo dell'inserimento, gli stessi campi
  assert.match(cambia, /<NuovoCliente dati=\{nuovo\}[\s\S]{0,200}titolo=\{null\} avanti=\{null\} etichetteOttone/)
  assert.match(cambia, /creaClienteNuovo\(campiNuovoCliente\(nuovo, strutture\.disponibile\)/)
  // la ricerca è quella già in casa, mai il cliente attuale, e le volte contano i soggiorni
  assert.match(cambia, /cercaClientiPerCambio\(testo, clienteAttuale\?\.id\)/)
  assert.match(leggi('lib/cambiaClienteDati.ts'), /export async function soggiorniConclusiDeiClienti/)
  assert.match(leggi('lib/cambiaClienteDati.ts'), /return soggiorniConclusi\(\(data \?\? \[\]\) as RigaSoggiorno\[\], oggi\)/)
  // e la riga dell'inserimento è la stessa: la pagina la importa da lì
  assert.match(leggi('app/nuova-prenotazione/page.tsx'), /import RigaCliente, \{ TastinoSage, NUOVO_CLIENTE, type ClienteRiga \} from '@\/components\/nuova\/RigaCliente'/)
})

test('scegliendo, una riga sola di conferma e poi «Cambia» con le scritture di sempre', () => {
  const cambia = leggi('components/scheda/FoglioCambiaCliente.tsx')
  assert.match(cambia, /data-riga-passaggio[\s\S]{0,200}\{rigaPassaggio\(nomeVecchio,/)
  assert.match(cambia, /<PiedeFoglio azione=\{nuovo \? 'Crea e cambia' : AZIONE_CAMBIA\}/)
  assert.match(cambia, /export const AZIONE_CAMBIA = 'Cambia'/)
  // le regole di lib/cambiaCliente: stesso cliente = niente, documenti che seguono la persona (spunta già attiva)
  assert.match(cambia, /if \(stessoCliente\(booking, cliente\.id\)\)/)
  assert.match(cambia, /const \[spostaDoc, setSpostaDoc\] = useState\(true\)/)
  assert.match(cambia, /scriviCambioCliente\(booking, cliente\.id/)
  assert.match(cambia, /spostaDocumenti\(documenti, clienteAttuale\.id, cliente\.id/)
  assert.equal(/from\('bookings'\)|from\('guests'\)/.test(cambia), false, 'il foglio scrive da solo sul database')
  // dopo: guest_id nuovo su tutte le righe, guest_name azzerato, poi la rilettura
  const dopo = pagina.slice(pagina.indexOf('<FoglioCambiaCliente'), pagina.indexOf('<FoglioCambiaCliente') + 1100)
  assert.match(dopo, /guest_id: cliente\.id, guest_name: null, guests: cliente/)
  assert.match(dopo, /setRighe\(rs => rs\.map\(aggiorna\)\)/)
  assert.match(dopo, /setFoglioCambiaCliente\(false\)/)
  assert.match(dopo, /rileggi\(\)/)
})

test('la riga di conferma: «La prenotazione passa da … a …»', async () => {
  const { rigaPassaggio } = await import('./cambiaCliente.ts')
  assert.equal(rigaPassaggio('Carmela Sabia', 'Anna Kowalska'), 'La prenotazione passa da Carmela Sabia a Anna Kowalska')
  assert.equal(rigaPassaggio('', null), 'La prenotazione passa da questo cliente a il cliente scelto')
})

// ── 5. ANNULLA LA PRENOTAZIONE ──────────────────────────────────────────────
const annulla = leggi('components/scheda/FoglioAnnulla.tsx')

test('«Annulla la prenotazione»: prima chi ha annullato (tre pastiglie), poi il motivo facoltativo, pastiglia in mattone e «Torna indietro»', () => {
  assert.match(annulla, /<Etichetta testo=\{DOMANDA_CHI\} primo ottone \/>/)
  assert.match(annulla, /\{CHI_ANNULLA\.map\(c => \(/)
  assert.match(annulla, /colore=\{MATTONE\}/)
  assert.match(annulla, /<RigaCampo etichetta=\{ETICHETTA_MOTIVO\} ottone/)
  assert.match(annulla, /<PiedeFoglio azione=\{AZIONE_ANNULLA\}[\s\S]{0,200}testoAnnulla=\{TORNA_INDIETRO\} mattone/)
  const lib = leggi('lib/annullamento.ts')
  assert.match(lib, /export const AZIONE_ANNULLA = 'Annulla la prenotazione'/)
  assert.match(lib, /export const TORNA_INDIETRO = 'Torna indietro'/)
  assert.match(lib, /export const ETICHETTA_MOTIVO = 'Motivo · può restare vuoto'/)
  // senza aver scelto chi, non si annulla
  assert.match(annulla, /if \(!chi\) \{ setErrore\(SCEGLI_CHI\); return \}/)
  // il comando in fondo alla scheda sparisce quando è già annullata
  assert.match(pagina, /\{booking\.status !== 'annullata' && <>/)
})

test('l’annullamento scrive come la scheda attuale, su tutte le righe attive, senza cancellare niente', () => {
  assert.match(annulla, /supabase\.from\('bookings'\)\.update\(campi\)\.eq\(f\.colonna, f\.valore\)\.neq\('status', 'annullata'\)\.select\('id'\)/)
  assert.match(annulla, /const f = filtroPrenotazione\(booking\)/)
  assert.match(annulla, /salvaAnnullamento\(/)
  assert.equal(/\.delete\(\)/.test(annulla), false, 'il foglio cancella una riga')
  // «Errore mio» sparisce dallo storico: lo decide lib/storicoCliente con la regola di lib/annullamento
  assert.match(leggi('lib/storicoCliente.ts'), /if \(!validi\.length && ordinati\.some\(s => sparisceDalloStorico\(s\.cancelled_reason\)\)\) continue/)
  // «Non si è presentata»: la proposta resta a schermo, col tasto che segna la cliente
  assert.match(annulla, /const p = cliente\?\.id \? propostaProblematica\(chi, nomeCliente\) : null/)
  assert.match(annulla, /payloadValutazione\('problematico', vuoleRicevuta\(cliente\), colonnaRicevutaPresente\(cliente\)\)/)
  assert.match(annulla, /motivo_problematico: motivoProblematicaNoShow\(arrivo\)/)
  assert.match(annulla, /<PiedeFoglio azione=\{SEGNA_PROBLEMATICA\}[\s\S]{0,160}testoAnnulla=\{LASCIA_COSI\}/)
  // dopo: le righe attive diventano annullate, la pastiglia in mattone in cima, la rilettura
  const dopo = pagina.slice(pagina.indexOf('<FoglioAnnulla'), pagina.indexOf('<FoglioAnnulla') + 1500)
  assert.match(dopo, /r\.status === 'annullata' \? r : \{ \.\.\.r, \.\.\.campi \}/)
  assert.match(dopo, /setAnnullata\(true\)/)
  assert.match(dopo, /rileggi\(\)/)
  assert.match(pagina, /data-annullata[\s\S]{0,300}background: FONDO_ANNULLATA, color: TESTO_ANNULLATA/)
  assert.match(leggi('lib/schedaPrenotazione.ts'), /export const TESTO_ANNULLATA = '#8C3B2E'/)
})

// ── Rilievi del 16/09/2026 ─────────────────────────────────────────────────
test('anche «Arrivo» e «Come paga» rileggono la scheda dopo il salvataggio (cronologia)', () => {
  const arrivo = pagina.slice(pagina.indexOf('<FoglioArrivo'), pagina.indexOf('<FoglioArrivo') + 800)
  assert.match(arrivo, /setFoglioArrivo\(false\)[\s\S]{0,120}rileggi\(\)/)
  const comePaga = pagina.slice(pagina.indexOf('<FoglioComePaga'), pagina.indexOf('<FoglioComePaga') + 1500)
  assert.match(comePaga, /setFoglioComePaga\(false\)[\s\S]{0,120}rileggi\(\)/)
})

test('con una lettura incompleta niente conto e niente pagamenti da qui', () => {
  assert.match(pagina, /const \[contoLeggibile, setContoLeggibile\] = useState\(true\)/)
  assert.match(pagina, /setContoLeggibile\(!conto\.errore && !pag\.error\)/)
  assert.match(pagina, /if \(!contoLeggibile\) return null/)
  assert.match(pagina, /\{foglioPagamento && conto && \(/)
})

// ── 7. SCONTO (17/09/2026) ──────────────────────────────────────────────────
const sconto = leggi('components/scheda/FoglioSconto.tsx')
const scontoDati = leggi('lib/scontoDati.ts')

test('«Sconto»: il comando nel conto, tre pastiglie Nessuno · Percentuale · Prezzo finale, il campo, e i tre numeri prima di salvare', () => {
  const conto = leggi('components/scheda/ContoScheda.tsx')
  assert.match(conto, /data-modifica-sconto onClick=\{onSconto\}/)
  assert.match(conto, /\{COMANDO_SCONTO\}/)
  assert.match(sconto, /TIPI_SCONTO\.map\(t => \([\s\S]{0,200}dati=\{`sconto-\$\{t\.chiave\}`\}/)
  assert.match(sconto, /tipo === 'percentuale' \? ETICHETTA_PER_CENTO : ETICHETTA_IN_TUTTO/)
  assert.match(sconto, /data-campo="sconto"/)
  assert.match(sconto, /data-anteprima-sconto/)
  assert.match(sconto, /data-riga-anteprima=\{n\.chiave\}/)
  assert.match(sconto, /righeAnteprima\(anteprima\)/)
  // i numeri arrivano dalla libreria pura, coi pagamenti già registrati
  assert.match(sconto, /anteprimaSconto\(righe, ricevutiCent, sconto\)/)
  assert.match(pagina, /<FoglioSconto righe=\{righe\} ricevutiCent=\{conto\.ricevutiCent\}/)
  // «Salva» nel piede comune, con l'errore vicino
  assert.match(sconto, /<PiedeFoglio azione=\{SALVA_SCONTO\} onAzione=\{salva\} salvando=\{salvando\} onAnnulla=\{onChiudi\} dati="sconto"/)
})

test('lo sconto si scrive riga per riga con la regola della scheda attuale, e senza cambiamenti non scrive', () => {
  // la scrittura: discount_type/discount_value/total_amount su ogni camera attiva, con controllo della riga toccata
  const righeScrittura = leggi('lib/righeScrittura.ts')
  assert.match(scontoDati, /return aggiornaRigaPerRiga\(/)
  assert.match(righeScrittura, /client\.from\('bookings'\)[\s\S]{0,120}\.update\(\{ \.\.\.r\.campi, updated_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]{0,60}\.eq\('id', r\.id\)[\s\S]{0,40}\.select\('id'\)/)
  assert.match(righeScrittura, /risposta\.data\.length !== 1/)
  assert.match(righeScrittura, /ERRORE_SALVATO_A_META/)
  // il foglio non scrive da sé: solo salvaSconto, e solo se c'è qualcosa da cambiare
  assert.equal(/supabase/.test(sconto), false)
  assert.match(sconto, /if \(nienteDaSalvare\(righe, anteprima\)\) \{ onSalvato\(anteprima, false\); return \}/)
  assert.match(sconto, /if \(salvando\) return/)
  // togliere lo sconto = discount null e totale al prezzo pieno (rimuoviScontoDiretto della scheda attuale)
  const lib = leggi('lib/scontoScheda.ts')
  assert.match(lib, /contoSoggiorno\(\{ check_in: r\.check_in, check_out: r\.check_out, price_per_night: r\.price_per_night, extra_bed_total: r\.extra_bed_total \}\)\.totale/)
})

test('dopo lo sconto il conto si aggiorna riga per riga e la scheda rilegge; con errore niente falso «salvato»', () => {
  const dopo = pagina.slice(pagina.indexOf('<FoglioSconto'), pagina.indexOf('<FoglioSconto') + 1200)
  assert.match(dopo, /if \(!cambiato\) return/)
  assert.match(dopo, /setRighe\(rs => rs\.map\(aggiorna\)\)/)
  assert.match(dopo, /setBooking\(b => \(b \? aggiorna\(b\) : b\)\)/)
  assert.match(dopo, /SCONTO_SALVATO : SCONTO_TOLTO/)
  assert.match(dopo, /rileggi\(\)/)
  assert.match(sconto, /if \(esito\.esito === 'errore'\) \{\n\s+\/\/[^\n]*\n\s+if \(esito\.incerto\) \{ onIncerto\(esito\.messaggio\); return \}\n\s+setErrore\(esito\.messaggio\)\n\s+return\n\s+\}/)
})

// ── 8. TOGLI PAGAMENTO (17/09/2026) ─────────────────────────────────────────
const togli = leggi('components/scheda/FoglioTogliPagamento.tsx')

test('«togli» accanto a ogni pagamento apre il foglio di conferma: importo, giorno e modo, quanto resta, bollino via', () => {
  const conto = leggi('components/scheda/ContoScheda.tsx')
  assert.match(conto, /data-togli-pagamento=\{p\.id\} onClick=\{\(\) => onTogliPagamento\(p\.id\)\}/)
  assert.match(conto, /\{COMANDO_TOGLI\}/)
  assert.match(pagina, /onTogliPagamento=\{id => setPagamentoDaTogliere\(id\)\}/)
  assert.match(pagina, /\{pagamentoDaTogliere && conto && \(\(\) => \{[\s\S]{0,300}<FoglioTogliPagamento pagamento=\{p\} righe=\{righe\} totaleCent=\{conto\.totaleCent\} ricevutiCent=\{conto\.ricevutiCent\}/)
  assert.match(pagina, /<FoglioTogliPagamento[\s\S]{0,300}onChiudi=\{\(\) => setPagamentoDaTogliere\(null\)\}/)
  // la veste comune, in mattone perché si toglie qualcosa, e «Annulla» che chiude e basta
  assert.match(togli, /import Foglio, \{ PiedeFoglio, GEORGIA_FOGLIO \} from '\.\/Foglio'/)
  assert.match(togli, /<PiedeFoglio azione=\{TOGLI_PAGAMENTO\} onAzione=\{togli\} salvando=\{togliendo\}[^\n]*onAnnulla=\{onChiudi\} mattone dati="togli-pagamento"/)
  assert.equal(/supabase/.test(togli), false)
  assert.match(togli, /data-importo-da-togliere/)
  assert.match(togli, /data-quando-da-togliere/)
  assert.match(togli, /data-resta-senza[^>]*>\{resta\}/)
  assert.match(togli, /\{bollinoVia && <p data-bollino-via/)
  // due tocchi di fila non tolgono due volte: lo stato E il riferimento (i due
  // tocchi arrivano prima che lo stato si aggiorni)
  assert.match(togli, /if \(togliendo \|\| inCorso\.current\) return\n\s+inCorso\.current = true/)
})

test('togliere scrive come «rimuovi» della scheda attuale, controlla la riga toccata, rilegge e toglie il bollino se serve', () => {
  assert.match(pagamentiDati, /supabase\.from\('payments'\)\.delete\(\)\.eq\('id', pagamentoId\)\.select\('id'\)/)
  assert.match(pagamentiDati, /if \(cancellate\.length !== 1\) return \{ esito: 'errore', messaggio: ERRORE_PAGAMENTO_NON_TROVATO \}/)
  assert.match(pagamentiDati, /saldoMancanteCent\(segmenti, pagamenti\) > 0/)
  assert.match(pagamentiDati, /update\(\{ pagato: false \}\)\.in\('id', ids\)\.select\('id'\)/)
  assert.match(pagamentiDati, /\(data\?\.length \?\? 0\) !== ids\.length\) avviso = avviso \?\? AVVISO_BOLLINO_NON_TOLTO/)
  // la scheda vecchia fa la stessa cancellazione
  assert.match(leggi('app/prenotazioni/[id]/page.tsx'), /supabase\.from\('payments'\)\.delete\(\)\.eq\('id', pid\)/)
  // dopo: pagamenti rimasti, bollino, avviso, rilettura
  const dopo = pagina.slice(pagina.indexOf('<FoglioTogliPagamento'), pagina.indexOf('<FoglioTogliPagamento') + 1000)
  assert.match(dopo, /setPagamenti\(esito\.pagamenti as unknown as PagamentoStat\[\]\)/)
  assert.match(dopo, /if \(!esito\.pagato\) \{[\s\S]{0,120}pagato: false/)
  assert.match(dopo, /setAvviso\(esito\.avviso \?\? PAGAMENTO_TOLTO\)/)
  assert.match(dopo, /rileggi\(\)/)
  // con errore niente falso «tolto»
  assert.match(togli, /if \(esito\.esito === 'errore'\) \{ inCorso\.current = false; setErrore\(esito\.messaggio\); return \}/)
})

// ── 9. NOTA E COLORE · CON LEI · EMAIL (17/09/2026) ─────────────────────────
test('«Nota e colore»: la nota della prenotazione, i colori del calendario, da dove è arrivata; si scrive su tutte le camere', () => {
  const nota = leggi('components/scheda/FoglioNota.tsx')
  assert.match(nota, /data-campo="nota"/)
  assert.match(nota, /COLORI_CALENDARIO\.map\(c => \{[\s\S]{0,300}data-colore=\{c\.valore \|\| 'auto'\}/)
  assert.match(nota, /ARRIVATA_DA\.map\(a => \([\s\S]{0,200}dati=\{`arrivata-\$\{a\.chiave\}`\}/)
  assert.match(nota, /aggiornaInUnColpo\(ids, campi\)/)
  assert.match(nota, /if \(nienteDaCambiare\(modulo, booking\)\) \{ onSalvato\(campi, ids, false\); return \}/)
  assert.equal(/supabase/.test(nota), false)
  const dopo = pagina.slice(pagina.indexOf('<FoglioNota'), pagina.indexOf('<FoglioNota') + 700)
  assert.match(dopo, /ids\.includes\(r\.id\) \? \{ \.\.\.r, \.\.\.campi \} : r/)
  assert.match(dopo, /rileggi\(\)/)
})

test('«Con lei» dalla scheda: lo stesso pezzo dell’inserimento, tutte e sei le colonne, senza la 0056 si salva il resto', () => {
  const conLei = leggi('components/scheda/FoglioConLei.tsx')
  assert.match(conLei, /import ConLei from '@\/components\/nuova\/ConLei'/)
  assert.match(conLei, /<ConLei persone=\{persone\}[\s\S]{0,200}senzaTitolo etichetteOttone/)
  assert.match(conLei, /campiConLeiCompleti\(persone\)/)
  assert.match(conLei, /colonnaMancante\(esito\.errore as [^)]*\) === 'chi_e_2'/)
  assert.match(conLei, /AVVISO_CHI_E_2_SENZA_0056/)
  assert.match(leggi('components/scheda/ClienteScheda.tsx'), /data-con-lei-comando onClick=\{onConLei\}/)
})

test('l’email della cliente sta nel modulo di sempre (inserimento e scheda), e può restare vuota', () => {
  const modulo = leggi('components/nuova/NuovoCliente.tsx')
  assert.match(modulo, /<RigaCampo etichetta="Email · può restare vuota" ottone=\{ottone\}>[\s\S]{0,200}data-campo="email"/)
  assert.match(modulo, /email: '',/)
  assert.match(leggi('lib/datiCliente.ts'), /email: m\.email\.trim\(\) \|\| null,/)
})

// ── 10. NIENTE «TARIFFE» · CAMBIA DATE · AGGIUNGI CAMERA ────────────────────
// REGOLA FISSA n. 6 (Ania, 18/09/2026: «togli tariffe dalla prenotazione, il
// prezzo della camera non deve cambiare mai»): il foglio «Tariffe» del
// 17/09 non c'è più. Il prezzo a notte è il listino; cambia solo lo sconto.
test('nella scheda non c’è il comando «Tariffe»: il prezzo della camera non si cambia mai', () => {
  const conto = leggi('components/scheda/ContoScheda.tsx')
  assert.equal(/onTariffe|data-modifica-tariffe|tariffaScheda|>Tariffe</.test(conto), false, 'è tornato il comando «Tariffe» nel conto')
  assert.equal(/FoglioTariffa|foglioTariffe|tariffaScheda/.test(pagina), false, 'la scheda apre ancora il foglio «Tariffe»')
  assert.equal(existsSync(new URL('../components/scheda/FoglioTariffa.tsx', import.meta.url)), false, 'components/scheda/FoglioTariffa.tsx esiste ancora')
  assert.equal(existsSync(new URL('./tariffaScheda.ts', import.meta.url)), false, 'lib/tariffaScheda.ts esiste ancora')
  // i comandi del conto sono questi, e basta: «Aggiungi pagamento» e «Sconto» sotto il residuo, «Cambia come paga» sotto «Come paga» (20/09/2026 sera)
  assert.match(conto, /data-aggiungi-pagamento[\s\S]{0,300}data-modifica-sconto[\s\S]{0,2500}data-cambia-come-paga[^>]*>Cambia come paga</)
})

test('«Cambia date» sotto ogni striscia: arrivo e partenza, l’effetto sul conto, e «Fatto» salva come dalla striscia', () => {
  const date = leggi('components/scheda/FoglioDate.tsx')
  assert.match(pagina, /data-cambia-date=\{l\.chiave\} onClick=\{\(\) => setDateAperte\(l\.chiave\)\}/)
  assert.match(pagina, /\{dateAperte && lineaDate && \([\s\S]{0,80}<FoglioDate notti=\{lineaDate\.notti\} contesto=\{contestoLinea\(lineaDate, linee, contesto\)\}/)
  // «Salva» passa da chiediPrezzoOSalva: col prezzo finale concordato prima si chiede come aggiornare il prezzo (17/09/2026)
  assert.match(pagina, /onFatto=\{nuove => chiediPrezzoOSalva\(lineaDate, nuove, \(\) => setDateAperte\(null\)\)\}/)
  assert.match(pagina, /onChiudi=\{\(\) => setDateAperte\(null\)\}/)
  assert.match(date, /<CampoData etichetta="Arrivo" valore=\{arrivo\}[^\n]*dati="arrivo" ottone/)
  assert.match(date, /<CampoData etichetta="Partenza" valore=\{partenza\}[^\n]*dati="partenza" ottone/)
  assert.match(date, /nottiConDate\(notti, arrivo, partenza, contesto\)/)
  assert.match(date, /data-conto-dopo/)
  // con un guaio (una notte senza camera libera) «Fatto» non fa niente
  assert.match(date, /if \(dateBuone && !\(conto && conto\.guaio\)\) onFatto\(bozza\)/)
  assert.equal(/supabase/.test(date), false)
  assert.match(date, /import Foglio, \{ PiedeFoglio \} from '\.\/Foglio'/)
})

test('«Aggiungi camera»: prima il legame fra le camere se manca, poi l’inserimento nuovo con cliente, date e legame', () => {
  assert.match(pagina, /const legame = legameDaScrivere\(righe, \(\) => crypto\.randomUUID\(\)\)/)
  assert.match(pagina, /aggiornaInUnColpo\(legame\.ids, \{ prenotazione_id: legame\.prenotazioneId \}\)/)
  assert.match(pagina, /router\.push\(hrefAggiungiCamera\(\{ guestId: booking\.guest_id, prenotazioneId: legame\.prenotazioneId, arrivo: primoArrivo, partenza: ultimaPartenza \}\)\)/)
  // l'inserimento nuovo: stesso legame, come paga e caparra non si toccano
  const nuova = leggi('app/nuova-prenotazione/page.tsx')
  assert.match(nuova, /if \(p\.prenotazione\) setAggiungoA\(\{ prenotazione: p\.prenotazione, guestId: p\.guestId \}\)/)
  assert.match(nuova, /const prenotazioneId = aggiungoA\?\.prenotazione \?\? crypto\.randomUUID\(\)/)
  assert.match(nuova, /\.\.\.\(aggiungoA \? \{\} : \{ accordo_pagamento: pagamento\.accordo_pagamento \}\),/)
  assert.match(nuova, /p\.id === primo && !aggiungoA \? \{ caparra_centesimi/)
  assert.match(nuova, /\{aggiungoA\s*\? <p data-aggiungo-a[^>]*>\{AVVISO_AGGIUNTA\}<\/p>\s*: <section data-come-paga-parte/)
})

// ── 11. SCRITTURE A METÀ E RISPOSTE PERSE (revisione del 17/09/2026) ────────
test('una scrittura incerta (a metà, o senza risposta) fa rileggere la scheda e nasconde il conto finché non ha riletto', () => {
  const righeScrittura = leggi('lib/righeScrittura.ts')
  // la risposta persa (il client PostgREST NON lancia: {error, status: 0}) è incerta,
  // come una riga sì e una no; un rifiuto del server alla prima riga no
  assert.match(righeScrittura, /const incerto = persa \|\| scritte > 0/)
  assert.match(righeScrittura, /if \(status === 0 \|\| status === 502 \|\| status === 503 \|\| status === 504\) return true/)
  assert.match(righeScrittura, /ERRORE_RIGA_NON_TROVATA, scritte, incerto: true/)
  // gli stessi campi su più righe vanno in una richiesta sola (o tutte o nessuna)
  assert.match(righeScrittura, /export async function aggiornaInUnColpo/)
  assert.match(righeScrittura, /\.update\(\{ \.\.\.campi, updated_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]{0,40}\.in\('id', ids\)[\s\S]{0,40}\.select\('id'\)/)
  assert.match(righeScrittura, /if \(toccate !== ids\.length\) return \{ esito: 'errore', messaggio: ERRORE_RIGA_NON_TROVATA, scritte: toccate, incerto: true \}/)
  // il client dell'app entra da lib/righeDati; la logica è provata col client PostgREST vero (lib/righeScrittura.test.ts)
  assert.match(leggi('lib/righeDati.ts'), /const client = supabase as unknown as ClienteRighe/)
  for (const f of ['FoglioSconto', 'FoglioNota', 'FoglioConLei']) {
    const src = leggi(`components/scheda/${f}.tsx`)
    assert.match(src, /\.incerto\) \{ onIncerto\(\w+\.messaggio\); return \}/, `${f} non avvisa la scheda della scrittura incerta`)
    assert.match(pagina, new RegExp(`<${f}[\\s\\S]{0,200}onIncerto=\\{invalida\\}`), `${f} non riceve invalida`)
  }
  assert.match(leggi('components/scheda/FoglioNota.tsx'), /aggiornaInUnColpo\(ids, campi\)/)
  assert.match(leggi('components/scheda/FoglioConLei.tsx'), /aggiornaInUnColpo\(ids, campi\)/)
  // la scheda: niente conto finché non ha riletto tutto; dopo una rilettura fallita resta nascosto
  assert.match(pagina, /const invalida = \(messaggio: string\) => \{\n\s+setAvviso\(messaggio\)\n\s+setContoLeggibile\(false\)\n\s+setFoglioSconto\(false\); setFoglioNota\(false\); setFoglioConLei\(false\)\n\s+rileggi\(\)/)
  const daLetture = pagina.indexOf('const [pag, altre, vicine, doc, stanze] = await Promise.all')
  assert.match(pagina.slice(daLetture, daLetture + 1800), /setContoLeggibile\(!conto\.errore && !pag\.error\)/, 'il conto deve tornare solo dopo camere E pagamenti riletti')
  assert.equal((pagina.match(/setContoLeggibile\(/g) ?? []).length, 2, 'setContoLeggibile: solo invalida e la lettura completa')
  assert.equal(/setContoLeggibile\(true\)/.test(pagina), false)
  // se la lettura delle camere fallisce si esce prima (setErrore) e il conto resta nascosto
  assert.match(pagina, /if \(error \|\| !b\) \{ setBooking\(null\); setErrore\(/)
})

test('«Aggiungi camera»: il legame su TUTTE le righe (annullate comprese) in una richiesta sola; l’inserimento tiene ferma la cliente e ricontrolla il legame', () => {
  assert.match(pagina, /const esito = await aggiornaInUnColpo\(legame\.ids, \{ prenotazione_id: legame\.prenotazioneId \}\)/)
  assert.match(pagina, /if \(esito\.incerto\) invalida\(esito\.messaggio\); else setAvviso\(esito\.messaggio\)/)
  const lib = leggi('lib/aggiungiCamera.ts')
  assert.match(lib, /ids: righe\.filter\(r => r\.prenotazione_id !== prenotazioneId\)\.map\(r => r\.id\)/)
  const nuova = leggi('app/nuova-prenotazione/page.tsx')
  assert.match(nuova, /\{!aggiungoA && \(\s*<button type="button" data-cambia-cliente/)
  assert.match(nuova, /if \(aggiungoA\.guestId && cliente\.id !== aggiungoA\.guestId\) \{ setGuai\(\[CLIENTE_DIVERSO\]\)/)
  assert.match(nuova, /\.select\('id, guest_id, status'\)\.eq\('prenotazione_id', aggiungoA\.prenotazione\)/)
  assert.match(nuova, /if \(legame\.error \|\| !legameConfermato\(legame\.data, cliente\.id\)\) \{ setGuai\(\[LEGAME_NON_CONFERMATO\]\)/)
})
