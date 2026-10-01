import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ospitiSoggiorno } from './ospitiSoggiorno.ts'
import { righeCostiSegmenti } from './riepilogoCosti.ts'
import buildWhatsappMsg from './messaggiPrenotazione.ts'
const tratto = (dal: string, al: string, ospiti: number, prezzo = 80, room = 'lena') => ({ id: dal, room_id: room, check_in: `2026-10-${dal}`, check_out: `2026-10-${al}`, num_guests: ospiti, price_per_night: prezzo, total_amount: (Number(al)-Number(dal))*prezzo, rooms: { name: room === 'lena' ? 'Lena' : 'Ambra', bathroom_type: 'privato_esterno' }, guest_name: 'Maria Rosaria Casale' })
test('Maria Rosaria: un soggiorno, due periodi ospiti, conto unico da 560', () => {
  const s = [tratto('11','12',2),tratto('12','18',1)]
  assert.deepEqual(ospitiSoggiorno(s), [{arrivo:'2026-10-11',partenza:'2026-10-12',persone:2},{arrivo:'2026-10-12',partenza:'2026-10-18',persone:1}])
  assert.deepEqual(righeCostiSegmenti(s,true),{righe:[{label:'Camera Lena – Tripla (7 notti × 80,00 €)',amount:560}],totale:560})
  const msg=buildWhatsappMsg(s[0],'conferma',s)
  assert.equal((msg.match(/Check-in:/g)||[]).length,1)
  assert.equal((msg.match(/Check-out:/g)||[]).length,1)
  assert.match(msg,/11 → 12 ottobre/); assert.match(msg,/12 → 18 ottobre/)
  assert.doesNotMatch(msg,/1\. \*Lena/)
})
test('2 → 3 → 2 resta in tre periodi, notti uguali accorpate, prezzi aggregati', () => {
  const s=[tratto('11','13',2),tratto('13','15',3,90),tratto('15','16',2),tratto('16','18',2)]
  assert.equal(ospitiSoggiorno(s)?.length,3)
  assert.deepEqual(righeCostiSegmenti(s,true).righe,[{label:'Camera Lena – Tripla (5 notti in 2 × 80,00 €)',amount:400},{label:'Camera Lena – Tripla (2 notti in 3 × 90,00 €)',amount:180}])
})
test('ospiti fissi, cambio camera, pause e identità ignota non attivano la nuova presentazione', () => {
  assert.equal(ospitiSoggiorno([tratto('11','18',2)]),null)
  assert.equal(ospitiSoggiorno([tratto('11','12',2),tratto('12','18',2)]),null)
  assert.equal(ospitiSoggiorno([tratto('11','12',2),tratto('12','18',1,80,'ambra')]),null)
  assert.equal(ospitiSoggiorno([tratto('11','12',2),tratto('13','18',1)]),null)
  assert.equal(ospitiSoggiorno([tratto('11','12',2),{...tratto('12','18',1),room_id:undefined}]),null)
})
test('proposta: persone notte per notte accorpate in intervalli', () => {
  const s=[{...tratto('11','18',2),persone_notti:[2,3,3,2,2,2,2]}]
  assert.deepEqual(ospitiSoggiorno(s)?.map(x=>x.persone),[2,3,2])
})
test('2→3→2 salvato in una riga con letto per due notti: periodi e conto corretti',()=>{
 const s={...tratto('11','18',3),extra_bed:true,extra_bed_dates:['2026-10-13','2026-10-14'],extra_bed_total:20,total_amount:580,rooms:{name:'Lena',base_price:80,double_price:90,has_extra_bed:true,extra_bed_price:10}}
 assert.deepEqual(ospitiSoggiorno([s])?.map(p=>p.persone),[2,3,2])
 assert.deepEqual(righeCostiSegmenti([s],false).righe,[{label:'Camera Lena – Tripla (5 notti in 2 × 80,00 €)',amount:400},{label:'Camera Lena – Tripla (2 notti in 3 × 90,00 €)',amount:180}])
})
