// ============================================================================
// ARRIVO E NAVETTA (21/09/2026) — le prove.
//
// Il difetto che questo blocco chiude è uno solo, e ha un nome: «Linate alle
// 15:00» che diventa «in struttura alle 15:00». Qui sotto quel caso è provato
// da tutte le parti: nel modello, nel salvataggio, nei testi delle tre
// superfici e nelle guardie sui sorgenti.
//
// La seconda metà del file nasce dalla VERIFICA INDIPENDENTE di Codex del
// 21/09/2026 sera: ripiego solo per una colonna davvero mancante, nessun
// «salvato» senza righe scritte, bozza che non si perde cambiando opzioni,
// testa della scheda che legge il modello, Home che non perde niente.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ARRIVO_VUOTO, LUOGHI, NAVETTE, AUTISTI, TIPI_ARRIVO, MODI_ORARIO,
  leggiArrivo, campiArrivo, campiArrivoVecchi, oraInStruttura, periodoInStruttura,
  periodoOre, eFascia, circaInStruttura, orarioIgnoto, navettaRichiesta, nomeLuogo,
  cambiaTipo, cambiaModo, cambiaNavetta, scriviOra, modoAttivo, controllaArrivo,
  pianoModuloArrivo, perditeSenza0058, COLONNE_0058,
  arrivoInScheda, navettaInScheda, rigaLuogo, rigaPrelievo, arrivoInHome,
  ERRORE_ORA, ERRORE_LUOGO, ERRORE_LUOGO_ALTRO, ERRORE_FASCIA, ERRORE_FASCIA_STIMA,
  type Arrivo,
} from './arrivo.ts'
import { salvaArrivoPrenotazione, messaggioSenzaPosto, confrontaRiga, dettagliEsistenti, erroreDelServer, MESSAGGIO_INCERTO, MESSAGGIO_IN_VOLO, MESSAGGIO_DETTAGLI_ESISTENTI } from './arrivoDati.ts'
import { MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'
import { arrivoTestaDaArrivo, ORARIO_DA_DEFINIRE, NAVETTA_DA_VERIFICARE, NAVETTA_NON_RICHIESTA, CON_NAVETTA } from './testaScheda.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/** il file senza i commenti: le guardie guardano il CODICE, non i racconti */
const soloCodice = (p: string) => leggi(p).split('\n').filter(r => {
  const t = r.trim()
  return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
}).join('\n')
const con = (p: Partial<Arrivo>): Arrivo => ({ ...ARRIVO_VUOTO, ...p })

// Il caso del riferimento approvato: atterra a Linate alle 15:00, Ania stima
// che sia in casa fra le 16 e le 17, la va a prendere Massimo alle 15:30.
const RIFERIMENTO = con({
  tipo: 'luogo', luogo: 'linate', modoLuogo: 'precisa', luogoDa: '15:00',
  stimaDa: '16:00', stimaA: '17:00', navetta: 'massimo', prelievo: '15:30',
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

// ── 2. IL CUORE: i significati non si mescolano ─────────────────────────────

test('IL DIFETTO CHIUSO: «Linate alle 15:00» non diventa mai «in struttura alle 15:00»', () => {
  const soloLuogo = con({ tipo: 'luogo', luogo: 'linate', luogoDa: '15:00' })
  assert.equal(oraInStruttura(soloLuogo), '')
  assert.equal(campiArrivoVecchi(soloLuogo).check_in_time, null)
  assert.equal(campiArrivo(soloLuogo).check_in_time, null)
  assert.equal(oraInStruttura(RIFERIMENTO), '16:00')
  assert.equal(campiArrivo(RIFERIMENTO).check_in_time, '16:00')
  assert.equal(campiArrivo(RIFERIMENTO).arrivo_luogo_ora_da, '15:00')
})

test('«check_in_time» resta l’ora IN STRUTTURA: precisa, inizio della fascia, o vuota', () => {
  assert.equal(campiArrivoVecchi(con({ tipo: 'struttura', strutturaDa: '16:00' })).check_in_time, '16:00')
  assert.equal(campiArrivoVecchi(con({ tipo: 'struttura', modoStruttura: 'fascia', strutturaDa: '15:00', strutturaA: '17:00' })).check_in_time, '15:00')
  assert.equal(campiArrivoVecchi(con({ tipo: 'da_definire' })).check_in_time, null)
})

test('«shuttle» resta lo specchio di sempre: no · si · niente', () => {
  assert.equal(campiArrivoVecchi(con({ navetta: 'non_richiesta' })).shuttle, 'no')
  assert.equal(campiArrivoVecchi(con({ navetta: 'da_definire' })).shuttle, null)
  assert.equal(campiArrivoVecchi(con({ navetta: 'da_assegnare' })).shuttle, 'si')
  assert.equal(campiArrivoVecchi(con({ navetta: 'aldo' })).shuttle, 'si')
})

// ── 3. LA BOZZA NON SI PERDE (rilievo di Codex) ─────────────────────────────

test('RILIEVO CODEX: andata e ritorno fra i tipi non perde niente', () => {
  const andata = cambiaTipo(RIFERIMENTO, 'struttura')
  const ritorno = cambiaTipo(andata, 'luogo')
  assert.deepEqual(ritorno, { ...RIFERIMENTO, strutturaDa: '16:00', strutturaA: '17:00', modoStruttura: 'fascia' },
    'tornando su «Arrivo a…» si è perso il luogo o la sua ora')
  assert.equal(ritorno.luogo, 'linate')
  assert.equal(ritorno.luogoDa, '15:00')
  // e passando anche da «Da definire» in mezzo
  const giro = cambiaTipo(cambiaTipo(cambiaTipo(RIFERIMENTO, 'da_definire'), 'struttura'), 'luogo')
  assert.equal(giro.luogo, 'linate')
  assert.equal(giro.luogoDa, '15:00')
  assert.equal(giro.stimaDa, '16:00')
  assert.equal(giro.navetta, 'massimo')
  assert.equal(giro.prelievo, '15:30')
})

test('RILIEVO CODEX: precisa/fascia e navetta/prelievo non cancellano la bozza', () => {
  const fascia = con({ tipo: 'struttura', modoStruttura: 'fascia', strutturaDa: '15:00', strutturaA: '17:00' })
  const precisa = cambiaModo(fascia, 'precisa')
  assert.equal(precisa.strutturaA, '17:00', 'la fine della fascia è stata cancellata')
  assert.equal(periodoInStruttura(precisa), '15:00', 'ma non conta più')
  assert.equal(periodoInStruttura(cambiaModo(precisa, 'fascia')), '15:00–17:00', 'e torna tornando indietro')

  const senzaNavetta = cambiaNavetta(RIFERIMENTO, 'non_richiesta')
  assert.equal(senzaNavetta.prelievo, '15:30', 'l’ora del prelievo è stata cancellata')
  assert.equal(campiArrivo(senzaNavetta).navetta_prelievo, null, 'ma non finisce sul server')
  assert.equal(cambiaNavetta(senzaNavetta, 'aldo').prelievo, '15:30', 'e torna scegliendo un autista')
})

test('il modo dell’orario è quello del tipo attivo, e le caselle scrivono solo lì', () => {
  const a = con({ tipo: 'luogo', luogo: 'linate', modoLuogo: 'fascia', modoStruttura: 'precisa' })
  assert.equal(modoAttivo(a), 'fascia')
  assert.equal(modoAttivo({ ...a, tipo: 'struttura' }), 'precisa')
  const scritto = scriviOra(a, 'da', '09:00')
  assert.equal(scritto.luogoDa, '09:00')
  assert.equal(scritto.strutturaDa, '', 'ha scritto anche nell’altra casella')
  const inStruttura = scriviOra({ ...a, tipo: 'struttura' }, 'da', '18:00')
  assert.equal(inStruttura.strutturaDa, '18:00')
  assert.equal(inStruttura.luogoDa, '', 'ha toccato l’ora del luogo')
})

test('«Da definire» non produce nessun orario finto, e nessuna mezzanotte', () => {
  const a = cambiaTipo(RIFERIMENTO, 'da_definire')
  const campi = campiArrivo(a)
  assert.equal(campi.check_in_time, null)
  assert.equal(campi.arrivo_luogo_ora_da, null)
  assert.equal(campi.arrivo_struttura_ora_da, null)
  assert.equal(campi.arrivo_stima_da, null)
  assert.equal(campi.arrivo_luogo, null)
  assert.equal(orarioIgnoto(a), true)
  // la navetta decisa non si perde per strada
  assert.equal(campi.navetta, 'massimo')
  // e la bozza sotto è ancora tutta lì
  assert.equal(a.luogoDa, '15:00')
})

test('sul server finisce SOLO la parte che il tipo rende vera', () => {
  const misto = con({
    tipo: 'struttura', strutturaDa: '18:00',
    luogo: 'linate', luogoDa: '15:00', stimaDa: '16:00', stimaA: '17:00',
  })
  const campi = campiArrivo(misto)
  assert.equal(campi.arrivo_struttura_ora_da, '18:00')
  assert.equal(campi.arrivo_luogo, null)
  assert.equal(campi.arrivo_luogo_ora_da, null)
  assert.equal(campi.arrivo_stima_da, null)
  assert.equal(campi.check_in_time, '18:00')
})

// ── 4. La fascia è libera, e «circa» è solo della stima ─────────────────────

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
  assert.equal(/DURATA_FASCIA|MINUTI_FASCIA|\+ 60|addMinuti/.test(leggi('lib/arrivo.ts')), false)
})

test('due ore uguali non sono una fascia, e una sola ora non ha bisogno del trattino', () => {
  assert.equal(periodoOre('16:00', '16:00'), '16:00')
  assert.equal(eFascia('16:00', '16:00'), false)
  assert.equal(periodoOre('16:00', ''), '16:00')
  assert.equal(periodoOre('', ''), '')
})

test('RILIEVO CODEX: «circa» solo per la stima di Ania, mai per una fascia detta dalla cliente', () => {
  // la cliente dice «arrivo fra le 15 e le 17»: è un dato, non una supposizione
  const detta = con({ tipo: 'struttura', modoStruttura: 'fascia', strutturaDa: '15:00', strutturaA: '17:00' })
  assert.equal(circaInStruttura(detta), false)
  assert.equal(arrivoInScheda(detta).titolo, 'In struttura fra le 15:00 e le 17:00')
  assert.equal(arrivoInHome(detta).circa, false)
  // la stima la fa Ania: lì «circa» ci vuole
  assert.equal(circaInStruttura(RIFERIMENTO), true)
  assert.equal(arrivoInHome(RIFERIMENTO).circa, true)
  // e l'ora precisa non prende né l'uno né l'altro
  assert.equal(circaInStruttura(con({ tipo: 'struttura', strutturaDa: '16:00' })), false)
  assert.equal(arrivoInScheda(con({ tipo: 'struttura', strutturaDa: '16:00' })).titolo, 'In struttura alle 16:00')
})

test('«orario ignoto» vuol dire che non si sa NIENTE: con «Linate alle 15:00» un orario c’è', () => {
  assert.equal(orarioIgnoto(con({ tipo: 'da_definire' })), true)
  assert.equal(orarioIgnoto(con({ tipo: 'struttura' })), true)
  assert.equal(orarioIgnoto(con({ tipo: 'luogo', luogo: 'linate' })), true)
  assert.equal(orarioIgnoto(con({ tipo: 'luogo', luogo: 'linate', luogoDa: '15:00' })), false)
  assert.equal(orarioIgnoto(RIFERIMENTO), false)
})

// ── 5. Leggere una prenotazione, con e senza la 0058 ────────────────────────

test('senza le colonne nuove l’arrivo si ricostruisce dalle due di sempre', () => {
  const vecchia = leggiArrivo({ check_in_time: '15:30', shuttle: 'si' })
  assert.equal(vecchia.tipo, 'struttura')
  assert.equal(vecchia.strutturaDa, '15:30')
  assert.equal(vecchia.navetta, 'da_assegnare')
  assert.equal(leggiArrivo({ check_in_time: null, shuttle: 'no' }).tipo, 'da_definire')
  assert.equal(leggiArrivo({ check_in_time: null, shuttle: 'no' }).navetta, 'non_richiesta')
  assert.equal(leggiArrivo({}).navetta, 'da_definire')
  assert.equal(leggiArrivo(null).tipo, 'da_definire')
})

test('con le colonne nuove si legge tutto, e si riscrive uguale (giro completo)', () => {
  const campi = campiArrivo(RIFERIMENTO)
  const riletto = leggiArrivo(campi)
  assert.deepEqual(campiArrivo(riletto), campi)
  assert.equal(riletto.luogo, 'linate')
  assert.equal(riletto.luogoDa, '15:00')
  assert.equal(riletto.stimaDa, '16:00')
  assert.equal(riletto.stimaA, '17:00')
  assert.equal(riletto.navetta, 'massimo')
  assert.equal(riletto.prelievo, '15:30')
})

test('un valore storto nelle colonne nuove non diventa una scelta inventata', () => {
  const a = leggiArrivo({ arrivo_tipo: 'chissà', arrivo_luogo: 'bergamo', navetta: 'giovanni', check_in_time: '15:00' })
  assert.equal(a.tipo, 'struttura')
  assert.equal(a.luogo, null)
  assert.equal(a.navetta, 'da_definire')
  assert.equal(leggiArrivo({ arrivo_tipo: 'luogo', arrivo_luogo: 'bergamo' }).luogo, null)
})

// ── 6. I controlli ──────────────────────────────────────────────────────────

test('i controlli: ora a metà, luogo non scelto, testo libero vuoto, fascia al contrario', () => {
  assert.equal(controllaArrivo(RIFERIMENTO), null)
  assert.equal(controllaArrivo(con({ tipo: 'struttura', strutturaDa: '15' })), ERRORE_ORA)
  assert.equal(controllaArrivo(con({ tipo: 'luogo' })), ERRORE_LUOGO)
  assert.equal(controllaArrivo(con({ tipo: 'luogo', luogo: 'altro', luogoAltro: '  ' })), ERRORE_LUOGO_ALTRO)
  assert.equal(controllaArrivo(con({ tipo: 'struttura', modoStruttura: 'fascia', strutturaDa: '17:00', strutturaA: '15:00' })), ERRORE_FASCIA)
  assert.equal(controllaArrivo(con({ tipo: 'luogo', luogo: 'linate', stimaDa: '18:00', stimaA: '16:00' })), ERRORE_FASCIA_STIMA)
  assert.equal(controllaArrivo(ARRIVO_VUOTO), null)
})

test('i controlli guardano solo la parte attiva: una bozza a metà nell’altro tipo non blocca', () => {
  // ha scritto «15» nell'ora del luogo, poi è passata a «In struttura»
  const a = con({ tipo: 'struttura', strutturaDa: '18:00', luogoDa: '15', luogo: 'linate' })
  assert.equal(controllaArrivo(a), null, 'una casella dell’altro tipo blocca il salvataggio')
  // e tornando al luogo il problema si rivede
  assert.equal(controllaArrivo({ ...a, tipo: 'luogo' }), ERRORE_ORA)
})

// ── 7. SUPERFICIE 1: il modulo ──────────────────────────────────────────────

test('il modulo mostra solo quello che serve: luogo e stima solo con «Arrivo a…»', () => {
  const daDefinire = pianoModuloArrivo(con({ tipo: 'da_definire' }))
  assert.equal(daDefinire.luogo, null)
  assert.equal(daDefinire.orario, null, 'con «Da definire» chiede comunque un orario')
  assert.equal(daDefinire.caselleOrario, 0)
  assert.equal(daDefinire.stima, false)

  const struttura = pianoModuloArrivo(con({ tipo: 'struttura' }))
  assert.equal(struttura.luogo, null)
  assert.equal(struttura.stima, false, 'la stima non ha senso se arriva già in struttura')
  assert.equal(struttura.caselleOrario, 1)

  const luogo = pianoModuloArrivo(RIFERIMENTO)
  assert.equal(luogo.luogo?.length, 7)
  assert.equal(luogo.stima, true)
  assert.equal(luogo.luogoAltro, false)
  assert.equal(pianoModuloArrivo(con({ tipo: 'luogo', luogo: 'altro', luogoAltro: 'x' })).luogoAltro, true)
})

test('il modulo: le caselle mostrano l’ora del tipo attivo, e il prelievo solo se serve', () => {
  assert.equal(pianoModuloArrivo(RIFERIMENTO).oraDa, '15:00')
  assert.equal(pianoModuloArrivo({ ...RIFERIMENTO, tipo: 'struttura', strutturaDa: '18:00' }).oraDa, '18:00')
  assert.equal(pianoModuloArrivo(con({ tipo: 'struttura', modoStruttura: 'fascia', strutturaDa: '15:00', strutturaA: '17:00' })).caselleOrario, 2)
  assert.equal(pianoModuloArrivo(RIFERIMENTO).prelievo, true)
  assert.equal(pianoModuloArrivo(con({ navetta: 'da_assegnare' })).prelievo, true)
  assert.equal(pianoModuloArrivo(con({ navetta: 'da_definire' })).prelievo, false)
  assert.equal(pianoModuloArrivo(con({ navetta: 'non_richiesta' })).prelievo, false)
})

// ── 8. SUPERFICIE 2: la scheda ──────────────────────────────────────────────

test('la scheda, il caso del riferimento: «In struttura circa 16:00–17:00» e sotto «Arriva a Linate alle 15:00»', () => {
  assert.deepEqual(arrivoInScheda(RIFERIMENTO), { titolo: 'In struttura circa 16:00–17:00', sotto: 'Arriva a Linate alle 15:00' })
  assert.deepEqual(navettaInScheda(RIFERIMENTO), { titolo: 'Massimo', sotto: 'Prelievo a Linate · 15:30' })
})

test('la scheda, gli altri casi: senza stima comanda il luogo, e si dice che l’ora in casa manca', () => {
  assert.deepEqual(arrivoInScheda(con({ tipo: 'luogo', luogo: 'linate', luogoDa: '15:00' })),
    { titolo: 'Arriva a Linate alle 15:00', sotto: 'Orario in struttura da definire' })
  assert.deepEqual(arrivoInScheda(con({ tipo: 'struttura' })), { titolo: 'In struttura · orario da definire', sotto: null })
  assert.deepEqual(arrivoInScheda(con({ tipo: 'da_definire' })), { titolo: 'Arrivo da definire', sotto: null })
  assert.equal(rigaLuogo(con({ tipo: 'luogo', luogo: 'malpensa', modoLuogo: 'fascia', luogoDa: '15:00', luogoA: '16:00' })),
    'Arriva a Malpensa fra le 15:00 e le 16:00')
  assert.equal(rigaLuogo(con({ tipo: 'luogo', luogo: 'rogoredo' })), 'Arriva a Rogoredo · orario da definire')
})

test('«Centrale» resta il nome della pastiglia, ma nelle frasi si scrive «Milano Centrale»', () => {
  assert.equal(LUOGHI.find(l => l.chiave === 'centrale')?.nome, 'Centrale')
  assert.equal(nomeLuogo(con({ tipo: 'luogo', luogo: 'centrale' })), 'Milano Centrale')
  assert.equal(rigaLuogo(con({ tipo: 'luogo', luogo: 'centrale', luogoDa: '15:00' })), 'Arriva a Milano Centrale alle 15:00')
})

test('«Altro luogo…»: nelle frasi comanda il testo che ha scritto Ania', () => {
  const a = con({ tipo: 'luogo', luogo: 'altro', luogoAltro: ' casa di sua sorella ', luogoDa: '19:00' })
  assert.equal(nomeLuogo(a), 'casa di sua sorella')
  assert.equal(rigaLuogo(a), 'Arriva a casa di sua sorella alle 19:00')
})

test('la navetta nella scheda: i tre stati si dicono per quello che sono', () => {
  assert.deepEqual(navettaInScheda(con({ navetta: 'non_richiesta' })), { titolo: 'Non richiesta', sotto: null })
  assert.deepEqual(navettaInScheda(con({ navetta: 'da_definire' })), { titolo: 'Da definire', sotto: 'Da chiedere all’ospite' })
  assert.deepEqual(navettaInScheda(con({ navetta: 'da_assegnare' })), { titolo: 'Da assegnare', sotto: 'Autista ancora da scegliere' })
  assert.equal(navettaInScheda(con({ tipo: 'luogo', luogo: 'orio_al_serio', navetta: 'da_assegnare', prelievo: '09:00' })).sotto,
    'Prelievo a Orio al Serio · 09:00')
  assert.equal(rigaPrelievo(con({ navetta: 'alberto', prelievo: '15:30' })), 'Prelievo alle 15:30')
  assert.equal(rigaPrelievo(con({ navetta: 'alberto' })), null)
  assert.equal(rigaPrelievo(con({ navetta: 'non_richiesta', prelievo: '15:30' })), null)
})

// ── 9. La TESTA della scheda (rilievo di Codex) ─────────────────────────────

test('RILIEVO CODEX: la testa legge il modello e non perde fascia, «circa» e autista', () => {
  const t = arrivoTestaDaArrivo(RIFERIMENTO)
  assert.equal(t.orario, 'Arriva circa 16:00–17:00', 'la testa riduce la stima alla sola ora iniziale')
  assert.equal(t.navetta, `${CON_NAVETTA} · Massimo`, 'la testa non dice quale autista')
  // fascia detta dalla cliente: niente «circa», ma la fine c'è
  const detta = con({ tipo: 'struttura', modoStruttura: 'fascia', strutturaDa: '15:00', strutturaA: '17:00' })
  assert.equal(arrivoTestaDaArrivo(detta).orario, 'Arriva 15:00–17:00')
  // e quando non c'è niente in più le parole sono quelle di sempre
  assert.equal(arrivoTestaDaArrivo(con({ tipo: 'struttura', strutturaDa: '15:10' })).orario, 'Arriva alle 15:10')
  assert.equal(arrivoTestaDaArrivo(con({ navetta: 'da_definire' })).navetta, NAVETTA_DA_VERIFICARE)
  assert.equal(arrivoTestaDaArrivo(con({ navetta: 'non_richiesta' })).navetta, NAVETTA_NON_RICHIESTA)
  assert.equal(arrivoTestaDaArrivo(con({ navetta: 'da_assegnare' })).navetta, CON_NAVETTA)
  assert.equal(arrivoTestaDaArrivo(con({ tipo: 'da_definire' })).orario, ORARIO_DA_DEFINIRE)
  assert.equal(arrivoTestaDaArrivo(con({ tipo: 'da_definire' })).orarioDaDefinire, true)
  // «Linate alle 15:00» senza stima: la testa NON dice «arriva alle 15:00»
  assert.equal(arrivoTestaDaArrivo(con({ tipo: 'luogo', luogo: 'linate', luogoDa: '15:00' })).orario, ORARIO_DA_DEFINIRE)
})

test('la scheda monta la testa col modello, non con le due colonne di sempre', () => {
  const pagina = leggi('app/scheda/[id]/page.tsx')
  assert.match(pagina, /const arrivoTestaTesto = arrivoTestaDaArrivo\(arrivoDati\)/)
  assert.equal(/arrivoTesta\(primoSegmento/.test(pagina), false, 'la testa legge ancora check_in_time e shuttle')
})

test('anche «Arrivi precedenti» legge il modello: niente fasce troncate nello storico', () => {
  const storico = leggi('components/scheda/ArriviPrecedenti.tsx')
  assert.match(storico, /leggiArrivo\(primo as unknown as Record<string, unknown>\)/)
  assert.equal(/primo\?\.check_in_time \?/.test(storico), false)
})

// ── 10. SUPERFICIE 3: gli Arrivi della Home ─────────────────────────────────

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
  assert.equal(arrivoInHome(con({ tipo: 'luogo', luogo: 'centrale', luogoDa: '15:00' })).righe[0].icona, 'treno')
  assert.equal(arrivoInHome(con({ tipo: 'luogo', luogo: 'centrale', luogoDa: '15:00' })).righe[0].sotto, 'Arrivo in stazione')
  assert.equal(arrivoInHome(con({ tipo: 'luogo', luogo: 'san_donato', luogoDa: '15:00' })).righe[0].icona, 'treno')
  assert.equal(arrivoInHome(con({ tipo: 'luogo', luogo: 'malpensa', luogoDa: '15:00' })).righe[0].icona, 'aereo')
  const altro = arrivoInHome(con({ tipo: 'luogo', luogo: 'altro', luogoAltro: 'Piazza Duomo', luogoDa: '15:00' }))
  assert.deepEqual(altro.righe[0], { icona: 'luogo', forte: 'Piazza Duomo · 15:00', sotto: 'Arrivo sul posto' })
})

