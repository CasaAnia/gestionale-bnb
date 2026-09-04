import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatIntervallo, oraArrivo, tempoTrascorso, ordinaRichieste, inArchivio, contaAperte, nomeCompleto, spiegaErrore, avvisoFerma, daGuardare, nuoveDalSito,
  riassuntoPersone, pianoModifica, scadenzaProposta, type Richiesta,
} from './richieste.ts'

const locale = (a: number, m: number, g: number, h = 12, min = 0) => new Date(a, m - 1, g, h, min)
const adesso = locale(2026, 9, 2, 9, 0)

function richiesta(x: Partial<Richiesta>): Richiesta {
  return {
    id: 'r', created_at: adesso.toISOString(), nome: 'Anna', cognome: 'Rossi', arrivo: '2026-09-13', partenza: '2026-09-15',
    persone: 2, camera_id: null, canale: 'telefono', telefono: null, note: null, stato: 'in_attesa',
    proposta_inviata_at: null, chiusa_at: null, prenotazione_id: null, ...x,
  }
}

test('intervallo date compatto', () => {
  assert.equal(formatIntervallo('2026-09-13', '2026-09-15'), '13–15 set')
  assert.equal(formatIntervallo('2026-09-30', '2026-10-02'), '30 set – 2 ott')
  assert.equal(formatIntervallo('2026-12-30', '2027-01-02'), '30 dic 2026 – 2 gen 2027')
})

test('ora di arrivo relativa', () => {
  assert.equal(oraArrivo(locale(2026, 9, 2, 8, 41).toISOString(), adesso), 'oggi 08:41')
  assert.equal(oraArrivo(locale(2026, 9, 1, 22, 30).toISOString(), adesso), 'ieri 22:30')
  assert.equal(oraArrivo(locale(2026, 8, 30, 8, 5).toISOString(), adesso), '30 ago 08:05')
  assert.equal(oraArrivo(locale(2025, 8, 30, 8, 5).toISOString(), adesso), '30 ago 2025 08:05')
  assert.equal(oraArrivo('boh', adesso), '')
})

test('tempo trascorso dalla proposta', () => {
  assert.equal(tempoTrascorso(locale(2026, 9, 2, 8, 59, ).toISOString(), adesso), '1 minuto fa')
  assert.equal(tempoTrascorso(locale(2026, 9, 2, 8, 30).toISOString(), adesso), '30 minuti fa')
  assert.equal(tempoTrascorso(locale(2026, 9, 2, 6, 0).toISOString(), adesso), '3 ore fa')
  assert.equal(tempoTrascorso(locale(2026, 8, 31, 9, 0).toISOString(), adesso), '2 giorni fa')
  assert.equal(tempoTrascorso(adesso.toISOString(), adesso), 'adesso')
})

test('ordinamento: durata decrescente, a parità la più vecchia prima', () => {
  const a = richiesta({ id: 'a', arrivo: '2026-09-13', partenza: '2026-09-14', persone: 3, created_at: '2026-09-02T06:00:00Z' })
  const b = richiesta({ id: 'b', arrivo: '2026-09-13', partenza: '2026-09-16', persone: 1, created_at: '2026-09-02T08:00:00Z' })
  const c = richiesta({ id: 'c', arrivo: '2026-09-20', partenza: '2026-09-23', persone: 2, created_at: '2026-09-02T07:00:00Z' })
  assert.deepEqual(ordinaRichieste([a, b, c], 'durata').map(r => r.id), ['c', 'b', 'a'])
  assert.deepEqual(ordinaRichieste([a, b, c], 'arrivo').map(r => r.id), ['a', 'c', 'b'])
  assert.deepEqual(ordinaRichieste([a, b, c], 'persone').map(r => r.id), ['a', 'c', 'b'])
})

