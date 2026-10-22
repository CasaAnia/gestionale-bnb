// ============================================================================
// ARRIVO A UN LUOGO E, INSIEME, IN STRUTTURA (Ania, 22/10/2026): «Arrivo a
// Linate alle 10» e, facoltativo, «In struttura alle 20» (ora precisa o
// fascia), con autista e prelievo distinti. Le colonne della struttura che
// c'erano già tengono l'ora della cliente; la stima di Ania di prima resta,
// col «circa», e vale solo quando quella manca. check_in_time = struttura,
// mai l'ora dell'aeroporto. Le righe vecchie si leggono come prima.
// Scheda: docs/collaborazione/incarichi/2026-10-22-arrivo-luogo-e-struttura.md
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ARRIVO_VUOTO, leggiArrivo, campiArrivo, campiArrivoVecchi, controllaArrivo, perditeSenza0058, cambiaTipo, cambiaModo, scriviOra,
  periodoInStruttura, oraInStruttura, circaInStruttura, fonteInStruttura, orarioIgnoto, pianoModuloArrivo,
  arrivoInScheda, arrivoInHome, navettaInScheda, rigaPrelievo,
  ERRORE_ORA, ERRORE_FASCIA_STRUTTURA, HOME_ARRIVO_IN_STRUTTURA, HOME_ARRIVO_PREVISTO,
  type Arrivo,
} from './arrivo.ts'
import { salvaArrivoPrenotazione } from './arrivoDati.ts'
import { arrivoInBreve, arrivoGrande } from './schedaMaison.ts'
import { rigaArrivoArrivi, orarioScheda } from './arriviSchede.ts'
import { arrivoTestaDaArrivo } from './testaScheda.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** Caso 1 di Ania: Linate alle 10, in struttura alle 20, Massimo col prelievo */
const LINATE_E_STRUTTURA: Arrivo = {
  ...ARRIVO_VUOTO, tipo: 'luogo', luogo: 'linate', luogoDa: '10:00',
  strutturaDa: '20:00', navetta: 'massimo', prelievo: '10:15',
}
/** Una prenotazione di prima del 22/10: luogo con la stima di Ania, struttura a null */
const RIGA_VECCHIA = {
  id: 'b-vecchia', check_in_time: '15:30', shuttle: 'si',
  arrivo_tipo: 'luogo', arrivo_luogo: 'malpensa', arrivo_luogo_altro: null,
  arrivo_luogo_ora_da: '13:00', arrivo_luogo_ora_a: '14:00',
  arrivo_struttura_ora_da: null, arrivo_struttura_ora_a: null,
  arrivo_stima_da: '15:30', arrivo_stima_a: '16:30',
  navetta: 'aldo', navetta_prelievo: '14:15',
}

test('1 · luogo + struttura: si salvano INSIEME, check_in_time è la struttura, mai Linate', () => {
  const c = campiArrivo(LINATE_E_STRUTTURA)
  assert.equal(c.arrivo_tipo, 'luogo')
  assert.equal(c.arrivo_luogo, 'linate')
  assert.equal(c.arrivo_luogo_ora_da, '10:00')
  assert.equal(c.arrivo_struttura_ora_da, '20:00')
  assert.equal(c.arrivo_struttura_ora_a, null)
  assert.equal(c.arrivo_stima_da, null)
  assert.equal(c.check_in_time, '20:00')
  assert.notEqual(c.check_in_time, '10:00')
  assert.equal(c.navetta, 'massimo')
  assert.equal(c.navetta_prelievo, '10:15')
  assert.equal(c.shuttle, 'si')
  // e si rilegge uguale
  const riletto = leggiArrivo({ ...c, id: 'b1' })
  assert.equal(riletto.luogoDa, '10:00')
  assert.equal(riletto.strutturaDa, '20:00')
  assert.equal(riletto.prelievo, '10:15')
  assert.deepEqual(campiArrivo(riletto), c)
})