test('la Home: senza ora in struttura lo dice, senza inventare numeri', () => {
  const h = arrivoInHome(con({ tipo: 'luogo', luogo: 'linate', luogoDa: '15:00' }))
  assert.equal(h.grande, 'Da definire')
  assert.equal(h.numerico, false)
  assert.equal(h.circa, false)
  assert.equal(h.sotto, 'Orario in struttura da definire')
  assert.equal(h.righe[0].forte, 'Linate · 15:00')
})

// SCELTA DI ANIA, 21/09/2026 sera (confronto «C/D», ritagliato e segnato):
// la riga «Navetta da definire» negli Arrivi della Home RESTA. Le era stata
// proposta anche la versione senza — la navetta solo quando serve davvero —
// e ha scelto di tenerla: è il promemoria di chiedere, sotto gli occhi.
// Non toglierla senza una sua richiesta esplicita.
test('la Home: «Non richiesta» non occupa una riga, «Da definire» sì (scelta «C» di Ania)', () => {
  assert.deepEqual(arrivoInHome(con({ tipo: 'struttura', strutturaDa: '16:00', navetta: 'non_richiesta' })).righe, [])
  assert.deepEqual(arrivoInHome(con({ tipo: 'struttura', strutturaDa: '16:00', navetta: 'da_definire' })).righe,
    [{ icona: 'auto', forte: 'Navetta da definire', sotto: 'Da chiedere all’ospite' }])
  assert.deepEqual(arrivoInHome(con({ tipo: 'struttura', strutturaDa: '16:00', navetta: 'da_assegnare' })).righe,
    [{ icona: 'auto', forte: 'Autista da assegnare', sotto: 'Navetta in struttura' }])
  const preciso = arrivoInHome(con({ tipo: 'struttura', strutturaDa: '16:00' }))
  assert.deepEqual([preciso.grande, preciso.circa, preciso.sotto], ['16:00', false, 'Arrivo in struttura'])
})