test('archivio: solo chiuse negli ultimi 90 giorni; conteggio delle aperte', () => {
  const chiusaIeri = richiesta({ stato: 'confermata', chiusa_at: locale(2026, 9, 1).toISOString() })
  const chiusaVecchia = richiesta({ stato: 'rifiutata', chiusa_at: locale(2026, 5, 1).toISOString() })
  const senzaData = richiesta({ stato: 'rifiutata', chiusa_at: null, created_at: locale(2026, 8, 1).toISOString() })
  const aperta = richiesta({ stato: 'proposta_inviata' })
  assert.equal(inArchivio(chiusaIeri, adesso), true)
  assert.equal(inArchivio(chiusaVecchia, adesso), false)
  assert.equal(inArchivio(senzaData, adesso), true)
  assert.equal(inArchivio(aperta, adesso), false)
  assert.equal(contaAperte([chiusaIeri, aperta, richiesta({})]), 2)
})

test('nome e spiegazione degli errori', () => {
  assert.equal(nomeCompleto({ nome: ' Anna ', cognome: 'Rossi' }), 'Anna Rossi')
  assert.match(spiegaErrore({ code: 'PGRST205', message: "Could not find the table 'public.richieste' in the schema cache" }), /migrazione 0024/)
  assert.equal(spiegaErrore({ message: 'permission denied' }), 'permission denied')
  assert.equal(spiegaErrore(null), '')
})

test('richieste ferme: soglie 24 h / 48 h e arrivo passato, mai sulle chiuse', () => {
  const ore = (n: number) => new Date(adesso.getTime() - n * 3600000).toISOString()
  assert.equal(avvisoFerma(richiesta({ created_at: ore(23) }), adesso), null)
  assert.equal(avvisoFerma(richiesta({ created_at: ore(30) }), adesso), 'ferma da 1 giorno')
  assert.equal(avvisoFerma(richiesta({ created_at: ore(60) }), adesso), 'ferma da 2 giorni')
  assert.equal(avvisoFerma(richiesta({ stato: 'proposta_inviata', created_at: ore(100), proposta_inviata_at: ore(47) }), adesso), null)
  assert.equal(avvisoFerma(richiesta({ stato: 'proposta_inviata', created_at: ore(100), proposta_inviata_at: ore(50) }), adesso), 'ferma da 2 giorni')
  assert.equal(avvisoFerma(richiesta({ arrivo: '2026-09-01', partenza: '2026-09-03' }), adesso), 'arrivo passato')
  assert.equal(avvisoFerma(richiesta({ stato: 'rifiutata', created_at: ore(500) }), adesso), null)
  assert.equal(daGuardare([richiesta({ created_at: ore(30) }), richiesta({}), richiesta({ arrivo: '2026-08-30', partenza: '2026-08-31' })], adesso).length, 2)
})

test('nuove dal sito: solo canale web dopo l\'ultima visita; senza visita tutte le web', () => {
  const web1 = richiesta({ canale: 'web', created_at: '2026-09-02T08:00:00Z' })
  const web2 = richiesta({ canale: 'web', created_at: '2026-09-02T10:00:00Z' })
  const tel = richiesta({ canale: 'telefono', created_at: '2026-09-02T10:30:00Z' })
  assert.equal(nuoveDalSito([web1, web2, tel], '2026-09-02T09:00:00Z').length, 1)
  assert.equal(nuoveDalSito([web1, web2, tel], null).length, 2)
})

// ── pezzo 9 ─────────────────────────────────────────────────────────────────
test('riassuntoPersone: gruppi di notti uguali, anche attraverso i mesi', () => {
  assert.equal(riassuntoPersone('2026-09-17', [2, 1, 1, 1]), '17: 2 · 18–20: 1')
  assert.equal(riassuntoPersone('2026-09-17', [2, 2, 2, 2]), '17–20: 2')
  assert.equal(riassuntoPersone('2026-09-17', [1]), '17: 1')
  assert.equal(riassuntoPersone('2026-09-17', [3, 2, 3, 3]), '17: 3 · 18: 2 · 19–20: 3')
  assert.equal(riassuntoPersone('2026-09-30', [2, 1, 1]), '30 set: 2 · 1–2 ott: 1')
  assert.equal(riassuntoPersone('2026-09-29', [2, 2, 1]), '29–30 set: 2 · 1 ott: 1')
})