test('1 · le presentazioni: dato della cliente, niente «circa», autista e prelievo distinti', () => {
  const a = LINATE_E_STRUTTURA
  assert.equal(fonteInStruttura(a), 'cliente')
  assert.equal(circaInStruttura(a), false)
  assert.deepEqual(arrivoInScheda(a), { titolo: 'In struttura alle 20:00', sotto: 'Arriva a Linate alle 10:00' })
  assert.deepEqual(navettaInScheda(a), { titolo: 'Massimo', sotto: 'Prelievo a Linate · 10:15' })
  const home = arrivoInHome(a)
  assert.equal(home.grande, '20:00')
  assert.equal(home.circa, false)
  assert.equal(home.sotto, HOME_ARRIVO_IN_STRUTTURA)
  assert.deepEqual(home.righe.map(r => r.forte), ['Linate · 10:00', 'Massimo · prelievo 10:15'])
  assert.deepEqual(arrivoInBreve(a, '2026-12-10', '2026-12-10'), ['oggi, in struttura alle 20:00', 'atterra a Linate alle 10:00', 'navetta Massimo · prelievo a Linate 10:15'])
  assert.deepEqual(arrivoGrande(a, '2026-12-10', '2026-12-10'), { testo: 'Oggi alle 20:00', circa: false })
  assert.equal(orarioScheda(a), '20:00')
  assert.equal(rigaArrivoArrivi(a).includes('circa'), false)
  assert.match(rigaArrivoArrivi(a), /Linate 10:00/)
  assert.equal(arrivoTestaDaArrivo(a).orario.includes('circa'), false)
  assert.equal(orarioIgnoto(a), false)
})

test('2 · in struttura una FASCIA con il luogo: «fra le … e le …», mai «circa»', () => {
  const a: Arrivo = { ...LINATE_E_STRUTTURA, modoStruttura: 'fascia', strutturaDa: '19:00', strutturaA: '21:00' }
  const c = campiArrivo(a)
  assert.equal(c.arrivo_struttura_ora_da, '19:00')
  assert.equal(c.arrivo_struttura_ora_a, '21:00')
  assert.equal(c.check_in_time, '19:00')
  assert.equal(arrivoInScheda(a).titolo, 'In struttura fra le 19:00 e le 21:00')
  assert.equal(periodoInStruttura(a), '19:00–21:00')
  assert.equal(arrivoInHome(a).circa, false)
  assert.match(rigaArrivoArrivi(a), /in struttura 19:00–21:00(?! circa)/)
  assert.deepEqual(arrivoGrande(a, '2026-12-10', '2026-12-10'), { testo: 'Oggi, 19:00–21:00', circa: false })
  // riletta, la fascia torna fascia
  assert.equal(leggiArrivo(c).modoStruttura, 'fascia')
  // e senza la 0058 la fascia in struttura è una perdita dichiarata
  assert.ok(perditeSenza0058(a).includes('la fascia oraria in struttura'))
})

test('3 · solo il luogo: come prima, l’ora in struttura resta da definire', () => {
  const a: Arrivo = { ...LINATE_E_STRUTTURA, strutturaDa: '' }
  assert.equal(campiArrivo(a).check_in_time, null)
  assert.equal(campiArrivo(a).arrivo_struttura_ora_da, null)
  assert.deepEqual(arrivoInScheda(a), { titolo: 'Arriva a Linate alle 10:00', sotto: 'Orario in struttura da definire' })
  assert.equal(arrivoInHome(a).grande, 'Da definire')
  assert.equal(orarioIgnoto(a), false, 'l’ora a Linate basta')
})

