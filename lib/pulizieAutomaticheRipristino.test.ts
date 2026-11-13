import test from 'node:test'
import assert from 'node:assert/strict'
import { storicoPulizieCompleto, pulizieAperte, puliziaPresunta, type PrenotazionePulizie, type Decisione } from './pulizie.ts'
import { interventiDaTabelle } from './pulizieDotazioneStatistiche.ts'
const b: PrenotazionePulizie = { id: 'b', guest_id: 'g', room_id: 'r', check_in: '2026-11-01', check_out: '2026-11-12', status: 'confermata', num_guests: 2 }
test('assenza dal gestionale: cambi ogni quattro notti chiusi nel passato, oggi resta da fare', () => {
 const s = storicoPulizieCompleto([b], [], '2026-11-12')
 assert.deepEqual(s.map(e => e.data_prevista), ['2026-11-05','2026-11-09'])
 assert.equal(pulizieAperte([b], 'r', '2026-11-12', []).length, 1)
 const domani = storicoPulizieCompleto([b], [], '2026-11-13')
 assert.equal(domani.length, 3)
 assert.equal(pulizieAperte([b], 'r', '2026-11-13', []).length, 0)
 assert.deepEqual(storicoPulizieCompleto([b], domani, '2026-11-13'), domani)
})
test('recupero aggiunto dopo: la conferma sostituisce la voce automatica, stessa data e un solo intervento', () => {
 const fatta: Decisione = { id:'manuale', room_id:'r', booking_id:'b', tipo:'soggiorno', stato:'fatta', data_prevista:'2026-11-05', data_effettiva:'2026-11-05' }
 const s = storicoPulizieCompleto([b], [fatta], '2026-11-10')
 assert.equal(s.length,2)
 assert.equal(s.filter(e=>e.data_prevista==='2026-11-05').length,1)
 const i = interventiDaTabelle(s, [], [b], [{id:'r',name:'Ambra'}])
 assert.equal(i.length,2)
 assert.ok(i.every(e=>e.dotazione && e.recuperi && e.recuperi.federe===0))
 assert.ok(s.some(puliziaPresunta))
})
test('rinvio e salto espliciti rispettati, richieste escluse e prolungamenti senza cambio ospite', () => {
 const corta = {...b, check_out:'2026-11-05'}
 const seguito = {...b, id:'b2',check_in:'2026-11-05'}
 const s = storicoPulizieCompleto([corta,seguito,{...b,id:'attesa',status:'in_attesa'}], [], '2026-11-13')
 assert.equal(s.length,3)
 assert.equal(s.filter(e=>e.tipo==='fine_soggiorno').length,1)
 const rinvio: Decisione={id:'rinvio',room_id:'r',booking_id:'b',tipo:'soggiorno',stato:'rimandata',data_prevista:'2026-11-05',prossima_data:'2026-11-08'}
 assert.deepEqual(storicoPulizieCompleto([b],[rinvio],'2026-11-10').filter(puliziaPresunta).map(e=>e.data_prevista), ['2026-11-08'])
})

test('cambio rinviato e poi fatto: la cadenza riparte dalla data effettiva, non si ricrea quello saltato', () => {
 const e: Decisione[] = [{id:'rinvio',room_id:'r',booking_id:'b',tipo:'soggiorno',stato:'rimandata',data_prevista:'2026-11-05',prossima_data:'2026-11-07',created_at:'2026-11-05T10:00:00Z'},
 {id:'fatta',room_id:'r',booking_id:'b',tipo:'soggiorno',stato:'fatta',data_prevista:'2026-11-07',data_effettiva:'2026-11-07',created_at:'2026-11-07T10:00:00Z'}]
 const s = storicoPulizieCompleto([b],e,'2026-11-12')
 assert.deepEqual(s.filter(puliziaPresunta).map(e=>e.data_prevista),['2026-11-11'])
})

test('sei registrazioni tardive: le pulizie precedenti al nuovo ospite tornano alla partenza, senza perdere ID o recuperi', () => {
 const prima={...b,check_in:'2026-10-01',check_out:'2026-10-07'}
 const seconda={...b,id:'seconda',guest_id:'g2',check_in:'2026-10-07',check_out:'2026-10-10'}
 const e: Decisione={id:'registrata',room_id:'r',booking_id:'b',tipo:'fine_soggiorno',stato:'fatta',data_prevista:'2026-10-07',data_effettiva:'2026-10-10'}
 const s=storicoPulizieCompleto([prima,seconda],[e],'2026-10-11')
 assert.equal(s.find(x=>x.id==='registrata')?.data_effettiva,'2026-10-07')
 assert.equal(s.filter(x=>x.tipo==='fine_soggiorno' && x.data_effettiva==='2026-10-10').length,1)
 assert.equal(e.data_effettiva,'2026-10-10','la registrazione originale non è modificata')
 assert.deepEqual(storicoPulizieCompleto([prima,seconda],s,'2026-10-11'),s)
})

test('dopo una conferma manuale le proiezioni successive avanzano la cadenza', () => {
 const e: Decisione={id:'m',room_id:'r',booking_id:'b',tipo:'soggiorno',stato:'fatta',data_prevista:'2026-11-05',data_effettiva:'2026-11-05',created_at:'2026-11-05T10:00:00Z'}
 assert.equal(pulizieAperte([{...b,check_out:'2026-11-20'}],'r','2026-11-12',[e]).length,0)
})
test('recupero tardivo di una vecchia scadenza non duplica gli interventi successivi', () => {
 const e: Decisione[]=[{id:'vecchia',room_id:'r',booking_id:'b',tipo:'soggiorno',stato:'fatta',data_prevista:'2026-11-05',data_effettiva:'2026-11-05',created_at:'2026-11-12T10:00:00Z'},
 {id:'recente',room_id:'r',booking_id:'b',tipo:'soggiorno',stato:'fatta',data_prevista:'2026-11-09',data_effettiva:'2026-11-09',created_at:'2026-11-09T10:00:00Z'}]
 assert.equal(storicoPulizieCompleto([b],e,'2026-11-12').length,2)
})
test('la scadenza del sistema precedente resta rispettata', () => {
 const s=storicoPulizieCompleto([{...b,linen_next_date:'2026-11-07'}],[],'2026-11-12')
 assert.deepEqual(s.filter(puliziaPresunta).map(e=>e.data_prevista),['2026-11-07','2026-11-11'])
})