test('RILIEVO CODEX: la Home non perde niente di quello che c’era', () => {
  const home = leggi('app/page.tsx')
  const card = leggi('components/ArriviOggi.tsx')
  // la riga CHECK-IN è rimasta dov'era, con la nota rossa e il letto in più
  assert.match(home, /CHECK-IN/)
  assert.match(home, /\+letto agg\./)
  assert.match(home, /data-nota-cliente-home/)
  assert.match(home, /text-\[13px\] leading-snug font-semibold/)
  assert.match(home, /CHECK-OUT/)
  assert.match(home, /⇄ CAMBIO/)
  // e il riquadro nuovo si aggiunge, col letto in più anche lì
  assert.match(home, /<ArriviOggi oggi=\{data\.checkInOggi\} domani=\{data\.checkInDomani\} \/>/)
  assert.match(card, /data-letto-agg/)
  // la nota NON si ripete nel riquadro: sarebbe due volte in rosso sullo stesso schermo
  assert.equal(/data-nota-cliente-home/.test(card), false)
})

// ── 11. IL SALVATAGGIO (i due bloccanti di Codex) ───────────────────────────

const ok = (righe = 1) => () => Promise.resolve({ data: Array.from({ length: righe }, (_, i) => ({ id: `r${i}` })), error: null })
const senzaColonne = () => Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'arrivo_tipo' column of 'bookings' in the schema cache" } })
const permessiNegati = () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for table bookings' } })
const vincoloViolato = () => Promise.resolve({ data: null, error: { code: '23514', message: 'new row violates check constraint' } })
/** la rilettura restituisce la riga come sarebbe DOPO aver scritto `campi` */
const rileggiCon = (campi: Record<string, unknown>) => () => Promise.resolve({ data: [campi], error: null })