test('pianoModifica: date/persone/camera su una proposta inviata → in_attesa e storico; telefono/note/canale non cambiano lo stato; chiuse non modificabili', () => {
  const base = { stato: 'proposta_inviata' as const, arrivo: '2026-09-17', partenza: '2026-09-21', persone: 2, camera_id: null, persone_per_notte: null, proposta_testo: 'ciao', proposta_soluzione: { caso: 'completa' }, proposta_inviata_at: '2026-09-02T10:00:00Z', proposte_precedenti: [] }
  const nuovi = { nome: 'A', cognome: 'B', arrivo: '2026-09-17', partenza: '2026-09-21', persone: 2, persone_per_notte: null, camera_id: null, telefono: '+39333', note: null, canale: 'telefono' as const }
  const adesso = new Date('2026-09-03T08:00:00Z')
  const solo = pianoModifica(base, nuovi, adesso)
  assert.equal(solo.propostaSuperata, false); assert.equal(solo.avviso, null); assert.equal(solo.campi.stato, undefined)
  const persone = pianoModifica(base, { ...nuovi, persone_per_notte: [2, 1, 1, 1] }, adesso)
  assert.equal(persone.propostaSuperata, true)
  assert.equal(persone.avviso, 'La proposta inviata si riferiva ai dati precedenti: rigenera e reinvia la proposta')
  assert.equal(persone.campi.stato, 'in_attesa'); assert.equal(persone.campi.proposta_testo, null); assert.equal(persone.campi.proposta_soluzione, null)
  assert.deepEqual(persone.campi.proposte_precedenti, [{ testo: 'ciao', soluzione: { caso: 'completa' }, inviata_at: '2026-09-02T10:00:00Z', superata_at: '2026-09-03T08:00:00.000Z' }])
  assert.equal(pianoModifica(base, { ...nuovi, camera_id: 'amelia' }, adesso).propostaSuperata, true)
  assert.equal(pianoModifica(base, { ...nuovi, partenza: '2026-09-22' }, adesso).propostaSuperata, true)
  // in attesa: le stesse modifiche non toccano lo stato né lo storico
  const attesa = pianoModifica({ ...base, stato: 'in_attesa' }, { ...nuovi, persone: 3 }, adesso)
  assert.equal(attesa.propostaSuperata, false); assert.equal(attesa.campi.proposte_precedenti, undefined)
  assert.match(pianoModifica({ ...base, stato: 'confermata' }, nuovi, adesso).errore ?? '', /non si modifica/)
})

// ── Timer della proposta (3 ore da «Sì, inviata») ───────────────────────────
test('scadenzaProposta: niente sulle richieste in attesa o senza ora di invio', () => {
  assert.equal(scadenzaProposta(richiesta({}), adesso), null)
  assert.equal(scadenzaProposta(richiesta({ stato: 'proposta_inviata', proposta_inviata_at: null }), adesso), null)
  assert.equal(scadenzaProposta(richiesta({ stato: 'confermata', proposta_inviata_at: locale(2026, 9, 2, 8, 0).toISOString() }), adesso), null)
})