test('4 · 5 · solo struttura e da definire: invariati', () => {
  const s: Arrivo = { ...ARRIVO_VUOTO, tipo: 'struttura', strutturaDa: '16:00', navetta: 'non_richiesta' }
  assert.equal(campiArrivo(s).check_in_time, '16:00')
  assert.equal(campiArrivo(s).arrivo_luogo, null)
  assert.equal(arrivoInScheda(s).titolo, 'In struttura alle 16:00')
  const d: Arrivo = { ...LINATE_E_STRUTTURA, tipo: 'da_definire' }
  const cd = campiArrivo(d)
  assert.equal(cd.check_in_time, null)
  assert.equal(cd.arrivo_struttura_ora_da, null, 'con «Da definire» la bozza non va sul server')
  assert.equal(cd.arrivo_luogo_ora_da, null)
  assert.equal(orarioIgnoto(d), true)
})

test('6 · la riga di prima (luogo + stima): si legge, si mostra e si risalva IDENTICA', () => {
  const a = leggiArrivo(RIGA_VECCHIA)
  assert.equal(a.strutturaDa, '')
  assert.equal(fonteInStruttura(a), 'stima')
  assert.equal(circaInStruttura(a), true)
  assert.equal(arrivoInScheda(a).titolo, 'In struttura circa 15:30–16:30')
  assert.equal(arrivoInHome(a).sotto, HOME_ARRIVO_PREVISTO)
  assert.deepEqual(arrivoInBreve(a, '2026-12-10', '2026-12-10')[0], 'oggi, in struttura 15:30–16:30 circa')
  assert.equal(pianoModuloArrivo(a).stima, true, 'la stima già scritta resta nel modulo')
  // risalvare senza toccare: le colonne tornano quelle di prima
  const c = campiArrivo(a)
  for (const k of Object.keys(c)) assert.equal(c[k], (RIGA_VECCHIA as Record<string, unknown>)[k] ?? null, k)
})

test('7 · alla riga di prima si aggiunge l’ora in struttura: prevale la cliente, la stima resta', () => {
  const a = scriviOra(leggiArrivo(RIGA_VECCHIA), 'da', '16:00', 'struttura')
  const c = campiArrivo(a)
  assert.equal(c.arrivo_struttura_ora_da, '16:00')
  assert.equal(c.arrivo_stima_da, '15:30')
  assert.equal(c.arrivo_stima_a, '16:30')
  assert.equal(c.check_in_time, '16:00')
  assert.equal(circaInStruttura(a), false)
  assert.equal(arrivoInScheda(a).titolo, 'In struttura alle 16:00')
  // la fine della stima non è una perdita: conta l'ora della cliente
  assert.equal(perditeSenza0058(a).includes('la fine della stima in struttura'), false)
})

test('8 · i controlli guardano anche l’ora in struttura col luogo', () => {
  assert.equal(controllaArrivo({ ...LINATE_E_STRUTTURA, strutturaDa: '20' }), ERRORE_ORA)
  assert.equal(controllaArrivo({ ...LINATE_E_STRUTTURA, modoStruttura: 'fascia', strutturaDa: '21:00', strutturaA: '19:00' }), ERRORE_FASCIA_STRUTTURA)
  assert.equal(controllaArrivo(LINATE_E_STRUTTURA), null)
  // con «Ora precisa» la fine lasciata in bozza non conta e non blocca
  assert.equal(controllaArrivo({ ...LINATE_E_STRUTTURA, strutturaA: '19:00' }), null)
  assert.equal(campiArrivo({ ...LINATE_E_STRUTTURA, strutturaA: '19:00' }).arrivo_struttura_ora_a, null)
})

test('cambiare tipo non perde niente: la stessa casella in struttura per «In struttura» e «Arrivo a…»', () => {
  const s = cambiaTipo(LINATE_E_STRUTTURA, 'struttura')
  assert.equal(s.strutturaDa, '20:00')
  assert.equal(campiArrivo(s).check_in_time, '20:00')
  const l = cambiaTipo(cambiaTipo(s, 'da_definire'), 'luogo')
  assert.deepEqual(l, LINATE_E_STRUTTURA)
  // il modo e le ore di un gruppo non toccano l'altro
  const m = cambiaModo(LINATE_E_STRUTTURA, 'fascia', 'struttura')
  assert.equal(m.modoStruttura, 'fascia')
  assert.equal(m.modoLuogo, 'precisa')
  assert.equal(scriviOra(LINATE_E_STRUTTURA, 'da', '11:00').luogoDa, '11:00', 'senza gruppo vale il tipo attivo, come prima')
  assert.equal(scriviOra(LINATE_E_STRUTTURA, 'da', '11:00').strutturaDa, '20:00')
})

