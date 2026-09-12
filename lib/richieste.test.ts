import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  formatIntervallo, oraArrivo, tempoTrascorso, ordinaRichieste, inArchivio, contaAperte, nomeCompleto, spiegaErrore, avvisoFerma, daGuardare, nuoveDalSito, rigaChiusa, riapribile, eRifiutata,
  riassuntoPersone, pianoModifica, scadenzaProposta, type Richiesta, linkModificaRichiesta, ritornoDallaModifica,
  daDoveRichiesta, ritornoDallaRichiesta, linkRichiesta, propostaDellaRichiesta, tastoRichiesta } from './richieste.ts'
import { rigaDaGuardare, testoRigaGuardare, ORDINI_RICHIESTE } from './comandiRichieste.ts'

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

test('chiuse: solo negli ultimi 3 giorni (dal 06/09/2026, prima 90); conteggio delle aperte', () => {
  const chiusaIeri = richiesta({ stato: 'confermata', chiusa_at: locale(2026, 9, 1).toISOString() })
  const chiusaVecchia = richiesta({ stato: 'rifiutata', chiusa_at: locale(2026, 5, 1).toISOString() })
  const senzaData = richiesta({ stato: 'rifiutata', chiusa_at: null, created_at: locale(2026, 8, 1).toISOString() })
  const chiusaDaSola = richiesta({ stato: 'chiusa', chiusura_motivo: 'scaduta', chiusa_at: locale(2026, 8, 31).toISOString() })
  const aperta = richiesta({ stato: 'proposta_inviata' })
  assert.equal(inArchivio(chiusaIeri, adesso), true)
  assert.equal(inArchivio(chiusaVecchia, adesso), false)
  assert.equal(inArchivio(senzaData, adesso), false)   // attesa aggiornata il 06/09/2026: creata il 1° agosto, oltre i 3 giorni
  assert.equal(inArchivio(chiusaDaSola, adesso), true)
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

// Linguetta «Chiuse» (06/09/2026): riga di stato e «Riapri»
test('chiuse: riga di stato ottone/grigia/verde e chi si può riaprire', () => {
  const ieriSera = locale(2026, 9, 1, 16, 40).toISOString()
  assert.deepEqual(rigaChiusa({ stato: 'chiusa', chiusura_motivo: 'scaduta', chiusa_at: ieriSera }, adesso), { testo: 'Scaduta, chiusa da sola ieri alle 16:40', tono: 'ottone' })
  assert.deepEqual(rigaChiusa({ stato: 'chiusa', chiusura_motivo: 'rifiutata', chiusa_at: locale(2026, 8, 30, 10, 0).toISOString() }, adesso), { testo: 'Rifiutata da te · 30 ago', tono: 'grigio' })
  assert.deepEqual(rigaChiusa({ stato: 'rifiutata', chiusa_at: locale(2026, 9, 2, 8, 0).toISOString() }, adesso), { testo: 'Rifiutata da te · oggi', tono: 'grigio' })
  assert.deepEqual(rigaChiusa({ stato: 'confermata', chiusa_at: ieriSera }, adesso), { testo: 'Confermata · ieri', tono: 'verde' })
  assert.equal(riapribile({ stato: 'chiusa' }), true); assert.equal(riapribile({ stato: 'rifiutata' }), true); assert.equal(riapribile({ stato: 'confermata' }), false)
  assert.equal(eRifiutata({ stato: 'chiusa', chiusura_motivo: 'scaduta' }), false); assert.equal(eRifiutata({ stato: 'rifiutata' }), true)
})

// «Modifica la richiesta» nella testa della proposta (Ania, 11/09/2026):
// deve esserci SEMPRE. Prima spariva sulle richieste chiuse e mentre si
// aspettava la risposta a «L'hai inviata?».
test('il link per modificare c’è per qualunque stato della richiesta', () => {
  const stati = ['in_attesa', 'proposta_inviata', 'confermata', 'rifiutata', 'chiusa']
  for (const stato of stati) {
    assert.equal(linkModificaRichiesta({ id: 'r1', stato } as never), '/richieste/r1/modifica')
  }
  // non guarda lo stato: basta l'id
  assert.equal(linkModificaRichiesta({ id: 'abc-123' }), '/richieste/abc-123/modifica')
})

// Dopo «Modifica la richiesta» si torna da dove si era arrivati (Ania, 12/09/2026)
test('il link della modifica porta con sé da dove si è arrivati', () => {
  assert.equal(linkModificaRichiesta({ id: 'r1' }), '/richieste/r1/modifica')
  assert.equal(linkModificaRichiesta({ id: 'r1' }, 'elenco'), '/richieste/r1/modifica')
  assert.equal(linkModificaRichiesta({ id: 'r1' }, 'proposta'), '/richieste/r1/modifica?da=proposta')
})

test('finita la modifica si torna alla pagina di partenza', () => {
  // dalla proposta si torna alla proposta, col messaggio già rifatto
  assert.equal(ritornoDallaModifica('r1', 'proposta'), '/richieste/r1/proposta')
  // dall'elenco (o senza indicazione) si torna all'elenco
  assert.equal(ritornoDallaModifica('r1', 'elenco'), '/richieste')
  assert.equal(ritornoDallaModifica('r1', null), '/richieste')
  assert.equal(ritornoDallaModifica('r1', undefined), '/richieste')
  assert.equal(ritornoDallaModifica('r1', 'qualcosa-di-strano'), '/richieste')
})

// ── LA FRECCIA «INDIETRO» NEL GIRO DELLE RICHIESTE (Ania, 12/09/2026) ──────
// Aprendo una richiesta del gruppo e toccando «Indietro» si finiva sulla Home,
// dove Ania non era mai stata: la freccia faceva un passo nella cronologia del
// browser invece di andare in una pagina decisa. Adesso la destinazione è
// scritta, e la Home si raggiunge solo se si veniva davvero dalla Home.

test('senza indicazione si torna SEMPRE alle Richieste, mai alla Home', () => {
  assert.equal(ritornoDallaRichiesta(null), '/richieste')
  assert.equal(ritornoDallaRichiesta(undefined), '/richieste')
  assert.equal(ritornoDallaRichiesta(''), '/richieste')
  assert.equal(ritornoDallaRichiesta('elenco'), '/richieste')
  // aperta da una notifica push (/richieste/<id>, senza ?da=): si torna all'elenco
  assert.equal(ritornoDallaRichiesta('Home'), '/richieste')
  assert.equal(ritornoDallaRichiesta('/'), '/richieste')
  assert.equal(ritornoDallaRichiesta('qualcosa-di-strano'), '/richieste')
})

test('dalla Home si torna alla Home', () => {
  assert.equal(daDoveRichiesta('home'), 'home')
  assert.equal(ritornoDallaRichiesta('home'), '/')
})

test('il link della Home porta con sé il punto di partenza', () => {
  assert.equal(linkRichiesta('r1', 'home'), '/richieste/r1?da=home')
  // dall'elenco (che è il caso normale) l'indirizzo resta pulito
  assert.equal(linkRichiesta('r1'), '/richieste/r1')
  assert.equal(linkRichiesta('r1', 'elenco'), '/richieste/r1')
})

test('il rimbalzo sulla proposta non perde il punto di partenza', () => {
  // /richieste/<id> porta sempre alla proposta: è lì che si lavora
  assert.equal(propostaDellaRichiesta('r1', null), '/richieste/r1/proposta')
  assert.equal(propostaDellaRichiesta('r1', 'elenco'), '/richieste/r1/proposta')
  assert.equal(propostaDellaRichiesta('r1', 'home'), '/richieste/r1/proposta?da=home')
  // e la freccia della proposta legge quello stesso `da`
  assert.equal(ritornoDallaRichiesta('home'), '/')
})

test('tornando all\'elenco non si riaccende nessun filtro', () => {
  // l'indirizzo del ritorno è l'elenco intero: niente gruppo, niente ricerca
  for (const da of [null, undefined, 'elenco', 'strano']) {
    assert.equal(ritornoDallaRichiesta(da), '/richieste')
  }
  assert.equal(ritornoDallaModifica('r1', 'elenco'), '/richieste')
})

// La freccia deve avere una destinazione anche nel codice: `href` su BackBar
// significa «fai un passo nella cronologia e usa questa pagina solo di
// riserva», ed è proprio quello che portava sulla Home. Nelle pagine delle
// Richieste ci va sempre `onClick`, cioè la pagina decisa.
test('nelle pagine delle Richieste la freccia va in una pagina decisa, non nella cronologia', () => {
  const pagine = [
    'app/richieste/page.tsx',
    'app/richieste/nuova/page.tsx',
    'app/richieste/[id]/modifica/page.tsx',
    'app/richieste/[id]/proposta/page.tsx',
  ]
  for (const p of pagine) {
    const testo = readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
    assert.equal(/<BackBar href=/.test(testo), false, `${p}: la freccia si affida ancora alla cronologia`)
    assert.equal(/<BackBar onClick=/.test(testo), true, `${p}: manca la freccia con la destinazione`)
  }
  // il rimbalzo /richieste/<id> → …/proposta conserva il punto di partenza
  const rimbalzo = readFileSync(new URL('../app/richieste/[id]/page.tsx', import.meta.url), 'utf8')
  assert.equal(/propostaDellaRichiesta\(id, da\)/.test(rimbalzo), true)
})

// ── LA SCHEDA DELLA RICHIESTA NELL'ELENCO (Ania, 12/09/2026) ───────────────

test('il tasto pieno dice cosa fare adesso', () => {
  // la proposta non è ancora partita: si manda
  assert.equal(tastoRichiesta('in_attesa'), 'Invia proposta')
  // la proposta è partita: si aspetta il sì e si conferma
  assert.equal(tastoRichiesta('proposta_inviata'), 'Conferma')
  // richiesta chiusa: nessun tasto
  assert.equal(tastoRichiesta('confermata'), null)
  assert.equal(tastoRichiesta('rifiutata'), null)
  assert.equal(tastoRichiesta('chiusa'), null)
})

test('l’ultima riga della richiesta ha i quattro comandi nell’ordine chiesto', () => {
  const az = readFileSync(new URL('../components/richieste/AzioniRichiesta.tsx', import.meta.url), 'utf8')

  // la pastiglia è quella dei tasti WhatsApp: verde pieno, tonda, 12 semibold
  assert.match(az, /import \{ BOTTONE_PIENO \} from '@\/components\/BottoniWhatsApp'/)
  const whatsapp = readFileSync(new URL('../components/BottoniWhatsApp.tsx', import.meta.url), 'utf8')
  assert.match(whatsapp, /BOTTONE_PIENO = '[^']*rounded-full bg-green-mid text-white[^']*text-\[12px\] font-semibold/)
  // con le misure della bozza: 5 px sopra e sotto, 12 ai lati
  assert.match(az, /MISURA_PASTIGLIA = \{ padding: '5px 12px' \}/)
  const tasto = az.slice(az.indexOf('export function TastoPrincipale'), az.indexOf('// Le due icone'))
  assert.match(tasto, /<span className=\{BOTTONE_PIENO\} style=\{MISURA_PASTIGLIA\}>\{testo\}<\/span>/)
  // niente più tasto verde largo quanto la riga
  assert.equal(/flex-1 min-w-0/.test(tasto), false, 'la pastiglia si allarga ancora per tutta la riga')

  // «Modifica» e «Rifiuta»: parole, 13 px stone, distanziate di 14 px
  const comandi = az.slice(az.indexOf('const COMANDO'))
  assert.match(comandi, /MISURA_COMANDO = \{ fontSize: 13, color: 'var\(--color-stone\)' \}/)
  assert.match(comandi, /export const SPAZIO_COMANDI = 14/)
  assert.equal(comandi.match(/className=\{COMANDO\}/g)?.length, 2)
  // niente più sottolineature né contorni
  assert.equal(/underline/.test(comandi), false)

  // le due icone: nude, 17 px, green-mid. Niente cerchio col contorno.
  const icone = az.slice(az.indexOf('// Le due icone'), az.indexOf('// «Modifica» e «Rifiuta»: parole'))
  assert.match(icone, /text-green-mid/)
  assert.equal(icone.match(/size=\{17\}/g)?.length, 2)
  assert.equal(/rounded-full|border/.test(icone), false, 'le icone hanno ancora il cerchio')
  // le etichette per chi non vede restano
  assert.match(icone, /aria-label=\{`Chiama \$\{nome\}`\}/)
  assert.match(icone, /aria-label=\{`Scrivi su WhatsApp a \$\{nome\}`\}/)

  // tutte e quattro tengono 44 px di area utile senza rubare altezza alla riga
  assert.match(tasto, /py-\[9px\] -my-\[9px\]/)               // 25 + 9 + 9 = 43
  assert.match(comandi, /py-\[15px\] -my-\[15px\]/)            // 14 + 15 + 15 = 44
  assert.match(icone, /height: 44, marginTop: -9, marginBottom: -9/)

  // presenza e ORDINE nella riga: pastiglia, Modifica, Rifiuta, icone a destra
  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  const riga = pagina.slice(pagina.indexOf('function RigaRichiesta'), pagina.indexOf('function RigaChiusa'))
  const ultima = riga.slice(riga.indexOf('<div className="flex items-center mt-2"'))
  const ordine = ['<TastoPrincipale', '<ComandiRichiesta', '<IconeContatto']
  const posizioni = ordine.map(x => {
    const i = ultima.indexOf(x)
    assert.notEqual(i, -1, `manca ${x} nell'ultima riga`)
    return i
  })
  assert.deepEqual(posizioni, [...posizioni].sort((a, b) => a - b), 'i comandi non sono nell\u2019ordine chiesto')
  assert.match(ultima, /<IconeContatto r=\{r\} className="ml-auto" \/>/)   // in fondo a destra
  assert.match(ultima, /style=\{\{ gap: SPAZIO_COMANDI \}\}/)             // 14 px dalla pastiglia
})

// La nota del cliente nella riga: tutta rossa come nella Home (Ania, su bozza,
// 12/09/2026). Il rosso resta quello scelto l'8 settembre, #C00000: lo stesso
// ovunque compaia la nota.
test('la nota del cliente nella riga è tutta rossa, come nella Home', () => {
  const nota = readFileSync(new URL('../components/richieste/NotaCliente.tsx', import.meta.url), 'utf8')
  assert.match(nota, /export const ROSSO_NOTA = '#C00000'/)
  // il rosso vecchio resta solo nel commento che racconta il cambio, mai nel codice
  const codice = nota.split('\n').filter(r => !r.trim().startsWith('//')).join('\n')
  assert.equal(/#C0392B/.test(codice), false, 'è tornato il rosso vecchio')
  assert.equal(codice.match(/color: ROSSO_NOTA/g)?.length, 2)
  // la veste della Home: 13 px semibold, tutta rossa, senza «Nota del cliente:»
  assert.match(nota, /text-\[13px\] leading-snug font-semibold/)
  const home = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
  assert.match(home, /text-\[13px\] leading-snug font-semibold/)

  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  const riga = pagina.slice(pagina.indexOf('function RigaRichiesta'), pagina.indexOf('function RigaChiusa'))
  assert.match(riga, /<NotaCliente note=\{r\.note\} home className="mt-1" \/>/)
  assert.equal(/centrata/.test(riga), false)
})

// ── I COMANDI SOTTO IL CALENDARIO (Ania, dal telefono, 12/09/2026) ────────
// Le pastiglie colorate sono diventate parole: «N da guardare» e «Ordina per».
// «+ Nuova richiesta» resta la piccola etichetta sage di prima.
test('sotto il calendario gli avvisi e l\u2019ordinamento sono parole, non pastiglie', () => {
  const comandi = readFileSync(new URL('../components/richieste/ComandiPagina.tsx', import.meta.url), 'utf8')

  // «+ Nuova richiesta»: com'era — alto 24, sage, green-mid 11,5 bold, angoli 4
  assert.match(comandi, /export const ALTEZZA_TASTO = 24/)
  assert.match(comandi, /bg-sage text-green-mid/)
  assert.match(comandi, /height: ALTEZZA_TASTO, padding: '0 9px', borderRadius: ANGOLI_VOCE, fontSize: 11\.5, fontWeight: 700/)

  // «N da guardare»: pallino d'ottone da 7 px, il conto in bold #7A5C1E, la
  // coda in grigio; tutto in 14 px — la misura minima chiesta da Ania, che i
  // filtri di ieri (12,5) non rispettavano
  assert.match(comandi, /const TESTO_RIGHE = 14\b/)
  assert.equal(/TESTO_RIGHE = 1[0-3]/.test(comandi), false, 'le righe di parole sono scese sotto i 14 px')
  assert.match(comandi, /const OTTONE_SCURO = '#7A5C1E'/)
  assert.match(comandi, /width: 7, height: 7, borderRadius: '50%', background: OTTONE_PALLINO/)
  assert.match(comandi, /fontWeight: 700, color: OTTONE_SCURO \}\}>\{riga\.conto\}/)
  assert.match(comandi, /color: 'var\(--color-stone\)' \}\}>\{riga\.coda\}/)
  // se non ce ne sono la riga non c'è proprio
  assert.match(comandi, /if \(!riga\) return null/)

  // «Ordina per»: la scelta in green-mid bold, sottolineatura sottile d'ottone
  // chiaro 4 px sotto il testo; le altre due parole in grigio
  assert.match(comandi, /const OTTONE_CHIARO = 'rgba\(169,136,78,0\.45\)'/)
  assert.match(comandi, /fontWeight: 700, color: 'var\(--color-green-mid\)', textDecoration: 'underline', textDecorationColor: OTTONE_CHIARO, textDecorationThickness: 1, textUnderlineOffset: 4/)
  assert.match(comandi, /<span className=\{TOCCO\}>Ordina per<\/span>/)

  // tutto quello che si tocca è alto 44 px: 20 px di riga + 12 sopra e sotto
  assert.match(comandi, /const TOCCO = 'py-\[12px\]'/)
  assert.match(comandi, /lineHeight: '20px'/)
  assert.match(comandi, /export const ALTEZZA_TOCCO = 44/)

  // le pastiglie degli avvisi e l'interruttore «Ordina» non ci sono più
  assert.equal(/EtichettaAvviso|TastoAvviso|AVVISO_SITO|AVVISO_GUARDARE|InterruttoreSquadrato/.test(comandi), false)
  assert.equal(/#EFE2C7|#EFEADF/.test(comandi), false, 'i fondi delle pastiglie sono ancora qui')
})

// La riga «N da guardare», nei due stati e quando non serve
test('la riga «da guardare» dice il conto e la via d\u2019uscita', () => {
  assert.deepEqual(rigaDaGuardare(3), { conto: '3 da guardare', coda: ' · ferme da più di un giorno' })
  assert.equal(testoRigaGuardare(rigaDaGuardare(3)), '3 da guardare · ferme da più di un giorno')
  // acceso il filtro, la coda diventa la via d'uscita
  assert.equal(testoRigaGuardare(rigaDaGuardare(3, true)), '3 da guardare · mostra tutte')
  assert.equal(testoRigaGuardare(rigaDaGuardare(1, true)), '1 da guardare · mostra tutte')
  // nessuna richiesta ferma: niente riga
  assert.equal(rigaDaGuardare(0), null)
  assert.equal(rigaDaGuardare(0, true), null)
  assert.equal(rigaDaGuardare(-2), null)
  assert.equal(testoRigaGuardare(null), '')
})

// «Ordina per arrivo notti persone»: le stesse tre scelte di prima
test('le tre parole dell\u2019ordinamento, nell\u2019ordine chiesto', () => {
  assert.deepEqual(ORDINI_RICHIESTE.map(([, parola]) => parola), ['arrivo', 'durata', 'persone'])
  assert.deepEqual(ORDINI_RICHIESTE.map(([v]) => v), ['arrivo', 'durata', 'persone'])
  // e sono davvero le tre scelte che ordinaRichieste sa fare
  const a = richiesta({ id: 'a', arrivo: '2026-10-01', partenza: '2026-10-02', persone: 3 })
  const b = richiesta({ id: 'b', arrivo: '2026-10-10', partenza: '2026-10-14', persone: 1 })
  for (const [v] of ORDINI_RICHIESTE) assert.equal(ordinaRichieste([a, b], v).length, 2)
})

test('sotto il calendario le due righe di parole stanno dopo l\u2019interruttore', () => {
  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  const sotto = pagina.slice(pagina.indexOf('Sul telefono i comandi stanno sotto il calendario'), pagina.indexOf('{/* Lista */}'))
  const dove = (x: string) => {
    const i = sotto.indexOf(x)
    assert.notEqual(i, -1, `manca ${x} sotto il calendario`)
    return i
  }
  // riga 1: interruttore a sinistra, «+ Nuova richiesta» a destra
  const riga1 = dove('<InterruttoreVista vista={vista} onChange={setVista} />')
  const tasto = dove('<TastoNuovaRichiesta />')
  assert.ok(tasto - riga1 < 200, 'interruttore e «+ Nuova richiesta» non sono sulla stessa riga')
  assert.match(sotto, /justify-between/)
  // riga 2: «N da guardare» · riga 3: «Ordina per»
  const guardare = dove('<RigaDaGuardare')
  const ordina = dove('<RigaOrdina')
  assert.ok(tasto < guardare && guardare < ordina, '«da guardare» e «Ordina per» non stanno nelle righe dopo')
  assert.match(sotto, /quante=\{ferme\.length\} acceso=\{soloDaGuardare\}/)

  // le «nuove dal sito» restano solo nel sottotitolo in cima
  assert.equal(/dati="dal-sito"|<Globe/.test(pagina), false, 'le «nuove dal sito» hanno ancora un\u2019etichettina')
  assert.match(pagina, /<TestataRichieste aperte=\{aperte\.length\} nuoveDalSito=\{nuoveWeb\}/)

  // niente più pastiglie né bottoni tondi sparsi
  assert.equal(/EtichettaAvviso|TastoAvviso|InterruttoreSquadrato/.test(pagina), false)
  assert.equal(/rounded-full text-sm font-medium/.test(pagina), false)
  assert.equal(/BOTTONE_PIENO|BOTTONE_PICCOLO|MISURA_PASTIGLIA/.test(pagina), false)
})

// ── SOTTO IL CALENDARIO NON SI SPIEGA PIÙ IL TRATTEGGIO ───────────────
// Ania sa cosa sono le righe tratteggiate: la legenda era una riga di schermo
// spesa per niente, proprio dove servono i comandi (dal telefono, 12/09/2026).
// Lo STACCO però resta: senza, i comandi si appiccicano al calendario.
test('sotto il calendario non c\u2019\u00e8 pi\u00f9 la spiegazione del tratteggio, ma lo stacco resta', () => {
  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  assert.equal(/Tratteggiato =/.test(pagina), false, 'la legenda del tratteggio \u00e8 ancora l\u00ec')
  assert.equal(/Solo confermate: queste non si toccano/.test(pagina), false)
  assert.equal(/GRIGIO_NOTA/.test(pagina), false, 'il colore della legenda \u00e8 rimasto inutilizzato')
  // lo spazio che occupava resta vuoto, fra il calendario e i comandi
  assert.match(pagina, /data-stacco-calendario aria-hidden style=\{\{ height: 24 \}\}/)
  const sotto = pagina.slice(pagina.indexOf('<RigaMesi'), pagina.indexOf('{/* Lista */}'))
  assert.ok(sotto.indexOf('data-stacco-calendario') < sotto.indexOf('<InterruttoreVista'),
    'lo stacco deve stare fra il calendario e i comandi')
})

// ── IL SELETTORE DELLA VISTA È QUELLO DEL CALENDARIO ───────────────────────
// «Reale | Presunta» e «Mese | 2 settimane» sono lo stesso oggetto, disegnato
// in un posto solo: components/InterruttorePillola (Ania, dal telefono,
// 12/09/2026). Prima erano due disegni diversi che stavano divergendo.
test('il selettore Reale/Presunta è lo stesso «Mese | 2 settimane» del Calendario', () => {
  const pillola = readFileSync(new URL('../components/InterruttorePillola.tsx', import.meta.url), 'utf8')
  // la pillola: contorno 1 px #C9BFA8, 2 px di bordo interno, fondo trasparente
  assert.match(pillola, /export const BORDO_PILLOLA = '#C9BFA8'/)
  assert.match(pillola, /inline-flex rounded-full border p-0\.5/)
  assert.match(pillola, /borderColor: BORDO_PILLOLA/)
  assert.equal(/background(?!-)/.test(pillola), false, 'la pillola non deve avere un fondo')
  // le parole: 11 px semibold green-dark, 8 px ai lati e 4 sopra e sotto;
  // la scelta su green-mid col testo crema
  assert.match(pillola, /px-2 py-1 text-\[11px\]/)
  assert.match(pillola, /font-semibold/)
  assert.match(pillola, /presa \? 'bg-green-mid text-cream-text' : 'text-green-dark'/)
  // dal Mac le parole restano un filo più larghe, come prima
  assert.match(pillola, /grande \? 'px-3 py-1 text-xs'/)
  // si tocca: 44 px di area utile, fuori dal disegno
  assert.match(pillola, /py-\[10px\] -my-\[10px\]/)
  assert.match(pillola, /export const ALTEZZA_TOCCO = 44/)

  // LE DUE PAGINE usano quel componente: non possono più divergere
  const vista = readFileSync(new URL('../components/richieste/InterruttoreVista.tsx', import.meta.url), 'utf8')
  assert.match(vista, /import InterruttorePillola from '@\/components\/InterruttorePillola'/)
  assert.match(vista, /<InterruttorePillola voci=\{VOCI\}/)
  const calendario = readFileSync(new URL('../app/calendario/page.tsx', import.meta.url), 'utf8')
  assert.match(calendario, /import InterruttorePillola from '@\/components\/InterruttorePillola'/)
  assert.match(calendario, /<InterruttorePillola voci=\{VOCI_GRIGLIA\}/)
  assert.match(calendario, /VOCI_GRIGLIA = \[\['mese', 'Mese'\], \['quindici', '2 settimane'\]\]/)
  // e anche il calendarietto dentro le Richieste, che era la terza copia
  const calRichieste = readFileSync(new URL('../components/richieste/CalendarioRichieste.tsx', import.meta.url), 'utf8')
  assert.match(calRichieste, /<InterruttorePillola voci=\{VOCI_CALENDARIO\}/)
  assert.match(calRichieste, /VOCI_CALENDARIO = \[\['mese', 'Mese'\], \['quindici', '2 settimane'\]\]/)
  // nessuno dei tre si ridisegna per conto suo
  for (const [nome, testo] of [['il Calendario', calendario], ['il calendario delle Richieste', calRichieste]] as const) {
    assert.equal(/rounded-full border p-0\.5/.test(testo), false, `${nome} ridisegna la pillola per conto suo`)
  }
  assert.equal(/rounded-full/.test(vista), false, 'le Richieste ridisegnano la pillola per conto loro')
})

