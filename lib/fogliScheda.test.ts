// ============================================================================
// I FOGLI DI MODIFICA DELLA SCHEDA NUOVA (16/09/2026) — le prove lette dai
// sorgenti: la veste comune, ogni foglio che si apre e si chiude dalla
// scheda, «Annulla» che non cambia niente, e cosa si aggiorna dopo ogni
// salvataggio. La logica pura ha i suoi test (pagamentoFoglio, annullamento,
// datiCliente…).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
]
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

test('il pagamento: quanto già scritto, quando su oggi, Contanti · Bonifico, nota, e quanto resta in ottone', () => {
  assert.match(pagamento, /useState\(importoProposto\(manca\)\)/)
  assert.match(pagamento, /useState\(oggi\)/)
  assert.match(pagamento, /<CampoData etichetta=\{ETICHETTA_QUANDO\}[^\n]*ottone/)
  assert.match(pagamento, /MODI_PAGAMENTO\.map/)
  assert.match(pagamento, /data-campo="nota"/)
  assert.match(pagamento, /data-resta-dopo style=\{\{ marginTop: 12, fontSize: 12\.5, color: OTTONE \}\}/)
  assert.match(pagamento, /data-oltre-il-dovuto[\s\S]{0,120}color: MATTONE/)
  assert.match(pagamento, /<PiedeFoglio azione=\{SALVA_PAGAMENTO\}/)
  // oltre il dovuto non si blocca: l'unico controllo è l'importo sopra lo zero (e il giorno)
  assert.equal(/oltre[^\n]*return/.test(pagamento), false, 'il foglio blocca l’importo oltre il dovuto')
})

test('il pagamento si salva col contratto unico dei movimenti, e il bollino «pagato» arriva da sé', () => {
  assert.match(pagamento, /import \{ registraPagamento, righePerSaldo/)
  assert.equal(/supabase/.test(pagamento), false, 'il foglio parla col database da solo')
  assert.match(pagamentiDati, /import \{\s*eseguiRegistraAcconto, eseguiSegnaPagato, rpcMancante, validaEsitoSegnaPagato, ErroreRispostaMalformata, saldoMancanteCent/)
  assert.match(pagamentiDati, /ca_acconto_pendente_\$\{chiave\}/)
  assert.match(pagamentiDati, /ca_pagato_chiave_\$\{chiave\}/)
  assert.match(pagamentiDati, /'registra_acconto_prenotazione' : 'registra_acconto'/)
  assert.match(pagamentiDati, /'segna_pagato_prenotazione' : 'segna_pagato'/)
  assert.match(pagamentiDati, /if \(!pagato && saldoMancanteCent\(segmenti, pagamenti\) <= 0\)/)
  // un tratto annullato non è più dovuto, ma il suo incasso resta nel conto
  assert.match(pagamentiDati, /r\.status === 'annullata' \? \{ \.\.\.r, total_amount: 0 \} : r/)
  // la nota: dopo, sulla riga nata; senza la colonna (0055) lo si dice
  assert.match(pagamentiDati, /update\(\{ note: nota \}\)\.eq\('id', movimentoId\)/)
  assert.match(pagamentiDati, /colonnaMancante\(n\.error\) === 'note' \? AVVISO_NOTA_SENZA_0055/)
  assert.match(leggi('supabase/proposte/0055_nota_pagamento.BOZZA.sql'), /alter table public\.payments add column if not exists note text/)
})

test('dopo il pagamento il conto e la cronologia si aggiornano, senza ricaricare la pagina', () => {
  const dopo = pagina.slice(pagina.indexOf('<FoglioPagamento'), pagina.indexOf('<FoglioPagamento') + 1200)
  assert.match(dopo, /setPagamenti\(nuovi\)/)                       // il conto: contoPrenotazione(righe, pagamenti) si rifà da solo
  assert.match(dopo, /setRighe\(rs => rs\.map\(r => \(\{ \.\.\.r, pagato: true \}\)\)\)/)
  assert.match(dopo, /setFoglioPagamento\(false\)/)
  assert.match(dopo, /rileggi\(\)/)                                 // la cronologia (booking_events) e «Da controllare»
  assert.match(dopo, /confermaPagamento\(esito\.importo, esito\.metodo/)   // la conferma volante di Ania
  // rileggere non fa comparire «Caricamento…»: solo la prima apertura
  assert.match(pagina, /if \(idCaricato\.current !== id\) setLoading\(true\)/)
  assert.match(pagina, /const rileggi = \(\) => setVersione\(v => v \+ 1\)/)
  assert.match(pagina, /\}, \[id, versione\]\)/)
  // e nel conto i pagamenti mostrano anche la nota, se c'è
  assert.match(leggi('components/scheda/ContoScheda.tsx'), /data-nota-pagamento/)
  assert.match(leggi('lib/schedaConto.ts'), /nota: \(p\.note \?\? ''\)\.trim\(\)/)
})

test('dalla Home «Registra saldo» (?azione=pagato) apre il foglio da sé, una volta', () => {
  assert.match(pagina, /const pagamentoDaAprire = useRef\(parametri\.get\('azione'\) === 'pagato'\)/)
  assert.match(pagina, /if \(pagamentoDaAprire\.current\) \{ pagamentoDaAprire\.current = false; setFoglioPagamento\(true\) \}/)
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
  assert.match(modulo, /data-campo="nome"[\s\S]{0,300}data-campo="cognome"[\s\S]{0,300}data-campo="telefono"/)
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
  assert.match(dati, /import \{ nomeCompleto, spezzaNome \} from '\.\/guestName\.ts'/)
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
  assert.match(pagina, /setContoLeggibile\(!conto\.errore\)/)
  assert.match(pagina, /if \(pag\.error\) \{ setContoLeggibile\(false\)/)
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
  assert.match(scontoDati, /supabase\.from\('bookings'\)[\s\S]{0,120}\.update\(\{ \.\.\.r\.campi, updated_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]{0,60}\.eq\('id', r\.id\)[\s\S]{0,40}\.select\('id'\)/)
  assert.match(scontoDati, /data\.length !== 1/)
  assert.match(scontoDati, /ERRORE_SCONTO_A_META/)
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
  assert.match(sconto, /if \(esito\.esito === 'errore'\) \{ setErrore\(esito\.messaggio\); return \}/)
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