test('scadenzaProposta: tempo che manca, in verde', () => {
  const inviata = (h: number, m: number) => richiesta({ stato: 'proposta_inviata', proposta_inviata_at: locale(2026, 9, 2, h, m).toISOString() })
  assert.deepEqual(scadenzaProposta(inviata(8, 15), adesso), { scaduta: false, testo: 'Proposta inviata · scade tra 2 h 15 min' })
  assert.deepEqual(scadenzaProposta(inviata(6, 45), adesso), { scaduta: false, testo: 'Proposta inviata · scade tra 45 min' })
  assert.deepEqual(scadenzaProposta(inviata(8, 0), adesso), { scaduta: false, testo: 'Proposta inviata · scade tra 2 h' })
  assert.deepEqual(scadenzaProposta(inviata(6, 1), adesso), { scaduta: false, testo: 'Proposta inviata · scade tra 1 min' })
  // secondi in mezzo: si arrotonda verso l'alto, mai un minuto in meno del vero
  const conSecondi = richiesta({ stato: 'proposta_inviata', proposta_inviata_at: new Date(locale(2026, 9, 2, 8, 15).getTime() - 30000).toISOString() })
  assert.equal(scadenzaProposta(conSecondi, adesso)?.testo, 'Proposta inviata · scade tra 2 h 15 min')
})

test('scadenzaProposta: scaduta, in ottone', () => {
  const inviata = (h: number, m: number) => richiesta({ stato: 'proposta_inviata', proposta_inviata_at: locale(2026, 9, 2, h, m).toISOString() })
  assert.deepEqual(scadenzaProposta(inviata(6, 0), adesso), { scaduta: true, testo: 'Proposta inviata · scaduta adesso' })
  assert.deepEqual(scadenzaProposta(inviata(5, 40), adesso), { scaduta: true, testo: 'Proposta inviata · scaduta 20 min fa' })
  assert.deepEqual(scadenzaProposta(inviata(3, 0), adesso), { scaduta: true, testo: 'Proposta inviata · scaduta 3 h fa' })
  assert.deepEqual(scadenzaProposta(inviata(2, 30), adesso), { scaduta: true, testo: 'Proposta inviata · scaduta 3 h fa' })
})

test('scadenzaProposta: cambio di giorno', () => {
  const a = (g: number, h: number, m: number) => locale(2026, 9, g, h, m)
  const inviata = (d: Date) => richiesta({ stato: 'proposta_inviata', proposta_inviata_at: d.toISOString() })
  // scaduta ieri sera alle 22:30, oggi sono le 9: «ieri», non «10 h fa»
  assert.equal(scadenzaProposta(inviata(a(1, 19, 30)), adesso)?.testo, 'Proposta inviata · scaduta ieri')
  // scaduta alle 23:50, sono le 00:10: contano i minuti, non il giorno
  assert.equal(scadenzaProposta(inviata(a(2, 20, 50)), a(3, 0, 10))?.testo, 'Proposta inviata · scaduta 20 min fa')
  // scaduta alle 23:00, sono le 01:30 del giorno dopo: «ieri»
  assert.equal(scadenzaProposta(inviata(a(2, 20, 0)), a(3, 1, 30))?.testo, 'Proposta inviata · scaduta ieri')
  // il tempo che manca attraversa la mezzanotte senza problemi
  assert.equal(scadenzaProposta(inviata(a(2, 22, 0)), a(2, 23, 30))?.testo, 'Proposta inviata · scade tra 1 h 30 min')
  // più giorni
  assert.equal(scadenzaProposta(inviata(locale(2026, 8, 30, 10, 0)), adesso)?.testo, 'Proposta inviata · scaduta 3 giorni fa')
})

test('daGuardare include le proposte scadute, non quelle ancora valide', () => {
  const valida = richiesta({ stato: 'proposta_inviata', created_at: locale(2026, 9, 2, 8, 0).toISOString(), proposta_inviata_at: locale(2026, 9, 2, 8, 15).toISOString() })
  const scaduta = richiesta({ stato: 'proposta_inviata', created_at: locale(2026, 9, 2, 5, 0).toISOString(), proposta_inviata_at: locale(2026, 9, 2, 5, 40).toISOString() })
  assert.deepEqual(daGuardare([valida, scaduta, richiesta({})], adesso), [scaduta])
  assert.equal(avvisoFerma(scaduta, adesso), null)   // l'avviso «ferma da» resta quello delle 48 ore
})