test('RILIEVO CODEX 1: un errore di PERMESSI non fa ripiegare, e non nomina nessuna migrazione', async () => {
  const scritte: Record<string, string | null>[] = []
  const esito = await salvaArrivoPrenotazione(campi => { scritte.push(campi); return permessiNegati() }, RIFERIMENTO)
  assert.equal(esito.esito, 'errore')
  assert.equal(esito.messaggio, MESSAGGIO_NON_SALVATO)
  assert.equal(scritte.length, 1, 'ha scritto una seconda volta dopo un errore di permessi')
  assert.equal(esito.campi, null)
})

test('RILIEVO CODEX 1: nemmeno un vincolo violato o la rete caduta fanno ripiegare', async () => {
  let tentativi = 0
  const conVincolo = await salvaArrivoPrenotazione(() => { tentativi += 1; return vincoloViolato() }, RIFERIMENTO)
  assert.equal(conVincolo.esito, 'errore')
  assert.equal(tentativi, 1)

  // La rete caduta NON fa ripiegare, e dal terzo giro (21/09/2026) non dice
  // più «non salvato»: senza risposta la scrittura può essere passata lo
  // stesso, e senza rilettura non si può saperlo. Vedi «CASO 1» in fondo.
  tentativi = 0
  const senzaRete = await salvaArrivoPrenotazione(() => { tentativi += 1; return Promise.reject(new TypeError('Failed to fetch')) }, RIFERIMENTO)
  assert.equal(senzaRete.esito, 'incerto')
  assert.equal(senzaRete.campi, null)
  assert.equal(tentativi, 1)
})

test('RILIEVO CODEX 1: colonna mancante + dettagli da perdere → NON si salva niente, e la bozza resta', async () => {
  const scritte: Record<string, string | null>[] = []
  const esito = await salvaArrivoPrenotazione(campi => { scritte.push(campi); return senzaColonne() }, RIFERIMENTO)
  assert.equal(esito.esito, 'senza_posto')
  assert.equal(scritte.length, 1, 'ha scritto lo stesso, perdendo luogo e autista')
  assert.equal(esito.campi, null)
  // il messaggio dice cosa manca, in parole di tutti i giorni
  assert.match(esito.messaggio!, /il luogo dell’arrivo/)
  assert.match(esito.messaggio!, /quale autista/)
  assert.match(esito.messaggio!, /è rimasto qui/)
  // e NON parla di SQL, migrazioni, colonne o Supabase
  assert.equal(/SQL|migrazione|colonna|Supabase|0058/i.test(esito.messaggio!), false, 'c’è del gergo tecnico nel messaggio')
})

test('RILIEVO CODEX 1: colonna mancante ma NIENTE da perdere → si salva con le due di sempre, senza avvisi', async () => {
  const semplice = con({ tipo: 'struttura', strutturaDa: '16:00', navetta: 'non_richiesta' })
  assert.deepEqual(perditeSenza0058(semplice), [])
  const scritte: Record<string, string | null>[] = []
  let giro = 0
  const esito = await salvaArrivoPrenotazione(
    campi => { scritte.push(campi); giro += 1; return giro === 1 ? senzaColonne() : ok()() },
    semplice,
    rileggiCon({ check_in_time: '16:00', shuttle: 'no' }),
  )
  assert.equal(esito.esito, 'ok')
  assert.equal(esito.messaggio, null, 'un salvataggio che non perde niente non deve avvisare di niente')
  assert.deepEqual(scritte[1], { check_in_time: '16:00', shuttle: 'no' })
})

