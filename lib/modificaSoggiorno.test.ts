// ============================================================================
// «MODIFICA SOGGIORNO» della scheda completa (/prenotazioni/[id]), 16/09/2026:
// il letto aggiuntivo segue le persone. Le funzioni stanno dentro la pagina
// (cambiaOspiti, pianoSoggiorno, tariffaDaListino, getDaysBetween): qui si
// estraggono dal sorgente con TypeScript e si fanno girare con uno stato
// finto, come la riproduzione del rilievo. Se qualcuno le sposta in una
// libreria, questo test va a leggerle lì.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { riallineaTariffa } from './prezzoNotti.ts'
import { rigaDaSalvare, lettoProposto } from './prenotazioneComposta.ts'
import { contoSoggiorno } from './conto.ts'
import { capienzaBase } from './tariffe.ts'

const sorgente = readFileSync(new URL('../app/prenotazioni/[id]/page.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('page.tsx', sorgente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const NOMI = ['getDaysBetween', 'tariffaDaListino', 'pianoSoggiorno', 'cambiaOspiti']
const funzioni: string[] = []
function visita(n: ts.Node) {
  if (ts.isFunctionDeclaration(n) && n.name && NOMI.includes(n.name.text)) {
    funzioni.push(ts.transpileModule(n.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText)
  }
  ts.forEachChild(n, visita)
}
visita(ast)

const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const LENA = { id: 'lena', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10 }

type Stato = { ospitiForm: string; tariffaForm: string; lettoNotti: string[]; lettoImporto: number | null; lettoAuto: boolean; controlli: unknown[]; piano: { totale: number; righe: { extra_bed_dates: string[]; extra_bed_total: number; price_per_night: number }[] } }

// Lo stato della pagina, finto: i set* scrivono le variabili, controllaSoggiorno registra cosa le è stato chiesto
function pagina(camera: Record<string, unknown>, ospiti: number, iniziale: { lettoNotti?: string[]; lettoImporto?: number | null; lettoAuto?: boolean } = {}) {
  const booking = { id: 'b', room_id: camera.id, check_in: '2026-09-16', check_out: '2026-09-17', num_guests: ospiti, price_per_night: 80, total_amount: 80, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, rooms: camera }
  const corpo = `
    let ospitiForm = '${ospiti}', tariffaForm = '80', lettoNotti = ${JSON.stringify(iniziale.lettoNotti ?? [])}, lettoImporto = ${JSON.stringify('lettoImporto' in iniziale ? iniziale.lettoImporto : 10)}, lettoCriterio = 'notte', tariffaToccata = false, lettoAuto = ${iniziale.lettoAuto ?? false}
    const controlli = []
    const setOspitiForm = v => ospitiForm = v, setTariffaForm = v => tariffaForm = v, setLettoNotti = v => lettoNotti = v, setLettoImporto = v => lettoImporto = v, setLettoAuto = v => lettoAuto = v
    const dateForm = { check_in: booking.check_in, check_out: booking.check_out }
    const unaCameraSola = () => true, periodoCameraAperta = () => ({ dal: booking.check_in, al: booking.check_out }), controllaSoggiorno = x => controlli.push(x)
    ${funzioni.join('\n')}
    return {
      cambia: t => { cambiaOspiti(t) },
      leggi: () => ({ ospitiForm, tariffaForm, lettoNotti, lettoImporto, lettoAuto, controlli, piano: pianoSoggiorno() }),
    }`
  const f = new Function('booking', 'riallineaTariffa', 'rigaDaSalvare', 'contoSoggiorno', 'lettoProposto', 'capienzaBase', corpo)
  return f(booking, riallineaTariffa, rigaDaSalvare, contoSoggiorno, lettoProposto, capienzaBase) as { cambia: (t: string) => void; leggi: () => Stato }
}

test('Allegra, una notte, da 2 a 3 ospiti: il letto si accende da solo e il totale fa 90 €', () => {
  assert.equal(funzioni.length, 4, 'non trovo le quattro funzioni nella pagina')
  const p = pagina(ALLEGRA, 2)
  p.cambia('3')
  const s = p.leggi()
  assert.equal(s.ospitiForm, '3')
  assert.deepEqual(s.lettoNotti, ['2026-09-16'])
  assert.equal(s.lettoAuto, true)
  assert.equal(s.lettoImporto, 10)
  assert.equal(s.piano.totale, 90)
  assert.deepEqual(s.piano.righe[0].extra_bed_dates, ['2026-09-16'])
  assert.equal(s.piano.righe[0].extra_bed_total, 10)
  // e la disponibilità dei due letti di casa si controlla con le notti nuove, non con lo stato vecchio
  assert.deepEqual(s.controlli.at(-1), { ospiti: 3, nottiLetto: ['2026-09-16'] })
})

test('tornando a 2 il letto acceso dalla pagina si spegne; quello messo a mano resta', () => {
  const p = pagina(ALLEGRA, 2)
  p.cambia('3')
  p.cambia('2')
  const s = p.leggi()
  assert.deepEqual(s.lettoNotti, [])
  assert.equal(s.piano.totale, 80)
  // due persone che vogliono dormire separate: letto messo a mano, non si tocca
  const manuale = pagina(ALLEGRA, 2, { lettoNotti: ['2026-09-16'], lettoAuto: false })
  manuale.cambia('2')
  assert.deepEqual(manuale.leggi().lettoNotti, ['2026-09-16'])
  assert.equal(manuale.leggi().piano.totale, 90)
  // e a 3 resta lui, senza raddoppiare
  manuale.cambia('3')
  assert.deepEqual(manuale.leggi().lettoNotti, ['2026-09-16'])
  assert.equal(manuale.leggi().lettoAuto, false)
})

test('Lena da 2 a 3: il terzo posto è compreso, la tariffa passa a 90 e il letto non costa', () => {
  // all'apertura il campo del letto porta 10 (il prezzo del letto di Lena a 2): a 3 deve diventare «compreso»
  const p = pagina(LENA, 2, { lettoImporto: 10 })
  p.cambia('3')
  const s = p.leggi()
  assert.deepEqual(s.lettoNotti, ['2026-09-16'])
  assert.equal(s.lettoImporto, 0)            // lettoProposto(Lena, 3): compreso
  assert.equal(s.tariffaForm, '90')
  assert.equal(s.piano.totale, 90)
})

test('il salvataggio non accetta più persone della capienza senza letto', () => {
  assert.match(sorgente, /if \(ospiti > capienzaBase\(booking\.rooms\) && lettoNotti\.length === 0\) \{/)
  assert.match(sorgente, /ci vuole il letto aggiuntivo: accendilo sulle notti qui sopra/)
  // i tasti delle notti spengono l'automatico: da lì in poi comanda la mano
  assert.equal((sorgente.match(/setLettoAuto\(false\); controllaSoggiorno\(\{ nottiLetto: n \}\)/g) || []).length, 2)
})
