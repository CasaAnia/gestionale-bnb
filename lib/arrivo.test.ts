// ============================================================================
// ARRIVO E NAVETTA (21/09/2026) — le prove.
//
// Il difetto che questo blocco chiude è uno solo, e ha un nome: «Linate alle
// 15:00» che diventa «in struttura alle 15:00». Qui sotto quel caso è provato
// da tutte le parti: nel modello, nel salvataggio, nei testi delle tre
// superfici e nelle guardie sui sorgenti, perché nessuna pagina torni a
// scriversi un orario suo senza dire di dove sia.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ARRIVO_VUOTO, LUOGHI, NAVETTE, AUTISTI, TIPI_ARRIVO, MODI_ORARIO,
  leggiArrivo, campiArrivo, campiArrivoVecchi, oraInStruttura, periodoInStruttura,
  periodoOre, eFascia, circaInStruttura, orarioIgnoto, navettaRichiesta, nomeLuogo,
  cambiaTipo, cambiaModo, cambiaNavetta, normalizza, controllaArrivo, pianoModuloArrivo,
  arrivoInScheda, navettaInScheda, rigaLuogo, rigaPrelievo, arrivoInHome,
  ERRORE_ORA, ERRORE_LUOGO, ERRORE_LUOGO_ALTRO, ERRORE_FASCIA, ERRORE_FASCIA_STRUTTURA,
  type Arrivo,
} from './arrivo.ts'
import { salvaArrivoPrenotazione } from './arrivoDati.ts'
import { AVVISO_ARRIVO_0058 } from './arrivoOrario.ts'
import { MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/** il file senza i commenti: le guardie guardano il CODICE, non i racconti */
const soloCodice = (p: string) => leggi(p).split('\n').filter(r => {
  const t = r.trim()
  return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
}).join('\n')
const con = (p: Partial<Arrivo>): Arrivo => normalizza({ ...ARRIVO_VUOTO, ...p })

// Il caso del riferimento approvato: atterra a Linate alle 15:00, Ania stima
// che sia in casa fra le 16 e le 17, la va a prendere Massimo alle 15:30.
const RIFERIMENTO = con({
  tipo: 'luogo', luogo: 'linate', modo: 'precisa', oraDa: '15:00',
  strutturaDa: '16:00', strutturaA: '17:00', navetta: 'massimo', prelievo: '15:30',
})

// ── 1. Il vocabolario, come l'ha chiesto Ania ───────────────────────────────

test('i luoghi, nell’ordine esatto — e «Bergamo» non esiste: si chiama Orio al Serio', () => {
  assert.deepEqual(LUOGHI.map(l => l.nome),
    ['Linate', 'Rogoredo', 'Centrale', 'Malpensa', 'Orio al Serio', 'San Donato', 'Altro luogo…'])
  assert.equal(/Bergamo/.test(soloCodice('lib/arrivo.ts')), false)
  assert.equal(/Bergamo/.test(leggi('components/ArrivoNavetta.tsx')), false)
})

test('i tre tipi e i due modi dell’orario, nell’ordine del riferimento', () => {
  assert.deepEqual(TIPI_ARRIVO.map(t => t.nome), ['In struttura', 'Arrivo a…', 'Da definire'])
  assert.deepEqual(MODI_ORARIO.map(m => m.nome), ['Ora precisa', 'Fascia oraria'])
})

test('la navetta: tre voci e quattro autisti, nell’ordine indicato, e una scelta sola alla volta', () => {
  assert.deepEqual(NAVETTE.map(n => n.nome), ['Non richiesta', 'Da definire', 'Da assegnare'])
  assert.deepEqual(AUTISTI.map(a => a.nome), ['Massimo', 'Aldo', 'Alberto', 'Matteo'])
  // sceglierne una spegne tutte le altre: nel piano del modulo è accesa una sola pastiglia
  for (const chiave of [...NAVETTE, ...AUTISTI].map(x => x.chiave)) {
    const piano = pianoModuloArrivo(con({ navetta: chiave }))
    const accese = [...piano.navetta, ...piano.autista].filter(s => s.acceso).map(s => s.chiave)
    assert.deepEqual(accese, [chiave], `con «${chiave}» le pastiglie accese sono ${accese.join(', ')}`)
  }
})

test('«Da assegnare» è navetta richiesta senza autista; «Da definire» non è un sì', () => {
  assert.equal(navettaRichiesta('da_assegnare'), true)
  assert.equal(navettaRichiesta('massimo'), true)
  assert.equal(navettaRichiesta('da_definire'), false)
  assert.equal(navettaRichiesta('non_richiesta'), false)
})

// ── 2. IL CUORE: i tre significati non si mescolano ─────────────────────────

test('IL DIFETTO CHIUSO: «Linate alle 15:00» non diventa mai «in struttura alle 15:00»', () => {
  const soloLuogo = con({ tipo: 'luogo', luogo: 'linate', oraDa: '15:00' })
  // l'ora del luogo NON finisce nell'ora in struttura, né nella colonna di sempre
  assert.equal(oraInStruttura(soloLuogo), '')
  assert.equal(campiArrivoVecchi(soloLuogo).check_in_time, null)
  assert.equal(campiArrivo(soloLuogo).check_in_time, null)
  // e con la stima c'è, ma è la stima: le 16, non le 15
  assert.equal(oraInStruttura(RIFERIMENTO), '16:00')
  assert.equal(campiArrivo(RIFERIMENTO).check_in_time, '16:00')
  assert.equal(campiArrivo(RIFERIMENTO).arrivo_ora_da, '15:00')
})

test('«check_in_time» resta l’ora IN STRUTTURA: precisa, inizio della fascia, o vuota', () => {
  assert.equal(campiArrivoVecchi(con({ tipo: 'struttura', oraDa: '16:00' })).check_in_time, '16:00')
  assert.equal(campiArrivoVecchi(con({ tipo: 'struttura', modo: 'fascia', oraDa: '15:00', oraA: '17:00' })).check_in_time, '15:00')
  assert.equal(campiArrivoVecchi(con({ tipo: 'da_definire' })).check_in_time, null)
})

test('«shuttle» resta lo specchio di sempre: no · si · niente', () => {
  assert.equal(campiArrivoVecchi(con({ navetta: 'non_richiesta' })).shuttle, 'no')
  assert.equal(campiArrivoVecchi(con({ navetta: 'da_definire' })).shuttle, null)
  assert.equal(campiArrivoVecchi(con({ navetta: 'da_assegnare' })).shuttle, 'si')
  assert.equal(campiArrivoVecchi(con({ navetta: 'aldo' })).shuttle, 'si')
})

test('cambiando tipo l’ora non resta al suo posto con un significato nuovo', () => {
  // da «Arrivo a Linate» a «In struttura»: quello che vale è la STIMA, non l'ora di Linate
  const aStruttura = cambiaTipo(RIFERIMENTO, 'struttura')
  assert.equal(aStruttura.oraDa, '16:00')
  assert.equal(aStruttura.oraA, '17:00')
  assert.equal(aStruttura.modo, 'fascia')
  assert.equal(aStruttura.luogo, null)
  // e al contrario: l'ora in struttura diventa la stima, non l'ora del luogo
  const aLuogo = cambiaTipo(con({ tipo: 'struttura', oraDa: '16:00' }), 'luogo')
  assert.equal(aLuogo.strutturaDa, '16:00')
  assert.equal(aLuogo.oraDa, '', 'l’ora in struttura è diventata l’ora dell’aeroporto')
})

test('«Da definire» non produce nessun orario finto, e nessuna mezzanotte', () => {
  const a = cambiaTipo(RIFERIMENTO, 'da_definire')
  assert.deepEqual([a.oraDa, a.oraA, a.strutturaDa, a.strutturaA], ['', '', '', ''])
  assert.equal(a.luogo, null)
  const campi = campiArrivo(a)
  assert.equal(campi.check_in_time, null)
  assert.equal(campi.arrivo_ora_da, null)
  assert.equal(campi.arrivo_struttura_da, null)
  assert.equal(orarioIgnoto(a), true)
  // la navetta decisa non si perde per strada
  assert.equal(campi.navetta, 'massimo')
})

// ── 3. La fascia è libera ───────────────────────────────────────────────────

test('la fascia dura quello che deve: mezz’ora, un’ora, due ore, tutto il pomeriggio', () => {
  for (const [da, a, atteso] of [
    ['15:00', '15:30', '15:00–15:30'],
    ['15:00', '16:00', '15:00–16:00'],
    ['15:00', '17:00', '15:00–17:00'],
    ['14:00', '20:00', '14:00–20:00'],
  ] as const) {
    assert.equal(periodoOre(da, a), atteso)
    assert.equal(eFascia(da, a), true)
  }
  // nessun intervallo predefinito nel codice: la fine non si calcola dall'inizio
  assert.equal(/DURATA_FASCIA|MINUTI_FASCIA|\+ 60|addMinuti/.test(leggi('lib/arrivo.ts')), false)
})

test('due ore uguali non sono una fascia, e una sola ora non ha bisogno del trattino', () => {
  assert.equal(periodoOre('16:00', '16:00'), '16:00')
  assert.equal(eFascia('16:00', '16:00'), false)
  assert.equal(periodoOre('16:00', ''), '16:00')
  assert.equal(periodoOre('', ''), '')
})

test('«circa» si dice quando è una fascia o una stima, mai su un’ora precisa in struttura', () => {
  assert.equal(circaInStruttura(con({ tipo: 'struttura', oraDa: '16:00' })), false)
  assert.equal(circaInStruttura(con({ tipo: 'struttura', modo: 'fascia', oraDa: '16:00', oraA: '17:00' })), true)
  assert.equal(circaInStruttura(RIFERIMENTO), true)                      // la stima è sempre «circa»
  assert.equal(circaInStruttura(con({ tipo: 'luogo', luogo: 'linate', strutturaDa: '16:00' })), true)
})

test('«orario ignoto» vuol dire che non si sa NIENTE: con «Linate alle 15:00» un orario c’è', () => {
  assert.equal(orarioIgnoto(con({ tipo: 'da_definire' })), true)
  assert.equal(orarioIgnoto(con({ tipo: 'struttura' })), true)
  assert.equal(orarioIgnoto(con({ tipo: 'luogo', luogo: 'linate' })), true)
  assert.equal(orarioIgnoto(con({ tipo: 'luogo', luogo: 'linate', oraDa: '15:00' })), false)
  assert.equal(orarioIgnoto(RIFERIMENTO), false)
})

// ── 4. Leggere una prenotazione, con e senza la 0058 ────────────────────────

test('senza le colonne nuove l’arrivo si ricostruisce dalle due di sempre', () => {
  const vecchia = leggiArrivo({ check_in_time: '15:30', shuttle: 'si' })
  assert.equal(vecchia.tipo, 'struttura')
  assert.equal(vecchia.oraDa, '15:30')
  assert.equal(vecchia.navetta, 'da_assegnare')
  assert.equal(leggiArrivo({ check_in_time: null, shuttle: 'no' }).tipo, 'da_definire')
  assert.equal(leggiArrivo({ check_in_time: null, shuttle: 'no' }).navetta, 'non_richiesta')
  assert.equal(leggiArrivo({}).navetta, 'da_definire')
  assert.equal(leggiArrivo(null).tipo, 'da_definire')
})

test('con le colonne nuove si legge tutto, e si riscrive uguale (giro completo)', () => {
  const campi = campiArrivo(RIFERIMENTO)
  const riletto = leggiArrivo(campi)
  assert.deepEqual(riletto, RIFERIMENTO)
  assert.deepEqual(campiArrivo(riletto), campi)
})

test('un valore storto nelle colonne nuove non diventa una scelta inventata', () => {
  const a = leggiArrivo({ arrivo_tipo: 'chissà', arrivo_luogo: 'bergamo', navetta: 'giovanni', check_in_time: '15:00' })
  assert.equal(a.tipo, 'struttura')       // il tipo storto si ignora: vale la colonna di sempre
  assert.equal(a.luogo, null)
  assert.equal(a.navetta, 'da_definire')
  const b = leggiArrivo({ arrivo_tipo: 'luogo', arrivo_luogo: 'bergamo' })
  assert.equal(b.luogo, null)
})

// ── 5. I controlli ──────────────────────────────────────────────────────────

test('i controlli: ora a metà, luogo non scelto, testo libero vuoto, fascia al contrario', () => {
  assert.equal(controllaArrivo(RIFERIMENTO), null)
  assert.equal(controllaArrivo(con({ tipo: 'struttura', oraDa: '15' })), ERRORE_ORA)
  assert.equal(controllaArrivo({ ...ARRIVO_VUOTO, tipo: 'luogo' }), ERRORE_LUOGO)
  assert.equal(controllaArrivo({ ...ARRIVO_VUOTO, tipo: 'luogo', luogo: 'altro', luogoAltro: '  ' }), ERRORE_LUOGO_ALTRO)
  assert.equal(controllaArrivo({ ...ARRIVO_VUOTO, tipo: 'struttura', modo: 'fascia', oraDa: '17:00', oraA: '15:00' }), ERRORE_FASCIA)
  assert.equal(controllaArrivo({ ...ARRIVO_VUOTO, tipo: 'luogo', luogo: 'linate', strutturaDa: '18:00', strutturaA: '16:00' }), ERRORE_FASCIA_STRUTTURA)
  // «Da definire» senza niente scritto va benissimo: non manca nulla da controllare
  assert.equal(controllaArrivo(ARRIVO_VUOTO), null)
})

test('la pulizia: quello che il tipo non prevede non resta in giro', () => {
  const sporco: Arrivo = { ...RIFERIMENTO, tipo: 'struttura', luogoAltro: 'boh', prelievo: '15:30' }
  const pulito = normalizza(sporco)
  assert.deepEqual([pulito.luogo, pulito.luogoAltro, pulito.strutturaDa, pulito.strutturaA], [null, '', '', ''])
  // il prelievo sparisce se la navetta non serve
  assert.equal(normalizza({ ...RIFERIMENTO, navetta: 'non_richiesta' }).prelievo, '')
  assert.equal(campiArrivo({ ...RIFERIMENTO, navetta: 'da_definire' }).navetta_prelievo, null)
  // «Ora precisa» non si porta dietro la fine di una fascia scritta prima
  assert.equal(cambiaModo({ ...ARRIVO_VUOTO, tipo: 'struttura', modo: 'fascia', oraDa: '15:00', oraA: '17:00' }, 'precisa').oraA, '')
  // la fascia parte dall'ora già scritta
  assert.equal(cambiaModo(con({ tipo: 'struttura', oraDa: '15:00' }), 'fascia').oraDa, '15:00')
  assert.equal(cambiaNavetta(RIFERIMENTO, 'non_richiesta').prelievo, '')
})

// ── 6. SUPERFICIE 1: il modulo ──────────────────────────────────────────────

test('il modulo mostra solo quello che serve: luogo e stima solo con «Arrivo a…»', () => {
  const daDefinire = pianoModuloArrivo(con({ tipo: 'da_definire' }))
  assert.equal(daDefinire.luogo, null)
  assert.equal(daDefinire.orario, null, 'con «Da definire» chiede comunque un orario')
  assert.equal(daDefinire.caselleOrario, 0)
  assert.equal(daDefinire.stima, false)

  const struttura = pianoModuloArrivo(con({ tipo: 'struttura' }))
  assert.equal(struttura.luogo, null)
  assert.equal(struttura.stima, false, 'la stima in struttura non ha senso se arriva già in struttura')
  assert.equal(struttura.caselleOrario, 1)

  const luogo = pianoModuloArrivo(RIFERIMENTO)
  assert.equal(luogo.luogo?.length, 7)
  assert.equal(luogo.stima, true)
  assert.equal(luogo.luogoAltro, false)
  assert.equal(pianoModuloArrivo(con({ tipo: 'luogo', luogo: 'altro', luogoAltro: 'x' })).luogoAltro, true)
})

test('il modulo: due caselle con la fascia, una con l’ora precisa; il prelievo solo se la navetta serve', () => {
  assert.equal(pianoModuloArrivo(con({ tipo: 'struttura', modo: 'fascia', oraDa: '15:00', oraA: '17:00' })).caselleOrario, 2)
  assert.equal(pianoModuloArrivo(RIFERIMENTO).prelievo, true)
  assert.equal(pianoModuloArrivo(con({ navetta: 'da_assegnare' })).prelievo, true)
  assert.equal(pianoModuloArrivo(con({ navetta: 'da_definire' })).prelievo, false)
  assert.equal(pianoModuloArrivo(con({ navetta: 'non_richiesta' })).prelievo, false)
})

// ── 7. SUPERFICIE 2: la scheda ──────────────────────────────────────────────

test('la scheda, il caso del riferimento: «In struttura circa 16:00–17:00» e sotto «Arriva a Linate alle 15:00»', () => {
  assert.deepEqual(arrivoInScheda(RIFERIMENTO), { titolo: 'In struttura circa 16:00–17:00', sotto: 'Arriva a Linate alle 15:00' })
  assert.deepEqual(navettaInScheda(RIFERIMENTO), { titolo: 'Massimo', sotto: 'Prelievo a Linate · 15:30' })
})

test('la scheda, gli altri casi: senza stima comanda il luogo, e si dice che l’ora in casa manca', () => {
  assert.deepEqual(arrivoInScheda(con({ tipo: 'luogo', luogo: 'linate', oraDa: '15:00' })),
    { titolo: 'Arriva a Linate alle 15:00', sotto: 'Orario in struttura da definire' })
  assert.deepEqual(arrivoInScheda(con({ tipo: 'struttura', oraDa: '16:00' })),
    { titolo: 'In struttura alle 16:00', sotto: null })
  assert.deepEqual(arrivoInScheda(con({ tipo: 'struttura', modo: 'fascia', oraDa: '15:00', oraA: '17:00' })),
    { titolo: 'In struttura circa 15:00–17:00', sotto: null })
  assert.deepEqual(arrivoInScheda(con({ tipo: 'struttura' })), { titolo: 'In struttura · orario da definire', sotto: null })
  assert.deepEqual(arrivoInScheda(con({ tipo: 'da_definire' })), { titolo: 'Arrivo da definire', sotto: null })
  // fascia al luogo
  assert.equal(rigaLuogo(con({ tipo: 'luogo', luogo: 'malpensa', modo: 'fascia', oraDa: '15:00', oraA: '16:00' })),
    'Arriva a Malpensa circa 15:00–16:00')
  assert.equal(rigaLuogo(con({ tipo: 'luogo', luogo: 'rogoredo' })), 'Arriva a Rogoredo · orario da definire')
})

test('«Centrale» resta il nome della pastiglia, ma nelle frasi si scrive «Milano Centrale»', () => {
  assert.equal(LUOGHI.find(l => l.chiave === 'centrale')?.nome, 'Centrale')
  assert.equal(nomeLuogo(con({ tipo: 'luogo', luogo: 'centrale' })), 'Milano Centrale')
  assert.equal(rigaLuogo(con({ tipo: 'luogo', luogo: 'centrale', oraDa: '15:00' })), 'Arriva a Milano Centrale alle 15:00')
})

test('«Altro luogo…»: nelle frasi comanda il testo che ha scritto Ania', () => {
  const a = con({ tipo: 'luogo', luogo: 'altro', luogoAltro: ' casa di sua sorella ', oraDa: '19:00' })
  assert.equal(nomeLuogo(a), 'casa di sua sorella')
  assert.equal(rigaLuogo(a), 'Arriva a casa di sua sorella alle 19:00')
})

test('la navetta nella scheda: i tre stati si dicono per quello che sono', () => {
  assert.deepEqual(navettaInScheda(con({ navetta: 'non_richiesta' })), { titolo: 'Non richiesta', sotto: null })
  assert.deepEqual(navettaInScheda(con({ navetta: 'da_definire' })), { titolo: 'Da definire', sotto: 'Da chiedere all’ospite' })
  assert.deepEqual(navettaInScheda(con({ navetta: 'da_assegnare' })), { titolo: 'Da assegnare', sotto: 'Autista ancora da scegliere' })
  // con un luogo e un'ora, «Da assegnare» dice già dove e quando
  assert.equal(navettaInScheda(con({ tipo: 'luogo', luogo: 'orio_al_serio', navetta: 'da_assegnare', prelievo: '09:00' })).sotto,
    'Prelievo a Orio al Serio · 09:00')
  assert.equal(rigaPrelievo(con({ navetta: 'alberto', prelievo: '15:30' })), 'Prelievo alle 15:30')
  assert.equal(rigaPrelievo(con({ navetta: 'alberto' })), null)
  assert.equal(rigaPrelievo(con({ navetta: 'non_richiesta', prelievo: '15:30' })), null)
})

// ── 8. SUPERFICIE 3: gli Arrivi della Home ──────────────────────────────────

test('la Home, il caso del riferimento: l’ora in struttura in grande, e le due righe sotto', () => {
  const h = arrivoInHome(RIFERIMENTO)
  assert.equal(h.grande, '16:00–17:00')
  assert.equal(h.numerico, true)
  assert.equal(h.circa, true)
  assert.equal(h.sotto, 'Arrivo previsto in struttura')
  assert.deepEqual(h.righe, [
    { icona: 'aereo', forte: 'Linate · 15:00', sotto: 'Arrivo in aeroporto' },
    { icona: 'auto', forte: 'Massimo · prelievo 15:30', sotto: 'Navetta in struttura' },
  ])
})

test('la Home: aereo, treno o segnaposto secondo il luogo', () => {
  assert.equal(arrivoInHome(con({ tipo: 'luogo', luogo: 'centrale', oraDa: '15:00' })).righe[0].icona, 'treno')
  assert.equal(arrivoInHome(con({ tipo: 'luogo', luogo: 'centrale', oraDa: '15:00' })).righe[0].sotto, 'Arrivo in stazione')
  assert.equal(arrivoInHome(con({ tipo: 'luogo', luogo: 'san_donato', oraDa: '15:00' })).righe[0].icona, 'treno')
  assert.equal(arrivoInHome(con({ tipo: 'luogo', luogo: 'malpensa', oraDa: '15:00' })).righe[0].icona, 'aereo')
  const altro = arrivoInHome(con({ tipo: 'luogo', luogo: 'altro', luogoAltro: 'Piazza Duomo', oraDa: '15:00' }))
  assert.deepEqual(altro.righe[0], { icona: 'luogo', forte: 'Piazza Duomo · 15:00', sotto: 'Arrivo sul posto' })
})

test('la Home: senza ora in struttura lo dice, senza inventare numeri', () => {
  const h = arrivoInHome(con({ tipo: 'luogo', luogo: 'linate', oraDa: '15:00' }))
  assert.equal(h.grande, 'Da definire')
  assert.equal(h.numerico, false)
  assert.equal(h.circa, false)
  assert.equal(h.sotto, 'Orario in struttura da definire')
  // ma la riga del luogo resta: quello che si sa si vede
  assert.equal(h.righe[0].forte, 'Linate · 15:00')
})

test('la Home: «Non richiesta» non occupa una riga, «Da definire» sì (è un promemoria)', () => {
  assert.deepEqual(arrivoInHome(con({ tipo: 'struttura', oraDa: '16:00', navetta: 'non_richiesta' })).righe, [])
  assert.deepEqual(arrivoInHome(con({ tipo: 'struttura', oraDa: '16:00', navetta: 'da_definire' })).righe,
    [{ icona: 'auto', forte: 'Navetta da definire', sotto: 'Da chiedere all’ospite' }])
  assert.deepEqual(arrivoInHome(con({ tipo: 'struttura', oraDa: '16:00', navetta: 'da_assegnare' })).righe,
    [{ icona: 'auto', forte: 'Autista da assegnare', sotto: 'Navetta in struttura' }])
  // l'ora precisa in struttura non prende il «circa»
  const preciso = arrivoInHome(con({ tipo: 'struttura', oraDa: '16:00' }))
  assert.deepEqual([preciso.grande, preciso.circa, preciso.sotto], ['16:00', false, 'Arrivo in struttura'])
})

// ── 9. Il salvataggio, con e senza la 0058 ──────────────────────────────────

const ok = () => Promise.resolve({ data: null, error: null })
const senzaColonne = () => Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'arrivo_tipo' column" } })
const rifiuta = () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for table bookings' } })

test('salvataggio: con la 0058 va tutto, e le due colonne di sempre restano vere', async () => {
  const scritte: Record<string, string | null>[] = []
  const esito = await salvaArrivoPrenotazione(campi => { scritte.push(campi); return ok() }, RIFERIMENTO)
  assert.equal(esito.esito, 'ok')
  assert.equal(scritte.length, 1)
  assert.equal(scritte[0].arrivo_luogo, 'linate')
  assert.equal(scritte[0].navetta, 'massimo')
  assert.equal(scritte[0].check_in_time, '16:00')       // l'ora in struttura, non le 15:00 di Linate
  assert.equal(scritte[0].shuttle, 'si')
  assert.deepEqual(esito.campi, scritte[0])
})

test('salvataggio: senza la 0058 si salvano le due di sempre, e lo si dice — niente perdite di nascosto', async () => {
  const scritte: Record<string, string | null>[] = []
  const esito = await salvaArrivoPrenotazione(campi => {
    scritte.push(campi)
    return scritte.length === 1 ? senzaColonne() : ok()
  }, RIFERIMENTO)
  assert.equal(esito.esito, 'solo_vecchie')
  assert.equal(esito.messaggio, AVVISO_ARRIVO_0058)
  assert.deepEqual(scritte[1], { check_in_time: '16:00', shuttle: 'si' })
  assert.deepEqual(esito.campi, { check_in_time: '16:00', shuttle: 'si' })
})

test('salvataggio: se non passa niente, niente si aggiorna a schermo', async () => {
  const esito = await salvaArrivoPrenotazione(rifiuta, RIFERIMENTO)
  assert.equal(esito.esito, 'errore')
  assert.equal(esito.messaggio, MESSAGGIO_NON_SALVATO)
  assert.equal(esito.campi, null)
  // senza rete nessuna eccezione esce fuori
  const rete = () => Promise.reject(new TypeError('Failed to fetch'))
  assert.equal((await salvaArrivoPrenotazione(rete, RIFERIMENTO)).esito, 'errore')
})

test('salvataggio: un arrivo con un guaio non tocca il server', async () => {
  let chiamate = 0
  const esito = await salvaArrivoPrenotazione(() => { chiamate += 1; return ok() }, { ...ARRIVO_VUOTO, tipo: 'luogo' })
  assert.equal(chiamate, 0, 'ha scritto lo stesso')
  assert.equal(esito.esito, 'errore')
  assert.equal(esito.messaggio, ERRORE_LUOGO)
})

// ── 10. Le guardie sui sorgenti ─────────────────────────────────────────────
// La lezione della regola fissa n. 1 (i nomi, persi tre volte): un dato, un
// modulo, un salvataggio. Se una pagina torna a scriversi i campi dell'arrivo
// da sé, la suite lo dice subito.

const PUNTI_DI_INGRESSO = [
  'app/nuova-prenotazione/page.tsx',
  'app/nuova/page.tsx',
  'app/arrivi/page.tsx',
  'app/prenotazioni/[id]/page.tsx',
  'components/scheda/FoglioArrivo.tsx',
]

test('tutti i punti in cui l’arrivo si scrive montano lo stesso modulo', () => {
  for (const f of PUNTI_DI_INGRESSO) {
    assert.match(leggi(f), /<ArrivoNavetta /, `${f} non monta il modulo condiviso`)
  }
})

test('nessuna pagina si scrive campi dell’arrivo suoi: check_in_time e shuttle li decide lib/arrivo', () => {
  for (const f of [...PUNTI_DI_INGRESSO, 'app/page.tsx']) {
    const codice = soloCodice(f)
    assert.equal(/check_in_time:\s/.test(codice), false, `${f} scrive check_in_time da sé`)
    assert.equal(/shuttle:\s/.test(codice), false, `${f} scrive shuttle da sé`)
  }
  // e i due campi si compongono in un posto solo: campiArrivoVecchi
  const arrivo = soloCodice('lib/arrivo.ts')
  assert.match(arrivo, /export function campiArrivoVecchi/)
  assert.equal(arrivo.match(/check_in_time: oraInStruttura\(a\) \|\| null/g)?.length, 1)
  assert.equal(arrivo.match(/shuttle: a\.navetta ===/g)?.length, 1)
  // nessun altro file del gestionale compone quelle due colonne
  for (const f of ['lib/arrivoDati.ts', 'components/ArrivoNavetta.tsx', 'components/scheda/BloccoArrivo.tsx', 'components/ArriviOggi.tsx']) {
    assert.equal(/check_in_time:|shuttle:/.test(soloCodice(f)), false, `${f} compone le colonne di sempre`)
  }
})

test('il salvataggio dell’arrivo è uno solo, e passa sempre dal controllo', () => {
  for (const f of ['app/arrivi/page.tsx', 'app/prenotazioni/[id]/page.tsx', 'components/scheda/FoglioArrivo.tsx']) {
    assert.match(leggi(f), /salvaArrivoPrenotazione\(/, `${f} non usa il salvataggio condiviso`)
  }
  assert.match(leggi('lib/arrivoDati.ts'), /const problema = controllaArrivo\(arrivo\)/)
})

test('il gestionale non calcola tragitti: nessun servizio esterno, nessuna stima automatica', () => {
  for (const f of ['lib/arrivo.ts', 'lib/arrivoDati.ts', 'components/ArrivoNavetta.tsx', 'components/ArriviOggi.tsx']) {
    assert.equal(/fetch\(|maps\.|googleapis|tempoDiViaggio|stimaAutomatica/i.test(soloCodice(f)), false, `${f} sembra calcolare o chiedere fuori`)
  }
  // la stima la scrive Ania, e il modulo lo dice
  assert.match(leggi('lib/arrivo.ts'), /export const AIUTO_STIMA = 'Una tua stima, modificabile'/)
  assert.match(leggi('components/ArrivoNavetta.tsx'), /\{AIUTO_STIMA\}/)
})

test('«manca l’orario» in «Da controllare» e nel promemoria guarda l’arrivo vero, non solo check_in_time', () => {
  assert.match(leggi('lib/daControllare.ts'), /orarioIgnoto\(leggiArrivo\(/)
  assert.match(leggi('lib/navetta.ts'), /const mancaOrario = orarioIgnoto\(leggiArrivo\(b\)\)/)
})

test('la Home mostra gli arrivi in un posto solo: la riga CHECK-IN non li ripete', () => {
  const home = leggi('app/page.tsx')
  assert.match(home, /<ArriviOggi oggi=\{data\.checkInOggi\} domani=\{data\.checkInDomani\} \/>/)
  assert.equal(/CHECK-IN/.test(home), false, 'gli arrivi sono tornati anche nel blocco «Oggi»')
  // partenze e cambi camera restano dov'erano
  assert.match(home, /CHECK-OUT/)
  assert.match(home, /⇄ CAMBIO/)
})

test('la proposta 0058 c’è, con i valori ammessi e senza backfill', () => {
  const sql = leggi('supabase/proposte/0058_arrivo_e_navetta.BOZZA.sql')
  for (const c of ['arrivo_tipo', 'arrivo_luogo', 'arrivo_luogo_altro', 'arrivo_ora_da', 'arrivo_ora_a',
    'arrivo_struttura_da', 'arrivo_struttura_a', 'navetta', 'navetta_prelievo']) {
    assert.match(sql, new RegExp(`add column if not exists ${c} text`), `manca la colonna ${c}`)
  }
  assert.match(sql, /'linate', 'rogoredo', 'centrale', 'malpensa', 'orio_al_serio', 'san_donato', 'altro'/)
  assert.match(sql, /'non_richiesta', 'da_definire', 'da_assegnare', 'massimo', 'aldo', 'alberto', 'matteo'/)
  assert.equal(/update public\.bookings set|insert into public\.bookings/.test(sql), false, 'la proposta tocca i dati')
  // le chiavi del codice e quelle del database sono le stesse
  for (const l of LUOGHI) assert.ok(sql.includes(`'${l.chiave}'`), `il database non conosce il luogo ${l.chiave}`)
  for (const n of [...NAVETTE, ...AUTISTI]) assert.ok(sql.includes(`'${n.chiave}'`), `il database non conosce la navetta ${n.chiave}`)
})
