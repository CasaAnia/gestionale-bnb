import { test } from 'node:test'
import assert from 'node:assert/strict'
import { strisciaSettimane } from './numeriOggi.ts'
import { cicloCambio, pulizieAperte, type Decisione } from './pulizie.ts'
import { resocontoPulizie } from './pulizieResoconto.ts'
import { letturaPulizieRecente } from './letturaPulizieRecente.ts'
const camere = [{ id: 'amelia', name: 'Amelia' }]
const b = { id: 'soggiorno-prova', room_id: 'amelia', check_in: '2026-09-21', check_out: '2026-09-30', status: 'confermata', guest_id: 'ospite-fittizio' }
const rinvio: Decisione = { id: 'rinvio', room_id: b.room_id, booking_id: b.id, tipo: 'soggiorno', stato: 'rimandata', data_prevista: '2026-09-25', data_effettiva: null, prossima_data: '2026-09-26', created_at: '2026-09-25T14:21:24Z' }
const report = (ev: Decisione[], oggi = '2026-09-25') => resocontoPulizie(camere, [b], ev, [], '2026-09-01', '2026-10-01', oggi)
const giorno = (ev: Decisione[], data: string, oggi = '2026-09-25') => strisciaSettimane(camere, [b], ev, oggi).find(g => g.giorno === data)!

test('caso Amelia 25→26: Home, pagina Pulizie e statistiche non lo contano come fatto', () => {
 const striscia = strisciaSettimane(camere, [b], [rinvio], '2026-09-25')
 assert.equal(striscia[0].daFare, 0); assert.equal(striscia[0].fatte, 0)
 assert.equal(striscia[1].daFare, 1); assert.equal(striscia[1].fatte, 0)
 assert.equal(report([rinvio]).fatte.length, 0); assert.equal(report([rinvio]).pezzi, 0)
 assert.equal(pulizieAperte([b], b.room_id, '2026-09-25', [rinvio]).length, 0)
 assert.equal(pulizieAperte([b], b.room_id, '2026-09-26', [rinvio]).length, 1)
 assert.equal(report([rinvio], '2026-09-26').fatte.length, 0)
})
test('rinvio di due giorni e poi conferma: un intervento nella data effettiva, prossimo ciclo da quella data', () => {
 const due = { ...rinvio, prossima_data: '2026-09-27' }
 assert.equal(giorno([due], '2026-09-26').daFare, 0); assert.equal(giorno([due], '2026-09-27').daFare, 1)
 const fatta: Decisione = { ...due, id: 'fatta', stato: 'fatta', data_effettiva: '2026-09-27', data_prevista: '2026-09-27', prossima_data: null, created_at: '2026-09-27T12:00:00Z' }
 const ev = [due, fatta]
 assert.equal(report(ev, '2026-09-27').fatte.length, 1)
 assert.equal(giorno(ev, '2026-09-27', '2026-09-27').fatte, 1)
 assert.equal(cicloCambio([b], b, ev).due, null, 'il prossimo cambio supererebbe la partenza')
})
test('salta vicino alla partenza: nessun intervento, nessun recupero, niente pulizia fatta nella Home', () => {
 const corto = { ...b, check_out: '2026-09-26' }
 const salto: Decisione = { ...rinvio, stato: 'saltata', prossima_data: '2026-09-29' }
 const s = strisciaSettimane(camere, [corto], [salto], '2026-09-25')
 assert.equal(s[0].daFare, 0); assert.equal(s[0].fatte, 0)
 assert.equal(s[1].daFare, 1, 'resta la pulizia finale alla partenza')
 assert.equal(cicloCambio([corto], corto, [salto]).due, null)
 assert.equal(report([salto]).fatte.length, 0)
})
test('risposta vecchia dopo il rinvio non riporta il conteggio precedente nella Home', async () => {
 const risposte: ((value: string) => void)[] = []; const visti: string[] = []
 const c = letturaPulizieRecente(() => new Promise<string>(resolve => risposte.push(resolve)), d => visti.push(d), () => visti.push('errore'))
 const prima = c.ricarica(), dopo = c.ricarica()
 risposte[1]('domani: 1 da fare, oggi: 0 fatte'); await dopo
 risposte[0]('conteggio precedente al rinvio'); await prima
 assert.deepEqual(visti, ['domani: 1 da fare, oggi: 0 fatte'])
 const pendente = c.ricarica(); c.chiudi(); risposte[2]('risposta dopo uscita'); await pendente
 assert.equal(visti.length, 1)
})
