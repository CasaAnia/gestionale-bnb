// Richieste che si accavallano (Ania, 12/09/2026): chi sta nel gruppo,
// come si legge il segno, e in che ordine si guardano.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { altreStesseDate, gruppoStesseDate, etichettaStesseDate, sottotitoloGruppo, contatoreGruppo, VEDI_TUTTE } from './richiesteStesseDate.ts'

const r = (id: string, arrivo: string, partenza: string, extra: Record<string, unknown> = {}) => ({
  id, arrivo, partenza, stato: 'in_attesa' as const, created_at: `2026-09-1${id.slice(-1)}T10:00:00Z`, camera_id: null, notti_richieste: null, ...extra,
})

const ANNA = r('1', '2026-10-29', '2026-10-31')
const GIUSI = r('2', '2026-10-30', '2026-11-02')          // la notte del 30 è in comune
const ROSA = r('3', '2026-10-29', '2026-10-30')           // la notte del 29 è in comune
const LONTANA = r('4', '2026-12-01', '2026-12-03')        // non c'entra
const ATTACCATA = r('5', '2026-10-31', '2026-11-02')      // arriva quando Anna parte: nessuna notte in comune
const APERTE = [ANNA, GIUSI, ROSA, LONTANA, ATTACCATA]

test('nel gruppo ci va solo chi ha davvero una notte in comune', () => {
  assert.deepEqual(altreStesseDate(ANNA, APERTE).map(x => x.id), ['2', '3'])
  // chi parte quando l'altra arriva non si accavalla
  assert.deepEqual(altreStesseDate(ATTACCATA, APERTE).map(x => x.id), ['2'])
  // chi è lontano è solo
  assert.deepEqual(altreStesseDate(LONTANA, APERTE), [])
})

test('la camera chiesta non conta: contano le notti', () => {
  const conAmbra = { ...ANNA, camera_id: 'ambra' }
  const conLena = { ...GIUSI, camera_id: 'lena' }
  assert.deepEqual(altreStesseDate(conAmbra, [conAmbra, conLena, ROSA]).map(x => x.id), ['2', '3'])
})

test('le richieste chiuse non contano', () => {
  const chiuse = [ANNA, { ...GIUSI, stato: 'rifiutata' as const }, { ...ROSA, stato: 'confermata' as const }, { ...LONTANA, stato: 'chiusa' as const }]
  assert.deepEqual(altreStesseDate(ANNA, chiuse), [])
  // la proposta inviata invece è ancora aperta: tiene il posto
  assert.deepEqual(altreStesseDate(ANNA, [ANNA, { ...GIUSI, stato: 'proposta_inviata' as const }]).map(x => x.id), ['2'])
})

test('con le notti scelte contano solo quelle', () => {
  // Anna chiede solo il 29 e il 31; chi vuole la sola notte del 30 non la tocca
  const spezzata = { ...ANNA, partenza: '2026-11-01', notti_richieste: ['2026-10-29', '2026-10-31'] }
  const soloIl30 = r('6', '2026-10-30', '2026-10-31')
  assert.deepEqual(altreStesseDate(spezzata, [spezzata, soloIl30, ROSA]).map(x => x.id), ['3'])
  // Giusi invece dorme anche il 31: si accavallano
  assert.deepEqual(altreStesseDate(spezzata, [spezzata, GIUSI]).map(x => x.id), ['2'])
})

test('il gruppo comprende sé stessa e va dalla più vecchia alla più recente', () => {
  const gruppo = gruppoStesseDate(GIUSI, APERTE)
  assert.deepEqual(gruppo.map(x => x.id), ['1', '2', '5'])
  // sola: il gruppo è lei e basta
  assert.deepEqual(gruppoStesseDate(LONTANA, APERTE).map(x => x.id), ['4'])
})

test('il segno si legge al singolare e al plurale', () => {
  assert.equal(etichettaStesseDate(1), 'altra 1 richiesta')
  assert.equal(etichettaStesseDate(2), 'altre 2 richieste')
  assert.equal(etichettaStesseDate(5), 'altre 5 richieste')
  // sola: nessun segno
  assert.equal(etichettaStesseDate(0), null)
  assert.equal(etichettaStesseDate(-1), null)
  // il conteggio del segno è delle ALTRE, non del gruppo intero
  assert.equal(etichettaStesseDate(altreStesseDate(ANNA, APERTE).length), 'altre 2 richieste')
})

test('le scritte della barra del filtro', () => {
  assert.equal(sottotitoloGruppo(3), '3 richieste, la più vecchia per prima')
  assert.equal(sottotitoloGruppo(1), '1 richiesta, la più vecchia per prima')
  assert.equal(contatoreGruppo(3), '3 per queste date')
})

// Il nome del link che rimette l'elenco intero (Ania, 12/09/2026): prima si
// chiamava «Togli» e non diceva cosa sarebbe successo. Il nome sta in un
// posto solo e la pagina lo usa da lì, così non può tornare indietro di
// nascosto.
test('il link del filtro si chiama «Vedi tutte», e la pagina usa quel nome', () => {
  assert.equal(VEDI_TUTTE, 'Vedi tutte')
  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  // la barra del gruppo c'è due volte (calendario e lista): tutte e due col nome unico
  assert.equal(pagina.split('{VEDI_TUTTE}</button>').length - 1, 2)
  // nessuna traccia della parola vecchia, nemmeno negli agganci per le prove
  assert.equal(/togli/i.test(pagina), false)
})