test('le perdite si sanno in anticipo, e sono esattamente quelle che le due colonne non tengono', () => {
  assert.deepEqual(perditeSenza0058(con({ tipo: 'struttura', strutturaDa: '16:00' })), [])
  assert.deepEqual(perditeSenza0058(con({ tipo: 'da_definire', navetta: 'da_assegnare' })), [])
  assert.deepEqual(perditeSenza0058(con({ tipo: 'struttura', modoStruttura: 'fascia', strutturaDa: '15:00', strutturaA: '17:00' })), ['la fascia oraria'])
  assert.deepEqual(perditeSenza0058(con({ navetta: 'aldo' })), ['quale autista'])
  assert.deepEqual(perditeSenza0058(con({ navetta: 'da_assegnare', prelievo: '15:30' })), ['l’ora del prelievo'])
  assert.deepEqual(perditeSenza0058(RIFERIMENTO), ['il luogo dell’arrivo', 'la fine della stima in struttura', 'quale autista', 'l’ora del prelievo'])
  assert.match(messaggioSenzaPosto(['il luogo dell’arrivo']), /tenere da conto il luogo dell’arrivo/)
  assert.match(messaggioSenzaPosto(['a', 'b', 'c']), /a, b e c/)
})

test('RILIEVO CODEX 2: «nessuna riga toccata» NON è un successo', async () => {
  const esito = await salvaArrivoPrenotazione(() => Promise.resolve({ data: [], error: null }), RIFERIMENTO)
  assert.equal(esito.esito, 'incerto')
  assert.equal(esito.messaggio, MESSAGGIO_INCERTO)
  assert.equal(esito.campi, null, 'la pagina si sarebbe aggiornata senza che niente fosse cambiato')
})

test('RILIEVO CODEX 2: si rilegge, e quello che va a schermo è la riga del SERVER', async () => {
  const salvato = campiArrivo(RIFERIMENTO)
  const esito = await salvaArrivoPrenotazione(ok(), RIFERIMENTO, rileggiCon({ ...salvato, id: 'b1' }))
  assert.equal(esito.esito, 'ok')
  assert.equal((esito.campi as Record<string, unknown>).id, 'b1', 'non ha messo in pagina la riga riletta')
  assert.equal(esito.arrivo?.luogo, 'linate')
  assert.equal(esito.arrivo?.prelievo, '15:30')
})

test('RILIEVO CODEX 2: se la rilettura non torna, o non combacia, l’esito è incerto', async () => {
  const persa = await salvaArrivoPrenotazione(ok(), RIFERIMENTO, () => Promise.resolve({ data: [], error: null }))
  assert.equal(persa.esito, 'incerto')
  assert.equal(persa.campi, null)

  const rotta = await salvaArrivoPrenotazione(ok(), RIFERIMENTO, () => Promise.reject(new Error('boom')))
  assert.equal(rotta.esito, 'incerto')

  // la riga sul server dice un'altra cosa: qualcun altro ha scritto in mezzo
  const diversa = await salvaArrivoPrenotazione(ok(), RIFERIMENTO, rileggiCon({ check_in_time: '09:00', shuttle: 'no' }))
  assert.equal(diversa.esito, 'incerto')
  assert.equal(diversa.campi, null)

  // SECONDO GIRO (21/09/2026): cambiare solo l'AUTISTA non sposta né
  // check_in_time né shuttle. Confrontando quelle due sole colonne un
  // salvataggio non passato sembrava riuscito: adesso si guardano tutte.
  const soloAutista = { ...campiArrivo(RIFERIMENTO), navetta: 'massimo' }
  const nonPassato = await salvaArrivoPrenotazione(ok(), { ...RIFERIMENTO, navetta: 'alberto' }, rileggiCon(soloAutista))
  assert.equal(nonPassato.esito, 'incerto', 'il cambio di autista non passato è stato dato per riuscito')
  // Una rilettura che NON ha le colonne attese non conferma niente: prima
  // le colonne assenti si saltavano, ed erano proprio i dettagli richiesti
  // a sparire (caso 2 del secondo ricontrollo). La compatibilità con le due
  // sole colonne vive nel ramo del ripiego, non su qualunque rilettura.
  const povera = await salvaArrivoPrenotazione(ok(), con({ tipo: 'struttura', strutturaDa: '16:00', navetta: 'non_richiesta' }),
    rileggiCon({ id: 'b1', check_in_time: '16:00', shuttle: 'no' }))
  assert.equal(povera.esito, 'incerto')
})

test('un arrivo con un guaio non tocca il server', async () => {
  let chiamate = 0
  const esito = await salvaArrivoPrenotazione(() => { chiamate += 1; return ok()() }, con({ tipo: 'luogo' }))
  assert.equal(chiamate, 0, 'ha scritto lo stesso')
  assert.equal(esito.esito, 'errore')
  assert.equal(esito.messaggio, ERRORE_LUOGO)
})

// ── 12. Le guardie sui sorgenti ─────────────────────────────────────────────
// La lezione della regola fissa n. 1 (i nomi, persi tre volte): un dato, un
// modulo, un salvataggio.

const PUNTI_DI_INGRESSO = [
  'app/nuova-prenotazione/page.tsx',
  'app/nuova/page.tsx',
  'app/arrivi/page.tsx',
  'app/prenotazioni/[id]/page.tsx',
  'components/scheda/FoglioArrivo.tsx',
]
const INGRESSI_CHE_MODIFICANO = [
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
  for (const f of [...PUNTI_DI_INGRESSO, 'app/page.tsx', 'components/ArriviOggi.tsx']) {
    const codice = soloCodice(f)
    assert.equal(/check_in_time:\s/.test(codice), false, `${f} scrive check_in_time da sé`)
    assert.equal(/shuttle:\s/.test(codice), false, `${f} scrive shuttle da sé`)
  }
  const arrivo = soloCodice('lib/arrivo.ts')
  assert.match(arrivo, /export function campiArrivoVecchi/)
  assert.equal(arrivo.match(/check_in_time: oraInStruttura\(a\) \|\| null/g)?.length, 1)
  assert.equal(arrivo.match(/shuttle: a\.navetta ===/g)?.length, 1)
})

