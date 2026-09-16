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
]

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
    assert.match(sorgente, /ottone/, 'le etichettine del foglio non sono in ottone')
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