test('il modulo: con «Arrivo a…» compare «In struttura · facoltativo», la stima solo se già scritta', () => {
  const p = pianoModuloArrivo(LINATE_E_STRUTTURA)
  assert.ok(p.struttura)
  assert.equal(p.struttura.oraDa, '20:00')
  assert.equal(p.struttura.caselle, 1)
  assert.equal(p.stima, false)
  assert.equal(pianoModuloArrivo({ ...ARRIVO_VUOTO, tipo: 'struttura' }).struttura, null)
  for (const f of ['components/ArrivoNavetta.tsx', 'components/maison/ArrivoNavettaMaison.tsx']) {
    const s = leggi(f)
    assert.match(s, /ETICHETTA_IN_STRUTTURA/, f)
    assert.match(s, /scriviOra\(arrivo, 'da', v, 'struttura'\)/, f)
    assert.match(s, /cambiaModo\(arrivo, k as ModoOrario, 'struttura'\)|cambiaModo\(arrivo, s\.chiave as ModoOrario, 'struttura'\)/, f)
  }
})

test('11 · navetta: le scelte restano distinte, il prelievo solo con la navetta', () => {
  for (const n of ['non_richiesta', 'da_definire'] as const) {
    const a = { ...LINATE_E_STRUTTURA, navetta: n }
    assert.equal(campiArrivo(a).navetta_prelievo, null, n)
    assert.equal(rigaPrelievo(a), null, n)
    assert.equal(campiArrivo(a).check_in_time, '20:00', `${n}: la navetta non tocca l’ora in struttura`)
  }
  assert.equal(campiArrivoVecchi({ ...LINATE_E_STRUTTURA, navetta: 'da_assegnare' }).shuttle, 'si')
  assert.equal(campiArrivoVecchi({ ...LINATE_E_STRUTTURA, navetta: 'non_richiesta' }).shuttle, 'no')
})

test('9 · due salvataggi con rilettura dal server: a ogni giro la riga torna uguale', async () => {
  const server: Record<string, unknown> = { id: 'b1', check_in_time: null, shuttle: null }
  const scrivi = (campi: Record<string, string | null>) => { Object.assign(server, campi); return Promise.resolve({ data: [{ id: 'b1' }], error: null }) }
  const rileggi = () => Promise.resolve({ data: [{ ...server }], error: null })
  const primo = await salvaArrivoPrenotazione(scrivi, LINATE_E_STRUTTURA, rileggi)
  assert.equal(primo.esito, 'ok')
  assert.equal(primo.arrivo?.strutturaDa, '20:00')
  const secondo = await salvaArrivoPrenotazione(scrivi, { ...primo.arrivo!, modoStruttura: 'fascia', strutturaDa: '19:00', strutturaA: '21:00' }, rileggi)
  assert.equal(secondo.esito, 'ok')
  const riaperto = leggiArrivo(server)
  assert.equal(riaperto.luogoDa, '10:00')
  assert.equal(periodoInStruttura(riaperto), '19:00–21:00')
  assert.equal(server.check_in_time, '19:00')
  assert.equal(oraInStruttura(riaperto), '19:00')
})

test('10 · guasto: niente di scritto è un successo', async () => {
  const esito = await salvaArrivoPrenotazione(() => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } }), LINATE_E_STRUTTURA)
  assert.notEqual(esito.esito, 'ok')
  assert.equal(esito.campi, null)
})