test('RILIEVO CODEX 2: ogni ingresso che modifica chiede indietro la riga, rilegge e ha il freno sincrono', () => {
  for (const f of INGRESSI_CHE_MODIFICANO) {
    const codice = leggi(f)
    assert.match(codice, /salvaArrivoPrenotazione\(/, `${f} non usa il salvataggio condiviso`)
    assert.match(codice, /\.update\(campi\)\.eq\('id', \w+\)\.select\('id'\)/, `${f} non si fa ridare le righe scritte`)
    assert.match(codice, /\.select\('\*'\)\.eq\('id', \w+\)\.limit\(1\)/, `${f} non rilegge la riga`)
    assert.match(codice, /useRef\(false\)/, `${f} non ha il freno sincrono al doppio tocco`)
    assert.match(codice, /esito\.esito !== 'ok'/, `${f} chiude anche quando non ha salvato`)
  }
  assert.match(leggi('lib/arrivoDati.ts'), /const problema = controllaArrivo\(arrivo\)/)
})

test('nessun testo tecnico davanti ad Ania: né SQL, né numeri di migrazione', () => {
  const daLeggere = [...INGRESSI_CHE_MODIFICANO, 'lib/arrivoDati.ts', 'lib/arrivo.ts', 'lib/nuovaPrenotazione.ts', 'app/nuova/page.tsx']
  for (const f of daLeggere) {
    // le stringhe fra apici singoli o backtick che finiscono a schermo
    const testi = soloCodice(f).match(/'[^'\n]{25,}'|`[^`\n]{25,}`/g) ?? []
    for (const t of testi) {
      assert.equal(/\bSQL\b|migrazione|Supabase|PGRST|colonna shuttle/i.test(t), false, `${f} mostra gergo tecnico: ${t}`)
    }
  }
})

test('il gestionale non calcola tragitti: nessun servizio esterno, nessuna stima automatica', () => {
  for (const f of ['lib/arrivo.ts', 'lib/arrivoDati.ts', 'components/ArrivoNavetta.tsx', 'components/ArriviOggi.tsx']) {
    assert.equal(/fetch\(|maps\.|googleapis|tempoDiViaggio|stimaAutomatica/i.test(soloCodice(f)), false, `${f} sembra calcolare o chiedere fuori`)
  }
  assert.match(leggi('lib/arrivo.ts'), /export const AIUTO_STIMA = 'Una tua stima, modificabile'/)
  assert.match(leggi('components/ArrivoNavetta.tsx'), /\{AIUTO_STIMA\}/)
})

test('«manca l’orario» guarda l’arrivo vero, e il promemoria delle 17 passa di lì', () => {
  assert.match(leggi('lib/daControllare.ts'), /orarioIgnoto\(leggiArrivo\(/)
  assert.match(leggi('lib/navetta.ts'), /const mancaOrario = orarioIgnoto\(leggiArrivo\(b\)\)/)
  // il percorso del promemoria: la route lo chiede a lib/navetta.cosaManca
  const route = leggi('app/api/push/orario/route.ts')
  assert.match(route, /import \{ cosaManca \} from '@\/lib\/navetta'/)
  assert.match(route, /cosaManca\(b\)/)
})

test('la migrazione 0058 c’è fra quelle APPLICATE, con piano e ripristino, e non accetta le 29:00', () => {
  // applicata sul progetto vero il 21/09/2026 sera: sta in migrations,
  // non più fra le proposte (stessa strada della 0057)
  const sql = leggi('supabase/migrations/0058_arrivo_e_navetta.sql')
  for (const c of ['arrivo_tipo', 'arrivo_luogo', 'arrivo_luogo_altro',
    'arrivo_luogo_ora_da', 'arrivo_luogo_ora_a', 'arrivo_struttura_ora_da',
    'arrivo_struttura_ora_a', 'arrivo_stima_da', 'arrivo_stima_a',
    'navetta', 'navetta_prelievo']) {
    assert.match(sql, new RegExp(`add column if not exists ${c} text`), `manca la colonna ${c}`)
  }
  // il codice e il database conoscono esattamente le stesse colonne
  assert.equal((sql.match(/add column if not exists/g) ?? []).length, 11)
  for (const c of COLONNE_0058) assert.ok(sql.includes(`add column if not exists ${c} `), `il database non conosce ${c}`)
  // RILIEVO CODEX: la regex di prima accettava «29:00»
  const regexOre = /\^\(\[01\]\[0-9\]\|2\[0-3\]\):\[0-5\]\[0-9\]\$/
  assert.match(sql, regexOre)
  const provaOra = new RegExp('^([01][0-9]|2[0-3]):[0-5][0-9]$')
  assert.equal(provaOra.test('29:00'), false)
  assert.equal(provaOra.test('23:59'), true)
  assert.equal(provaOra.test('00:00'), true)
  assert.equal(provaOra.test('24:00'), false)
  // le fasce coerenti anche nel database
  assert.match(sql, /bookings_arrivo_fascia_luogo_check/)
  assert.match(sql, /bookings_arrivo_fascia_stima_check/)
  // niente dati toccati, e tutto in una transazione
  assert.equal(/update public\.bookings set|insert into public\.bookings|drop column/.test(sql), false, 'la migrazione tocca i dati')
  assert.match(sql, /^begin;$/m)
  assert.match(sql, /^commit;$/m)
  // piano e ripristino, chiesti dalla verifica
  const piano = leggi('supabase/proposte/0058_PIANO_APPLICAZIONE.md')
  assert.match(piano, /Prima di applicare/)
  assert.match(piano, /notify pgrst, 'reload schema'/)
  assert.match(piano, /APPLICATA il 21\/09\/2026|Applicazione sul progetto vero — FATTA/)
  const ripristino = leggi('supabase/proposte/0058_RIPRISTINO.BOZZA.sql')
  assert.equal((ripristino.match(/drop column if exists/g) ?? []).length, 11)
  assert.match(ripristino, /COPIA DI SICUREZZA/)
  assert.equal(/drop column if exists check_in_time|drop column if exists shuttle/.test(ripristino), false)
})

// ── 13. I TRE CASI DEL SECONDO RICONTROLLO (Codex, su 07dc6e7) ─────────────
// Tutti e tre riprodotti sul salvataggio vero, con scrittore e rilettore
// finti. Sotto ogni prova c'è scritto cosa faceva PRIMA e cosa fa ADESSO.

/** un server che applica davvero il payload alla sua riga */
function serverFinto(riga: Record<string, unknown>) {
  const stato = { ...riga }
  return {
    stato,
    /** scrive e risponde con l'id, come `.select('id')` */
    scrivi: (campi: Record<string, string | null>) => { Object.assign(stato, campi); return Promise.resolve({ data: [{ id: stato.id }], error: null }) },
    /** scrive e POI muore senza risposta (rete caduta a metà) */
    scriviPoiCade: (campi: Record<string, string | null>) => { Object.assign(stato, campi); return Promise.reject(new TypeError('Failed to fetch')) },
    /** rilegge tutta la riga, come `.select('*')` */
    rileggi: () => Promise.resolve({ data: [{ ...stato }], error: null }),
    /** rilegge una riga INCOMPLETA: solo le due colonne di sempre */
    rileggiPovera: () => Promise.resolve({ data: [{ id: stato.id, check_in_time: stato.check_in_time ?? null, shuttle: stato.shuttle ?? null }], error: null }),
  }
}
/** una riga con la 0058 applicata e i dettagli già scritti: Linate 15:00, Massimo */
const rigaLinateMassimo = () => ({ id: 'b1', ...campiArrivo(RIFERIMENTO) })
/** una riga di un database SENZA la 0058: esistono solo le due colonne */
const rigaVecchia = () => ({ id: 'b1', check_in_time: '16:00', shuttle: 'si' })

test('CASO 1 · scrittura passata ma risposta persa: NON si dice «non salvato»', async () => {
  // PRIMA: esito «errore» con «Non salvato, riprova: nessuna connessione»,
  //        mentre sul server Massimo era già scritto.
  // ADESSO: si rilegge, la riga conferma tutto → esito «ok».
  const s = serverFinto({ id: 'b1', check_in_time: null, shuttle: null })
  const esito = await salvaArrivoPrenotazione(s.scriviPoiCade, RIFERIMENTO, s.rileggi)
  assert.equal(esito.esito, 'ok', 'ha detto «non salvato» su una scrittura passata')
  assert.equal(esito.messaggio, null)
  assert.equal(esito.arrivo?.navetta, 'massimo')
  assert.equal(s.stato.navetta, 'massimo')
})

test('CASO 1 · la risposta si perde e la riga dice un’altra cosa: incerto, non «non salvato»', async () => {
  // Dal terzo giro (21/09/2026): una rilettura diversa NON dimostra che la
  // scrittura sia fallita — può essere ancora in viaggio. Vedi «CASO 4».
  const s = serverFinto({ id: 'b1', ...campiArrivo(con({ tipo: 'struttura', strutturaDa: '09:00', navetta: 'non_richiesta' })) })
  const esito = await salvaArrivoPrenotazione(() => Promise.reject(new TypeError('Failed to fetch')), RIFERIMENTO, s.rileggi)
  assert.equal(esito.esito, 'incerto')
  assert.equal(esito.messaggio, MESSAGGIO_IN_VOLO)
  assert.equal(esito.campi, null)
})

test('CASO 1 · risposta persa e rilettura pure: incerto, non «non salvato»', async () => {
  const esito = await salvaArrivoPrenotazione(
    () => Promise.reject(new TypeError('Failed to fetch')), RIFERIMENTO,
    () => Promise.reject(new Error('anche la rilettura è caduta')))
  assert.equal(esito.esito, 'incerto')
  assert.equal(esito.messaggio, MESSAGGIO_IN_VOLO)
})

test('CASO 1 · un errore RISPOSTO dal server resta certo: la sua transazione è annullata', async () => {
  let scritture = 0
  const esito = await salvaArrivoPrenotazione(
    () => { scritture += 1; return Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } }) },
    RIFERIMENTO, () => Promise.resolve({ data: [rigaLinateMassimo()], error: null }))
  assert.equal(esito.esito, 'errore')
  assert.equal(esito.messaggio, MESSAGGIO_NON_SALVATO)
  assert.equal(scritture, 1)
})

test('CASO 2 · rilettura INCOMPLETA: non conferma niente, esito incerto', async () => {
  // PRIMA: la rilettura tornava {id, check_in_time: null, shuttle: 'si'};
  //        il confronto saltava tutte le colonne assenti e dava «ok», con
  //        l'arrivo ricomposto in «da definire / da assegnare».
  // ADESSO: mancano le colonne attese → incerto, la pagina non cambia.
  const s = serverFinto({ id: 'b1' })
  const esito = await salvaArrivoPrenotazione(s.scrivi, RIFERIMENTO, s.rileggiPovera)
  assert.equal(esito.esito, 'incerto', 'una rilettura incompleta è passata per conferma')
  assert.equal(esito.campi, null)
  assert.equal(esito.arrivo, null)
})

test('CASO 2 · la rilettura completa conferma, e l’arrivo che torna è quello giusto', async () => {
  const s = serverFinto({ id: 'b1' })
  const esito = await salvaArrivoPrenotazione(s.scrivi, RIFERIMENTO, s.rileggi)
  assert.equal(esito.esito, 'ok')
  assert.equal(esito.arrivo?.luogo, 'linate')
  assert.equal(esito.arrivo?.luogoDa, '15:00')
  assert.equal(esito.arrivo?.navetta, 'massimo')
  assert.equal((esito.campi as Record<string, unknown>).id, 'b1')
})

test('CASO 2 · confrontaRiga: manca una colonna attesa → incompleta, non uguale', () => {
  const attese = campiArrivo(RIFERIMENTO)
  assert.equal(confrontaRiga({ ...attese }, attese), 'uguale')
  assert.equal(confrontaRiga({ check_in_time: '16:00', shuttle: 'si' }, attese), 'incompleta')
  assert.equal(confrontaRiga({ ...attese, navetta: 'aldo' }, attese), 'diversa')
  // nel ramo senza 0058 le attese sono due sole, e due bastano
  assert.equal(confrontaRiga({ id: 'b1', check_in_time: '16:00', shuttle: 'no' }, { check_in_time: '16:00', shuttle: 'no' }), 'uguale')
})

test('CASO 3 · cache vecchia su una riga CHE HA GIÀ i dettagli: non si scrive niente', async () => {
  // PRIMA: il ripiego scriveva check_in_time 18:00 e shuttle 'no' sopra una
  //        riga che diceva ancora Linate/Massimo. L'esito era «incerto», ma
  //        l'incoerenza era già sul server.
  // ADESSO: si guarda la riga PRIMA di ripiegare; ci sono dettagli → stop.
  const s = serverFinto(rigaLinateMassimo())
  const semplice = con({ tipo: 'struttura', strutturaDa: '18:00', navetta: 'non_richiesta' })
  assert.deepEqual(perditeSenza0058(semplice), [], 'il caso è proprio quello senza perdite')
  const esito = await salvaArrivoPrenotazione(
    campi => ('arrivo_tipo' in campi
      ? Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'arrivo_tipo' column of 'bookings' in the schema cache" } })
      : s.scrivi(campi)),
    semplice, s.rileggi)
  assert.equal(esito.esito, 'senza_posto')
  assert.equal(esito.messaggio, MESSAGGIO_DETTAGLI_ESISTENTI)
  // e sul server NON è cambiato niente: nessuna riga mezza vecchia e mezza nuova
  assert.equal(s.stato.check_in_time, '16:00')
  assert.equal(s.stato.shuttle, 'si')
  assert.equal(s.stato.arrivo_luogo, 'linate')
  assert.equal(s.stato.navetta, 'massimo')
})

test('CASO 3 · database DAVVERO senza 0058: il ripiego funziona come prima', async () => {
  // La compatibilità vera col vecchio schema: la riga non ha nessuna colonna
  // nuova, quindi non c'è niente da contraddire e si scrive.
  const s = serverFinto(rigaVecchia())
  const semplice = con({ tipo: 'struttura', strutturaDa: '18:00', navetta: 'non_richiesta' })
  const scritte: Record<string, string | null>[] = []
  const esito = await salvaArrivoPrenotazione(
    campi => { scritte.push(campi); return 'arrivo_tipo' in campi
      ? Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'arrivo_tipo' column of 'bookings' in the schema cache" } })
      : s.scrivi(campi) },
    semplice, s.rileggi)
  assert.equal(esito.esito, 'ok')
  assert.equal(esito.messaggio, null, 'un salvataggio che non perde niente non deve avvisare')
  assert.deepEqual(scritte[1], { check_in_time: '18:00', shuttle: 'no' })
  assert.equal(s.stato.check_in_time, '18:00')
  assert.equal(s.stato.shuttle, 'no')
  // e l'arrivo che torna si rilegge dalle due colonne di sempre
  assert.equal(esito.arrivo?.tipo, 'struttura')
  assert.equal(esito.arrivo?.strutturaDa, '18:00')
  assert.equal(esito.arrivo?.navetta, 'non_richiesta')
})

test('CASO 3 · riga con la 0058 applicata ma ancora VUOTA: il ripiego è sicuro', async () => {
  const s = serverFinto({ id: 'b1', ...Object.fromEntries(COLONNE_0058.map(c => [c, null])), check_in_time: null, shuttle: null })
  assert.equal(dettagliEsistenti(s.stato), false)
  const esito = await salvaArrivoPrenotazione(
    campi => ('arrivo_tipo' in campi
      ? Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'arrivo_tipo' column" } })
      : s.scrivi(campi)),
    con({ tipo: 'struttura', strutturaDa: '18:00', navetta: 'non_richiesta' }), s.rileggi)
  assert.equal(esito.esito, 'ok')
  assert.equal(s.stato.check_in_time, '18:00')
})

test('CASO 3 · senza rilettura non si ripiega mai: non si sa cosa si lascerebbe dietro', async () => {
  const scritte: Record<string, string | null>[] = []
  const esito = await salvaArrivoPrenotazione(
    campi => { scritte.push(campi); return Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'arrivo_tipo' column" } }) },
    con({ tipo: 'struttura', strutturaDa: '18:00', navetta: 'non_richiesta' }))
  assert.equal(esito.esito, 'senza_posto')
  assert.equal(scritte.length, 1, 'ha scritto senza poter guardare la riga')
})

test('dettagliEsistenti: guarda solo le colonne nuove, e solo quelle valorizzate', () => {
  assert.equal(dettagliEsistenti(null), false)
  assert.equal(dettagliEsistenti({ id: 'b1', check_in_time: '16:00', shuttle: 'si' }), false)
  assert.equal(dettagliEsistenti({ arrivo_tipo: null, navetta: null }), false)
  assert.equal(dettagliEsistenti({ arrivo_tipo: null, navetta: 'massimo' }), true)
  assert.equal(dettagliEsistenti(rigaLinateMassimo()), true)
})

test('CASO 1 · la libreria di Supabase NON lancia: la rete caduta arriva come risposta con codice vuoto', async () => {
  // Trovato provando nell'anteprima: con `senzaRisposta` legato all'eccezione,
  // un errore di rete passava per certo e diceva «non salvato» su una
  // scrittura andata a buon fine.
  assert.equal(erroreDelServer({ code: '42501', message: 'permission denied' }), true)
  assert.equal(erroreDelServer({ code: 'PGRST204', message: 'Could not find…' }), true)
  assert.equal(erroreDelServer({ code: '', message: 'TypeError: Failed to fetch' }), false)
  assert.equal(erroreDelServer({ message: 'Load failed' }), false)
  assert.equal(erroreDelServer(new TypeError('Failed to fetch')), false)

  // come la manda supabase-js quando la connessione cade a metà
  const comeSupabase = () => Promise.resolve({ data: null, error: { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' } })
  const s = serverFinto({ id: 'b1' })
  const esito = await salvaArrivoPrenotazione(
    campi => { Object.assign(s.stato, campi); return comeSupabase() }, RIFERIMENTO, s.rileggi)
  assert.equal(esito.esito, 'ok', 'un errore di rete su una scrittura passata è stato dato per certo')
  assert.equal(esito.arrivo?.navetta, 'massimo')
})

// ── 14. IL TERZO RICONTROLLO (Codex, su e81893e) ──────────────────────────
// Una rilettura non dimostra che una richiesta ancora in viaggio sia finita.

/** Uno scrittore che METTE DA PARTE il payload e lo applica solo quando
 *  glielo si dice: è la richiesta partita che arriva al server dopo. */
function scrittorePendente(stato: Record<string, unknown>) {
  let inSospeso: Record<string, string | null> | null = null
  return {
    stato,
    /** risponde «rete caduta» senza aver ancora applicato niente */
    scrivi: (campi: Record<string, string | null>) => {
      inSospeso = campi
      return Promise.resolve({ data: null, error: { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' } })
    },
    rileggi: () => Promise.resolve({ data: [{ ...stato }], error: null }),
    /** la richiesta di prima arriva adesso */
    completa: () => { if (inSospeso) Object.assign(stato, inSospeso); inSospeso = null },
  }
}

test('CASO 4 · una rilettura DIVERSA non prova che la scrittura sia fallita', async () => {
  // PRIMA: riga a 16:00, chiesto 18:00, il trasporto cade, la rilettura vede
  //        ancora 16:00 → esito «errore», «Non salvato, riprova». Falso: la
  //        richiesta arrivava dopo e la riga diventava 18:00.
  // ADESSO: resta incerto, e il messaggio non invita a risalvare subito.
  const partenza = con({ tipo: 'struttura', strutturaDa: '16:00', navetta: 'non_richiesta' })
  const richiesto = con({ tipo: 'struttura', strutturaDa: '18:00', navetta: 'non_richiesta' })
  const s = scrittorePendente({ id: 'b1', ...campiArrivo(partenza) })

  const esito = await salvaArrivoPrenotazione(s.scrivi, richiesto, s.rileggi)
  assert.equal(esito.esito, 'incerto', 'ha dichiarato fallita una scrittura ancora in viaggio')
  assert.equal(esito.messaggio, MESSAGGIO_IN_VOLO)
  assert.equal(esito.campi, null)
  // il messaggio NON dice di riprovare subito: il secondo salvataggio
  // arriverebbe addosso al primo
  assert.equal(/riprova/i.test(esito.messaggio!), false)
  assert.match(esito.messaggio!, /non risalvare subito/)

  // e infatti, un attimo dopo, la richiesta di prima arriva
  assert.equal(s.stato.check_in_time, '16:00', 'prima del completamento la riga è ancora quella vecchia')
  s.completa()
  assert.equal(s.stato.check_in_time, '18:00')
  assert.equal(s.stato.arrivo_struttura_ora_da, '18:00')
})

test('CASO 4 · se invece la rilettura conferma, la scrittura era passata: ok', async () => {
  const richiesto = con({ tipo: 'struttura', strutturaDa: '18:00', navetta: 'non_richiesta' })
  const s = scrittorePendente({ id: 'b1', ...campiArrivo(con({ tipo: 'struttura', strutturaDa: '16:00', navetta: 'non_richiesta' })) })
  // qui il payload arriva PRIMA della rilettura
  const esito = await salvaArrivoPrenotazione(
    campi => { const r = s.scrivi(campi); s.completa(); return r },
    richiesto, s.rileggi)
  assert.equal(esito.esito, 'ok')
  assert.equal(esito.arrivo?.strutturaDa, '18:00')
})

test('CASO 4 · dopo un trasporto ambiguo l’esito non è MAI «non salvato»', async () => {
  const richiesto = con({ tipo: 'struttura', strutturaDa: '18:00', navetta: 'non_richiesta' })
  const diversa = () => Promise.resolve({ data: [{ id: 'b1', ...campiArrivo(con({ tipo: 'struttura', strutturaDa: '09:00', navetta: 'non_richiesta' })) }], error: null })
  const povera = () => Promise.resolve({ data: [{ id: 'b1', check_in_time: '09:00' }], error: null })
  const muta = () => Promise.resolve({ data: [], error: null })
  const rotta = () => Promise.reject(new Error('anche la rilettura è caduta'))
  const reteCaduta = () => Promise.resolve({ data: null, error: { code: '', message: 'Failed to fetch' } })
  for (const [nome, rileggi] of [['diversa', diversa], ['povera', povera], ['muta', muta], ['rotta', rotta]] as const) {
    const esito = await salvaArrivoPrenotazione(reteCaduta, richiesto, rileggi)
    assert.equal(esito.esito, 'incerto', `con la rilettura ${nome} l’esito non è incerto`)
    assert.equal(esito.messaggio, MESSAGGIO_IN_VOLO)
  }
  // e senza rilettore, uguale
  assert.equal((await salvaArrivoPrenotazione(reteCaduta, richiesto)).messaggio, MESSAGGIO_IN_VOLO)
})

test('CASO 4 · anche il ripiego, se il trasporto cade, resta incerto', async () => {
  // il secondo tentativo (le due colonne di sempre) non può concludere più
  // del primo: se cade il trasporto, non si sa
  const semplice = con({ tipo: 'struttura', strutturaDa: '18:00', navetta: 'non_richiesta' })
  const s = serverFinto(rigaVecchia())
  const esito = await salvaArrivoPrenotazione(
    campi => ('arrivo_tipo' in campi
      ? Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'arrivo_tipo' column" } })
      : Promise.resolve({ data: null, error: { code: '', message: 'Failed to fetch' } })),
    semplice, s.rileggi)
  assert.equal(esito.esito, 'incerto')
  assert.equal(esito.messaggio, MESSAGGIO_IN_VOLO)
})

test('CODICE 08 e 57P · connessione caduta e server che si spegne NON sono certi', async () => {
  // 08007 vuol dire proprio «non so se la transazione è andata a buon fine»
  assert.equal(erroreDelServer({ code: '08007' }), false, '08007 dato per certo')
  assert.equal(erroreDelServer({ code: '08006' }), false)
  assert.equal(erroreDelServer({ code: '08000' }), false)
  assert.equal(erroreDelServer({ code: '57P01' }), false)
  assert.equal(erroreDelServer({ code: '57P03' }), false)
  // questi invece sì: il server ha risposto e ha annullato la sua transazione
  assert.equal(erroreDelServer({ code: '42501' }), true)
  assert.equal(erroreDelServer({ code: '23514' }), true)
  assert.equal(erroreDelServer({ code: '23505' }), true)
  assert.equal(erroreDelServer({ code: 'PGRST204' }), true)
  assert.equal(erroreDelServer({ code: '' }), false)
  assert.equal(erroreDelServer(new TypeError('Failed to fetch')), false)

  // e un 08007 sul salvataggio vero non dice «non salvato»: si riconcilia
  const richiesto = con({ tipo: 'struttura', strutturaDa: '18:00', navetta: 'non_richiesta' })
  const s = scrittorePendente({ id: 'b1', ...campiArrivo(con({ tipo: 'struttura', strutturaDa: '16:00', navetta: 'non_richiesta' })) })
  const esito = await salvaArrivoPrenotazione(
    campi => { s.scrivi(campi); return Promise.resolve({ data: null, error: { code: '08007', message: 'transaction resolution unknown' } }) },
    richiesto, s.rileggi)
  assert.equal(esito.esito, 'incerto')
  assert.equal(esito.messaggio, MESSAGGIO_IN_VOLO)
  s.completa()
  assert.equal(s.stato.check_in_time, '18:00', 'la richiesta era davvero ancora in viaggio')
})

test('il criterio prudente è lo STESSO del punto 5, e non deve prendere strade diverse', () => {
  // `lib/pagamentiDati.errorePerCerto` non si tocca: parla con Supabase e
  // ha il suo blocco, quindi non si può importare qui. Si confrontano le
  // due regole sui sorgenti, così non possono divergere in silenzio.
  const pagamenti = leggi('lib/pagamentiDati.ts')
  const arrivi = leggi('lib/arrivoDati.ts')
  assert.match(pagamenti, /export function errorePerCerto/)
  const regola = /if \(\/\^PGRST\\d\+\$\/\.test\(cod\w*\)\) return true[\s\S]{0,120}return !\/\^\(08\|57P\)\/\.test\(cod\w*\)/
  assert.match(pagamenti, regola, 'il punto 5 ha cambiato criterio')
  assert.match(arrivi, regola, 'l’arrivo ha cambiato criterio')
  // e il comportamento, sui codici che contano
  for (const [code, certo] of [['42501', true], ['23514', true], ['PGRST204', true],
    ['08000', false], ['08006', false], ['08007', false], ['57P01', false], ['57P03', false],
    ['', false], ['boh', false]] as const) {
    assert.equal(erroreDelServer({ code }), certo, `«${code}» classificato male`)
  }
})
